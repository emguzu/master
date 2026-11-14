/* MASTER — rdzeń panelu.
   Rdzeń nie zna żadnego panelu. Panele i kafelki rejestrują się same:
     M.panel({id,label,icon,order,badge,render,search})   — nowa zakładka
     M.widget({id,order,span,render})                      — nowy kafelek na ekranie „Dziś"
     M.on("akcja", fn)                                     — obsługa data-act="akcja"
   Lista ładowanych plików: panels.json. Wzór nowego panelu: panels/_szablon.js */
(() => {
"use strict";
const COLS = ["projects", "inbox", "approvals", "trucks", "carriers", "modules", "tasks"];
const S = { report: null, settings: {}, ready: false, loadedAt: null }; /* settings = dokument system/settings: owner, brand, loadAddress */
const who = () => S.settings.owner || "użytkownik";
COLS.forEach(c => (S[c] = []));
const panels = [], widgets = [], actions = {}, inputs = {};
const $ = s => document.querySelector(s);

/* ---------- pomocnicze ---------- */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const toDate = v => { if (!v) return null; const d = new Date(String(v).replace(" ", "T")); return isNaN(d) ? null : d; };
const iso = d => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return x.toISOString().slice(0, 10); };
const today = () => iso(new Date());
const fmt = (v, withTime = true) => { const d = toDate(v); if (!d) return v ? String(v) : ""; const o = { day: "2-digit", month: "2-digit" }; if (withTime && String(v).length > 10) Object.assign(o, { hour: "2-digit", minute: "2-digit" }); return d.toLocaleString("pl-PL", o); };
const rel = v => { const d = toDate(v); if (!d) return ""; const n = Math.round((toDate(today()) - toDate(iso(d))) / 864e5); return n <= 0 ? "dziś" : n === 1 ? "wczoraj" : n < 31 ? `${n} dni temu` : fmt(v, false); };
const pln = v => v == null || v === "" ? "—" : Number(v).toLocaleString("pl-PL", { maximumFractionDigits: 0 }) + " zł";
const sender = f => String(f || "").replace(/<.*?>/g, "").replace(/"/g, "").trim() || String(f || "");
const project = ref => S.projects.find(p => p.id === ref || p.nr === ref);
const openTodos = p => (p.todo || []).filter(t => !t.done).length;
function toast(m) { const e = $("#toast"); e.textContent = m; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (e.hidden = true), 2600); }

/* ---------- magazyn danych ----------
   Jedyny punkt styku z bazą. Dziś: kopia danych (snapshot.json) + zmiany trzymane lokalnie.
   Docelowo: ten sam interfejs load/save nad bazą w chmurze — panele się nie zmieniają. */
const CFG = window.MASTER_CONFIG || {};
const SB_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
const script = src => new Promise((ok, err) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => err(new Error("Nie wczytano: " + src)); document.head.append(s); });

/* Chmura (Supabase): tabela docs(collection, id, data). Włącza się, gdy config.js ma adres i klucz. */
const Cloud = {
  /* dopisek ?podglad w adresie wymusza tryb podglądu na kopii danych (bez chmury i logowania) */
  on: !!(CFG.supabaseUrl && CFG.supabaseKey) && !/[?&]podglad/.test(location.search), db: null, user: null, live: false,
  async init() {
    await script(SB_CDN);
    this.db = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
    const { data } = await this.db.auth.getSession();
    this.user = data.session ? data.session.user : null;
  },
  put(col, id, data) {
    if (col === "system") { if (id === "report") S.report = data ? { id, ...data } : null; if (id === "settings") S.settings = data || {}; return; }
    if (!S[col]) S[col] = [];
    const i = S[col].findIndex(x => x.id === id);
    if (!data) { if (i >= 0) S[col].splice(i, 1); } else if (i >= 0) S[col][i] = { id, ...data }; else S[col].push({ id, ...data });
  },
  async load() {
    COLS.forEach(c => (S[c] = [])); S.report = null; this.rows = 0;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.db.from("docs").select("collection,id,data").order("collection").order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      data.forEach(r => this.put(r.collection, r.id, r.data)); this.rows += data.length;
      if (data.length < 1000) break;
    }
    S.ready = true; S.loadedAt = new Date();
  },
  subscribe() {
    this.db.channel("docs").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, p => {
      const r = p.eventType === "DELETE" ? p.old : p.new;
      this.put(r.collection, r.id, p.eventType === "DELETE" ? null : r.data);
      S.loadedAt = new Date(); clearTimeout(this.t); this.t = setTimeout(refresh, 150);
    }).subscribe(st => { this.live = st === "SUBSCRIBED"; refresh(); });
  },
  async patch(col, id, patch) {
    const { error } = await this.db.rpc("patch_doc", { p_collection: col, p_id: id, p_patch: patch });
    if (error) { toast("Nie zapisano: " + error.message); try { await this.load(); } catch {} refresh(); }
  },
  async start() { await this.load(); if (!this.live) this.subscribe(); },
  /* pierwsze zasilenie pustej bazy kopią danych z tego komputera (snapshot.json) */
  async importSnapshot(say) {
    const d = await (await fetch("snapshot.json", { cache: "no-store" })).json(), rows = [];
    const add = (collection, doc) => { const { id, _v, ...data } = doc; rows.push({ collection, id, data }); };
    COLS.forEach(c => (d[c] || []).forEach(x => add(c, x)));
    (d.system || (d.report ? [d.report] : [])).forEach(x => add("system", x));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await this.db.from("docs").upsert(rows.slice(i, i + 100));
      if (error) throw new Error(error.message);
      say(`Wgrano ${Math.min(i + 100, rows.length)} z ${rows.length}…`);
    }
    return rows.length;
  },
};
const emptyHtml = () => `<div class="card login"><h1>Baza jest pusta</h1><p class="muted" style="margin:0">Zalogowano jako ${esc(Cloud.user.email)}. Wgraj do chmury kopię danych z tego komputera — jednorazowo, na start.</p>
  <button class="btn primary" data-act="import" style="justify-content:center">Wgraj kopię danych do chmury</button><div id="im-m" class="muted" role="status"></div>
  <p class="muted" style="margin:0;font-size:12.5px">Jeśli wgrywanie zostanie odrzucone, ten e-mail nie jest jeszcze na liście panel_users.</p></div>`;
const loginHtml = () => `<div class="card login"><div class="brand" style="padding:0 0 6px"><div class="logo">M</div><div><b>MASTER</b><small>STEROWNIA</small></div></div>
  <p class="muted" style="margin:0 0 6px">Zaloguj się, żeby zobaczyć dane firmy.</p>
  <input id="lg-e" type="email" autocomplete="username" placeholder="E-mail" aria-label="E-mail">
  <input id="lg-p" type="password" autocomplete="current-password" placeholder="Hasło" aria-label="Hasło">
  <button class="btn primary" data-act="login" style="justify-content:center">Zaloguj</button><div id="lg-m" class="muted" role="status"></div></div>`;

const OV_KEY = "master.overlay.v1";
const Store = {
  mode: "podgląd",
  overlay: (() => { try { return JSON.parse(localStorage.getItem(OV_KEY)) || {}; } catch { return {}; } })(),
  async load() {
    const r = await fetch("snapshot.json", { cache: "no-store" });
    if (!r.ok) throw new Error("Brak pliku snapshot.json");
    const d = await r.json();
    COLS.forEach(c => (S[c] = d[c] || []));
    S.report = d.report || null;
    S.settings = (d.system || []).find(x => x.id === "settings") || {};
    for (const [key, patch] of Object.entries(this.overlay)) {
      const [col, id] = key.split("/");
      if (col === "report") { if (S.report) Object.assign(S.report, patch); continue; }
      const doc = (S[col] || []).find(x => x.id === id);
      if (doc) Object.assign(doc, patch); else if (S[col] && patch._new) S[col].push({ id, ...patch });
    }
    S.ready = true; S.loadedAt = new Date();
  },
  save(col, id, patch) {
    const stamp = new Date().toISOString();
    if (col === "system" && id === "settings") {
      Object.assign(S.settings, patch);
      if (Cloud.on) Cloud.patch("system", "settings", patch);
    } else if (col === "report") {
      Object.assign(S.report, patch);
      if (Cloud.on) Cloud.patch("system", "report", patch);
      else this.overlay["report/report"] = { ...(this.overlay["report/report"] || {}), ...patch };
    } else {
      if (!S[col]) S[col] = [];
      let doc = id && S[col].find(x => x.id === id), fresh = !doc;
      if (fresh) { id = id || col.slice(0, 1) + "-" + Date.now().toString(36); doc = { id, created: stamp }; S[col].push(doc); patch = { ...patch, created: stamp }; }
      Object.assign(doc, patch, { updated: stamp });
      if (Cloud.on) Cloud.patch(col, id, { ...patch, updated: stamp });
      else this.overlay[col + "/" + id] = { ...(this.overlay[col + "/" + id] || {}), ...patch, ...(fresh ? { _new: true } : {}), updated: stamp };
    }
    if (!Cloud.on) try { localStorage.setItem(OV_KEY, JSON.stringify(this.overlay)); } catch {}
    return id;
  },
  pending() { return Object.keys(this.overlay).length; },
  reset() { this.overlay = {}; try { localStorage.removeItem(OV_KEY); } catch {} },
};
function save(col, id, patch, msg) { const r = Store.save(col, id, patch); if (msg) toast(msg); refresh(); return r; }

/* ---------- rejestr paneli ---------- */
function route() { const [id, arg] = location.hash.slice(1).split("/"); const p = panels.find(x => x.id === id) || panels[0]; return { p, arg: arg ? decodeURIComponent(arg) : "" }; }
function go(hash) { if (location.hash === "#" + hash) refresh(); else location.hash = hash; }
function navHtml(compact) {
  const cur = route().p;
  return panels.filter(p => !p.hidden).map(p => {
    const b = p.badge ? p.badge(S) : null;
    const n = b && b.n ? `<span class="n ${b.hot ? "hot" : ""}">${b.n}</span>` : "";
    return `<a href="#${p.id}" ${p === cur ? 'aria-current="page"' : ""}>${icon(p.icon || p.id)}<span>${esc(compact ? p.short || p.label : p.label)}</span>${compact && !(b && b.hot) ? "" : n}</a>`;
  }).join("");
}
function refresh() {
  if (!panels.length) return;
  const { p, arg } = route();
  const act = document.activeElement, keep = act && act.id && $("#view").contains(act) ? { id: act.id, a: act.selectionStart, b: act.selectionEnd } : null;
  const top = document.scrollingElement.scrollTop, same = refresh.last === p.id;
  $("#nav").innerHTML = navHtml(false);
  $("#tabs").innerHTML = navHtml(true);
  const locked = Cloud.on && !Cloud.user;
  if (locked) { if (!$("#lg-e")) $("#view").innerHTML = loginHtml(); }
  else if (Cloud.on && S.ready && !Cloud.rows) { if (!$("#im-m")) $("#view").innerHTML = emptyHtml(); }
  else $("#view").innerHTML = S.ready ? `<div class="view" ${same ? 'style="animation:none"' : ""}>${p.render(S, arg)}</div>` : `<div class="empty">Ładowanie danych…</div>`;
  $("#overlay").innerHTML = locked ? "" : palette.open ? paletteHtml() : S.ready && p.overlay ? p.overlay(S, arg) : "";
  document.title = "MASTER · " + p.label;
  document.querySelectorAll(".brand small").forEach(e => (e.textContent = S.settings.brand || "STEROWNIA"));
  if (same) document.scrollingElement.scrollTop = top; else document.scrollingElement.scrollTop = 0;
  refresh.last = p.id;
  if (keep) { const e = document.getElementById(keep.id); if (e) { e.focus(); try { e.setSelectionRange(keep.a, keep.b); } catch {} } }
  const r = S.report, n = Store.pending();
  if (Cloud.on) {
    $("#sync").innerHTML = `<span class="dot ${Cloud.live ? "on" : Cloud.user ? "idle" : "off"}"></span><span>${Cloud.live ? "Chmura · na żywo" : Cloud.user ? "Chmura · łączenie…" : "Niezalogowany"}</span>`;
    $("#preview").hidden = !Cloud.user;
    $("#preview").innerHTML = Cloud.user ? `${esc(Cloud.user.email)} · <button data-act="logout" style="text-decoration:underline">wyloguj</button>` : "";
  } else {
    $("#sync").innerHTML = `<span class="dot ${S.ready ? "idle" : "off"}"></span><span>Kopia danych${r ? " z " + esc(fmt(r.updated || r.generatedAt)) : ""}</span>`;
    $("#preview").innerHTML = `TRYB PODGLĄDU${n ? ` · ${n} zmian lokalnie <button data-act="reset" style="text-decoration:underline">cofnij</button>` : " · zmiany zostają na tym urządzeniu"}`;
  }
}

/* ---------- paleta poleceń (Ctrl+K) ---------- */
const palette = { open: false, q: "", i: 0, items: [] };
function paletteItems(q) {
  const t = q.trim().toLowerCase(), hit = s => !t || String(s || "").toLowerCase().includes(t);
  const out = [];
  panels.filter(p => !p.hidden && hit(p.label)).forEach(p => out.push({ grp: "Przejdź do", icon: p.icon || p.id, text: p.label, go: p.id }));
  panels.forEach(p => p.search && out.push(...p.search(t, hit).slice(0, 8)));
  if (Cloud.user && hit("wyloguj")) out.push({ grp: "Konto", icon: "x", text: "Wyloguj", hint: Cloud.user.email, run: () => actions["logout"]() });
  if (t) out.push({ grp: "Polecenie", icon: "arrow", text: `Zleć agentom: „${q.trim()}”`, run: () => { Store.save("tasks", null, { text: q.trim(), module: "router", status: "queued", requestedBy: who() + " (panel)" }); toast("Polecenie dodane do kolejki"); } });
  return out;
}
function paletteHtml() {
  palette.items = paletteItems(palette.q); palette.i = Math.min(palette.i, Math.max(0, palette.items.length - 1));
  let g = "";
  return `<div class="scrim" data-act="palette-close"></div><div class="pal" role="dialog" aria-label="Szukaj"><input id="pal-in" data-input="palette" placeholder="Szukaj projektu, maila, panelu… albo wpisz polecenie dla agentów" value="${esc(palette.q)}" autocomplete="off"><ul>${palette.items.map((x, i) => (x.grp !== g ? ((g = x.grp), `<li class="grp">${esc(x.grp)}</li>`) : "") + `<li data-act="palette-pick" data-i="${i}" aria-selected="${i === palette.i}">${icon(x.icon)}<span>${esc(x.text)}</span>${x.hint ? `<small>${esc(x.hint)}</small>` : ""}</li>`).join("") || '<li class="grp">Brak wyników</li>'}</ul></div>`;
}
function openPalette(open = true) { palette.open = open; palette.q = ""; palette.i = 0; if (open && route().arg) { /* zamknij szufladę */ history.replaceState(null, "", "#" + route().p.id); } refresh(); if (open) { const e = $("#pal-in"); e && e.focus(); } }
function pick(i) { const x = palette.items[i]; if (!x) return; palette.open = false; if (x.run) { x.run(); refresh(); } else go(x.go); }

/* ---------- zdarzenia ---------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.matches("input,select,textarea")) return;
  const fn = actions[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("change", e => { const el = e.target; if (el.dataset && el.dataset.act && actions[el.dataset.act]) actions[el.dataset.act](el, e); });
document.addEventListener("input", e => { const el = e.target; if (el.dataset && el.dataset.input && inputs[el.dataset.input]) inputs[el.dataset.input](el, e); });
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "lg-p") { actions["login"](); return; }
  if (Cloud.on && !Cloud.user) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(!palette.open); return; }
  if (palette.open) {
    if (e.key === "Escape") openPalette(false);
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = palette.items.length; palette.i = (palette.i + (e.key === "ArrowDown" ? 1 : n - 1)) % Math.max(n, 1); refresh(); }
    else if (e.key === "Enter") { e.preventDefault(); pick(palette.i); }
  } else if (e.key === "Escape" && route().arg) go(route().p.id);
});
addEventListener("hashchange", refresh);
/* podpowiedź nad elementem z data-tip */
document.addEventListener("pointermove", e => {
  const el = e.target.closest && e.target.closest("[data-tip]"), tip = $("#tip");
  if (!el) { tip.hidden = true; return; }
  tip.textContent = el.dataset.tip;
  if (el.dataset.tipv) { const b = document.createElement("b"); b.textContent = " · " + el.dataset.tipv; tip.append(b); }
  tip.hidden = false;
  const w = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX - w / 2)) + "px"; tip.style.top = Math.max(8, e.clientY - 44) + "px";
});

actions["palette"] = () => openPalette(true);
actions["palette-close"] = () => openPalette(false);
actions["palette-pick"] = el => pick(+el.dataset.i);
inputs["palette"] = el => { palette.q = el.value; palette.i = 0; refresh(); };
actions["theme"] = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; try { localStorage.setItem("master.theme", t); } catch {} };
actions["reset"] = async () => { Store.reset(); await Store.load(); toast("Lokalne zmiany cofnięte"); refresh(); };
actions["go"] = el => go(el.dataset.to);
actions["login"] = async () => {
  const msg = $("#lg-m"), email = $("#lg-e").value.trim(), password = $("#lg-p").value;
  if (!email || !password) { msg.textContent = "Podaj e-mail i hasło."; return; }
  msg.textContent = "Logowanie…";
  const { data, error } = await Cloud.db.auth.signInWithPassword({ email, password });
  if (error) { msg.textContent = "Nie udało się zalogować: " + error.message; return; }
  Cloud.user = data.user; $("#view").innerHTML = `<div class="empty">Ładowanie danych…</div>`;
  try { await Cloud.start(); } catch (e) { toast("Błąd bazy: " + e.message); }
  refresh();
};
actions["import"] = async el => {
  const msg = $("#im-m"); el.disabled = true;
  try { const n = await Cloud.importSnapshot(t => (msg.textContent = t)); await Cloud.load(); toast(`Wgrano ${n} dokumentów`); }
  catch (e) { msg.textContent = "Nie wgrano: " + e.message; el.disabled = false; return; }
  refresh();
};
actions["logout"] = async () => { await Cloud.db.auth.signOut(); location.reload(); };
try { const t = localStorage.getItem("master.theme"); if (t) document.documentElement.dataset.theme = t; } catch {}

/* ---------- API dla paneli ---------- */
window.M = {
  S, Store, save, refresh, go, toast, who,
  panel(def) { panels.push(def); panels.sort((a, b) => (a.order || 99) - (b.order || 99)); },
  widget(def) { widgets.push(def); widgets.sort((a, b) => (a.order || 99) - (b.order || 99)); },
  widgets: () => widgets,
  on(name, fn) { actions[name] = fn; },
  /* własne ikony panelu: M.icons({nazwa: '<path d="…"/>'}) → M.h.icon("nazwa") */
  icons(map) { const host = document.querySelector("svg[aria-hidden] symbol").parentNode; for (const [n, body] of Object.entries(map)) { if (document.getElementById("i-" + n)) continue; const s = document.createElementNS("http://www.w3.org/2000/svg", "symbol"); s.id = "i-" + n; s.setAttribute("viewBox", "0 0 24 24"); s.innerHTML = body; host.append(s); } },
  onInput(name, fn) { inputs[name] = fn; },
  h: { esc, icon, fmt, rel, pln, today, iso, toDate, sender, project, openTodos },
};

/* ---------- start ---------- */
(async () => {
  try {
    const list = await (await fetch("panels.json", { cache: "no-store" })).json();
    for (const name of list) await new Promise((ok, err) => { const s = document.createElement("script"); s.src = `panels/${name}.js?v=${Date.now()}`; /* zawsze świeża wersja modułu, bez pamięci podręcznej */ s.onload = ok; s.onerror = () => err(new Error("Nie wczytano panelu: " + name)); document.head.append(s); });
    if (Cloud.on) { await Cloud.init(); refresh(); if (Cloud.user) await Cloud.start(); }
    else { refresh(); await Store.load(); }
    refresh();
  } catch (e) { $("#view").innerHTML = `<div class="empty">Nie udało się uruchomić panelu: ${esc(e.message)}</div>`; }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
})();
