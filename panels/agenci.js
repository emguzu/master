/* Panel „Agenci" — rejestr modułów czytany z bazy. Nowy moduł w kolekcji `modules` pojawia się tu sam. */
(() => {
const { S, h } = M, { esc, fmt } = h;
M.panel({
  id: "agenci", label: "Agenci", icon: "agenci", order: 60,
  badge: () => ({ n: S.tasks.filter(t => t.status !== "done").length }),
  render: () => {
    const ms = [...S.modules].sort((a, b) => (a.order || 99) - (b.order || 99)), q = S.tasks.filter(t => t.status !== "done"), d = S.tasks.filter(t => t.status === "done").slice(-5).reverse();
    return `<div class="head"><div><h1>Agenci</h1><p>Każdy moduł to osobny agent: czyta pocztę, pliki i bazę, a zapisuje szkice do akceptacji. Wyłączenie jednego nie psuje pozostałych.</p></div></div>
    <div class="bento">${ms.map(m => `<section class="card c4 agent-card"><div class="top"><span class="dot ${!m.enabled ? "off" : m.lastRun ? "on" : "idle"}"></span><b>${esc(m.name)}</b><button class="switch" role="switch" aria-checked="${!!m.enabled}" aria-label="${m.enabled ? "Wyłącz" : "Włącz"} moduł ${esc(m.name)}" data-act="mod" data-id="${esc(m.id)}"></button></div>
      <div class="muted">${esc(m.desc || "")}</div>
      <dl class="facts"><dt>Harmonogram</dt><dd>${esc(m.schedule || "—")}</dd><dt>Ostatnio</dt><dd>${esc(fmt(m.lastRun) || "jeszcze nie działał")}</dd><dt>Czyta</dt><dd>${esc(m.reads || "—")}</dd><dt>Zapisuje</dt><dd>${esc(m.writes || "—")}</dd></dl>
      ${m.lastResult ? `<div class="res">${esc(m.lastResult)}</div>` : ""}</section>`).join("")}
    <section class="card c12"><h2>Kolejka poleceń <span class="mono">· ${q.length}</span></h2>${q.map(t => `<div class="todo"><span class="dot ${t.status === "running" ? "on" : "idle"}" style="margin-top:7px"></span><div style="flex:1;min-width:0"><div class="tx">${esc(t.text)}</div><div class="meta"><span class="chip">${esc(t.module || "")}</span>${t.node ? `<span class="chip">${esc(t.node)}</span>` : ""}<span class="chip acc">${t.status === "running" ? "w toku" : "w kolejce"}</span></div></div></div>`).join("") || '<p class="muted" style="margin:0">Kolejka jest pusta.</p>'}
      ${d.length ? `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">Ostatnio wykonane (${d.length})</summary>${d.map(t => `<div class="todo done"><div style="flex:1;min-width:0"><div>${esc(t.text)}</div>${t.result ? `<div class="why">${esc(t.result)}</div>` : ""}</div></div>`).join("")}</details>` : ""}</section></div>`;
  },
});
M.on("mod", el => { const m = S.modules.find(x => x.id === el.dataset.id); M.save("modules", m.id, { enabled: !m.enabled }, m.enabled ? "Moduł wyłączony" : "Moduł włączony"); });
})();
