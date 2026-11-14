#!/usr/bin/env python3
"""masterdb.py — dostep agentow MASTER do bazy w chmurze (Supabase, tabela `docs`).

Jedna tabela dokumentow: (kolekcja, id) -> dane JSON + wersja. Tylko biblioteka standardowa.

PIERWSZE URUCHOMIENIE (raz na komputer, robi to wlasciciel):
    python masterdb.py login          # wkleja klucz tajny (Secret key) — zapis w profilu uzytkownika

ODCZYT
    python masterdb.py get projects ST-26.001
    python masterdb.py list approvals --where status=approved
    python masterdb.py list inbox --where status!=done --fields date,from,subject,project
    python masterdb.py list projects --out _tmp/db          # zapis do plikow zamiast na ekran
    python masterdb.py collections                          # jakie kolekcje istnieja i ile maja dokumentow

ZAPIS (kazdy zapis do istniejacego dokumentu przypinaj wersja: --if-version N)
    python masterdb.py update projects ST-26.001 --json "{\"status\": \"produkcja\"}" --if-version 49
    python masterdb.py update inbox 158300 --file zmiana.json           # scala pola na gornym poziomie
    python masterdb.py set    modules router --file router.json         # zastepuje caly dokument
    python masterdb.py delete tasks T-123 --if-version 2
    python masterdb.py batch  zapisy.json    # [{"op":"update|set|delete","collection":..,"id":..,"data":{..},"if_version":N}, ...]
  Usuniecie pola w update: wartosc {"__delete__": true}.

CALOSC
    python masterdb.py export KATALOG        # KATALOG/<kolekcja>/<id>.json
    python masterdb.py import KATALOG        # wgrywa/zastepuje dokumenty z plikow

Kody wyjscia: 0 ok, 2 blad uzycia/konfiguracji, 3 konflikt wersji (ktos zmienil dokument — przeczytaj i ponow), 4 brak dokumentu.
"""
import argparse
import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://vldvyqgalstqgcefqhut.supabase.co"
CONFIG = Path.home() / ".master" / "cloud.json"

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass


def die(msg, code=2):
    print("BLAD: " + msg, file=sys.stderr)
    sys.exit(code)


def config():
    url, key = os.environ.get("MASTER_SUPABASE_URL"), os.environ.get("MASTER_SUPABASE_KEY")
    if not key and CONFIG.exists():
        c = json.loads(CONFIG.read_text(encoding="utf-8"))
        url, key = url or c.get("url"), c.get("key")
    if not key:
        die("brak klucza. Uruchom raz:  python masterdb.py login")
    return (url or DEFAULT_URL).rstrip("/"), key


def call(method, path, body=None, prefer=None, cfg=None):
    url, key = cfg or config()
    headers = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url + "/rest/v1/" + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        die(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:500]}")
    except urllib.error.URLError as e:
        die(f"brak polaczenia z baza: {e.reason}")


q = lambda v: urllib.parse.quote(str(v), safe="")
key_filter = lambda col, doc_id: f"collection=eq.{q(col)}&id=eq.{q(doc_id)}"


def fetch(col, doc_id):
    rows = call("GET", f"docs?select=collection,id,data,version,updated_at&{key_filter(col, doc_id)}")
    return rows[0] if rows else None


def fetch_all(col=None, where=()):
    out, start = [], 0
    filt = (f"&collection=eq.{q(col)}" if col else "") + "".join(where)
    while True:
        rows = call("GET", f"docs?select=collection,id,data,version,updated_at{filt}&order=collection,id&limit=1000&offset={start}")
        out.extend(rows)
        if len(rows) < 1000:
            return out
        start += 1000


def where_clause(expr):
    for op, pg in (("!=", "neq"), (">=", "gte"), ("<=", "lte"), (">", "gt"), ("<", "lt"), ("=", "eq")):
        if op in expr:
            field, value = expr.split(op, 1)
            if value in ("null", ""):
                return f"&data->>{q(field.strip())}=" + ("not.is.null" if pg == "neq" else "is.null")
            if pg == "neq":  # "rozne od" ma tez lapac dokumenty bez tego pola
                return f"&or=(data->>{q(field.strip())}.neq.{q(value)},data->>{q(field.strip())}.is.null)"
            return f"&data->>{q(field.strip())}={pg}.{q(value)}"
    die(f"nie rozumiem warunku --where {expr!r} (uzyj pole=wartosc, pole!=wartosc, pole>=wartosc)")


def payload(args):
    if args.file:
        return json.loads(Path(args.file).read_text(encoding="utf-8-sig"))
    if args.json:
        return json.loads(args.json)
    die("podaj dane: --json '{...}' albo --file plik.json")


def merge(base, patch):
    out = dict(base)
    for k, v in patch.items():
        if isinstance(v, dict) and v.get("__delete__") is True:
            out.pop(k, None)
        else:
            out[k] = v
    return out


def show(row):
    return {"id": row["id"], "version": row["version"], **({"collection": row["collection"]} if row.get("_col") else {}), "data": row["data"]}


def write(op, col, doc_id, data=None, if_version=None, quiet=False):
    """Zwraca nowa wersje dokumentu. Konflikt wersji -> wyjscie kodem 3."""
    cur = fetch(col, doc_id)
    if if_version is not None and (cur is None or cur["version"] != if_version):
        die(f"konflikt wersji {col}/{doc_id}: oczekiwano {if_version}, jest {cur['version'] if cur else 'brak dokumentu'}", 3)
    if op == "delete":
        if cur is None:
            die(f"nie ma dokumentu {col}/{doc_id}", 4)
        call("DELETE", f"docs?{key_filter(col, doc_id)}&version=eq.{cur['version']}", prefer="return=representation") or die(f"konflikt wersji {col}/{doc_id}", 3)
        return None
    if not isinstance(data, dict):
        die("dane dokumentu musza byc obiektem JSON")
    data = {k: v for k, v in data.items() if k != "id"}
    if cur is None:
        if op == "update":
            data = merge({}, data)
        rows = call("POST", "docs", {"collection": col, "id": doc_id, "data": data}, prefer="return=representation")
    else:
        new = merge(cur["data"], data) if op == "update" else data
        rows = call("PATCH", f"docs?{key_filter(col, doc_id)}&version=eq.{cur['version']}", {"data": new}, prefer="return=representation")
        if not rows:
            die(f"konflikt wersji {col}/{doc_id}: dokument zmienil sie w trakcie zapisu — przeczytaj i ponow", 3)
    return rows[0]["version"]


def cmd_login(a):
    print("Supabase -> Settings -> API Keys -> Secret keys -> skopiuj klucz (zaczyna sie od sb_secret_).")
    key = getpass.getpass("Wklej klucz tajny (nie bedzie widoczny) i nacisnij Enter: ").strip()
    if not key:
        die("pusty klucz")
    cfg = (a.url or DEFAULT_URL).rstrip("/"), key
    rows = call("GET", "docs?select=id&limit=1", cfg=cfg)
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    CONFIG.write_text(json.dumps({"url": cfg[0], "key": key}), encoding="utf-8")
    print(f"OK — polaczono z baza ({'sa dane' if rows else 'baza pusta'}). Klucz zapisany w {CONFIG}")


def cmd_get(a):
    row = fetch(a.collection, a.id)
    if not row:
        die(f"nie ma dokumentu {a.collection}/{a.id}", 4)
    print(json.dumps(show(row), ensure_ascii=False, indent=2))


def cmd_list(a):
    rows = fetch_all(a.collection, [where_clause(w) for w in a.where or []])
    if a.limit:
        rows = rows[: a.limit]
    if a.out:
        for r in rows:
            p = Path(a.out) / r["collection"] / (r["id"] + ".json")
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps({"id": r["id"], "_version": r["version"], **r["data"]}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{len(rows)} dokumentow zapisano w {a.out}/{a.collection} (pole _version = wersja)")
        return
    fields = a.fields.split(",") if a.fields else None
    for r in rows:
        d = r["data"] if not fields else {k: r["data"].get(k) for k in fields}
        print(json.dumps({"id": r["id"], "version": r["version"], **d}, ensure_ascii=False))
    print(f"# {len(rows)} dokumentow", file=sys.stderr)


def cmd_collections(a):
    counts = {}
    for r in call("GET", "docs?select=collection&limit=100000"):
        counts[r["collection"]] = counts.get(r["collection"], 0) + 1
    for k in sorted(counts):
        print(f"{k}\t{counts[k]}")


def cmd_write(a):
    v = write(a.cmd, a.collection, a.id, None if a.cmd == "delete" else payload(a), a.if_version)
    print(f"OK {a.cmd} {a.collection}/{a.id}" + (f" -> wersja {v}" if v else ""))


def cmd_batch(a):
    ops = json.loads(Path(a.file).read_text(encoding="utf-8-sig"))
    for i, o in enumerate(ops, 1):
        v = write(o["op"], o["collection"], o.get("id") or o.get("doc_id"), o.get("data"), o.get("if_version"))
        print(f"OK {i}/{len(ops)} {o['op']} {o['collection']}/{o.get('id') or o.get('doc_id')}" + (f" -> wersja {v}" if v else ""))


def cmd_export(a):
    rows = fetch_all()
    for r in rows:
        p = Path(a.dir) / r["collection"] / (r["id"] + ".json")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(r["data"], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wyeksportowano {len(rows)} dokumentow do {a.dir}")


def cmd_import(a):
    root, rows = Path(a.dir), []
    for path in sorted(root.rglob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8-sig"))
        doc.pop("id", None), doc.pop("_version", None)
        rows.append({"collection": "/".join(path.relative_to(root).parts[:-1]), "id": path.stem, "data": doc})
    for i in range(0, len(rows), 200):
        call("POST", "docs?on_conflict=collection,id", rows[i:i + 200], prefer="resolution=merge-duplicates,return=minimal")
    counts = {}
    for r in rows:
        counts[r["collection"]] = counts.get(r["collection"], 0) + 1
    print(f"wgrano {len(rows)} dokumentow: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))


def main():
    p = argparse.ArgumentParser(description="Baza MASTER w chmurze — narzedzie agentow", epilog="Przyklady: patrz naglowek pliku.")
    s = p.add_subparsers(dest="cmd", required=True)
    x = s.add_parser("login"); x.add_argument("--url"); x.set_defaults(fn=cmd_login)
    x = s.add_parser("get"); x.add_argument("collection"); x.add_argument("id"); x.set_defaults(fn=cmd_get)
    x = s.add_parser("list"); x.add_argument("collection"); x.add_argument("--where", action="append"); x.add_argument("--fields"); x.add_argument("--out"); x.add_argument("--limit", type=int); x.set_defaults(fn=cmd_list)
    x = s.add_parser("collections"); x.set_defaults(fn=cmd_collections)
    for name in ("set", "update", "delete"):
        x = s.add_parser(name); x.add_argument("collection"); x.add_argument("id"); x.add_argument("--if-version", type=int, dest="if_version")
        if name != "delete":
            x.add_argument("--json"); x.add_argument("--file")
        x.set_defaults(fn=cmd_write)
    x = s.add_parser("batch"); x.add_argument("file"); x.set_defaults(fn=cmd_batch)
    x = s.add_parser("export"); x.add_argument("dir"); x.set_defaults(fn=cmd_export)
    x = s.add_parser("import"); x.add_argument("dir"); x.set_defaults(fn=cmd_import)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
