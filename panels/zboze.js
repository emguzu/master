/* Panel „Zboże" — kontrakty, auta z kompletem dokumentów, przewoźnicy. */
(() => {
const { S, h } = M, { esc, icon, fmt, openTodos } = h;
const DOCS = [["cmr", "CMR"], ["wz", "WZ"], ["kwit", "Kwit"], ["faktura", "Faktura"]];
const missing = t => DOCS.filter(([k]) => !t[k]).length;

M.panel({
  id: "zboze", label: "Zboże i transport", short: "Zboże", icon: "zboze", order: 50,
  badge: () => ({ n: S.trucks.filter(missing).length }),
  render: () => {
    const cs = S.projects.filter(p => p.line === "ZBOZE" && p.status !== "zamknięty");
    return `<div class="head"><div><h1>Zboże i transport</h1><p>${S.settings.loadAddress ? "Załadunek: " + esc(S.settings.loadAddress) + ". " : ""}Kliknij dokument, gdy jest w folderze — agent zaznacza je też sam.</p></div></div>
    ${cs.length ? cs.map(c => { const tr = S.trucks.filter(t => t.project === c.nr).sort((a, b) => String(a.nr).localeCompare(String(b.nr))); const t = tr.reduce((s, x) => s + (+x.tonnes || 0), 0), need = DOCS.length * tr.length, have = need - tr.reduce((s, x) => s + missing(x), 0);
      return `<section class="card" style="margin-bottom:14px"><div class="meta" style="margin:0"><a class="chip mono" href="#projekty/${encodeURIComponent(c.id)}">${esc(c.nr)}</a><span class="chip">${esc(c.status)}</span>${openTodos(c) ? `<span class="chip acc">${openTodos(c)} spraw</span>` : ""}</div>
      <div style="font:700 24px/1.15 var(--f-display);margin-top:8px">${esc(c.name)}</div><div class="muted">${esc(c.client)}${c.destination ? " → " + esc(c.destination) : ""}</div>
      <div class="statline" style="margin-top:14px"><div><b>${tr.length}</b><span>aut</span></div><div><b>${t.toLocaleString("pl-PL")} t</b><span>${c.tonnes ? "z " + Number(c.tonnes).toLocaleString("pl-PL") + " t" : "wysłane"}</span></div><div><b>${have}/${need}</b><span>dokumentów w komplecie</span></div></div>
      ${c.tonnes ? `<div class="prog" role="img" aria-label="Wysłano ${t} z ${c.tonnes} t"><i style="width:${Math.min(100, Math.round(t / c.tonnes * 100))}%"></i></div>` : need ? `<div class="prog" role="img" aria-label="Dokumenty ${have} z ${need}"><i style="width:${Math.round(have / need * 100)}%"></i></div>` : ""}
      ${c.hint ? `<p class="muted" style="margin:12px 0 0">${esc(c.hint)}</p>` : ""}
      ${tr.length ? `<div class="trucks">${tr.map(x => `<div class="truck"><div class="r"><b class="mono">${esc(x.nr)}</b><span class="chip">${esc(x.status || "")}</span><span class="mono muted" style="margin-left:auto;font-size:12px">${esc(fmt(x.date, false))}</span></div>
        <div><b>${esc(x.carrier || "")}</b><div class="muted" style="font-size:12.5px">${esc(x.driver || "")}${x.plates ? " · " + esc(x.plates) : ""}${x.phone ? ` · <span style="user-select:all">${esc(x.phone)}</span>` : ""}</div><div class="muted" style="font-size:12.5px">${esc(x.tonnes ?? "?")} t → ${esc(x.to || "")}</div></div>
        <div class="docs">${DOCS.map(([k, l]) => `<button data-act="doc" data-id="${esc(x.id)}" data-k="${k}" aria-pressed="${!!x[k]}">${x[k] ? icon("check") : ""}${l}</button>`).join("")}</div></div>`).join("")}</div>` : '<p class="muted">Brak aut. Agent transportu przygotuje zapytania do akceptacji.</p>'}</section>`; }).join("") : '<div class="empty">Brak aktywnych kontraktów zbożowych.</div>'}
    <section class="card"><h2>Przewoźnicy <span class="mono">· ${S.carriers.length}</span></h2>${S.carriers.length ? `<div class="tablewrap" style="padding:0"><table class="table" style="cursor:default"><thead><tr><th>Firma</th><th>Kontakt</th><th>Uwagi</th><th>Źródło</th></tr></thead><tbody>${S.carriers.map(c => `<tr style="cursor:default"><td><b>${esc(c.name)}</b>${c.contact ? `<div class="muted">${esc(c.contact)}</div>` : ""}</td><td class="mono" style="user-select:all;font-size:12.5px">${esc(c.phone || "")}<br>${esc(c.email || "")}</td><td>${esc(c.note || c.notes || "")}</td><td><span class="chip">${esc(c.source || "ręcznie")}</span></td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">Baza przewoźników jest pusta.</p>'}</section>`;
  },
});
M.on("doc", el => { const t = S.trucks.find(x => x.id === el.dataset.id), k = el.dataset.k; M.save("trucks", t.id, { [k]: !t[k] }, t[k] ? "Cofnięto" : "Dokument odhaczony"); });
})();
