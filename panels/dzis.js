/* Panel „Dziś" — ekran startowy złożony z kafelków (M.widget). Nowy kafelek = jedno M.widget({...}) w dowolnym pliku. */
(() => {
const { S, h } = M, { esc, icon, fmt, today, toDate, iso, project } = h;
const STAGES = ["zapytanie", "oferta", "zamówienie", "projekt", "produkcja", "realizacja", "kontrakt", "transport", "w realizacji", "wysyłka", "dokumenty", "faktura", "rozliczenie", "gwarancja"];

/* powiązanie pozycji planu z kartą poczty albo sprawą projektu — załatwione tam = załatwione tu */
function link(x) {
  const ref = x.ref || {};
  if (ref.inbox != null) { const m = S.inbox.find(c => c.id === String(ref.inbox)); if (m) return { kind: "inbox", m }; }
  const p = x.project && project(x.project);
  if (p && ref.todo != null && (p.todo || [])[ref.todo]) return { kind: "todo", p, i: +ref.todo };
  return null;
}
const isDone = x => { if (x.done) return true; const l = link(x); return !!l && (l.kind === "inbox" ? l.m.status === "done" : !!l.p.todo[l.i].done); };
const ui = {}; /* które listy „Pozostałe" są rozwinięte — żeby nie zwijały się po każdym kliknięciu */
document.addEventListener("toggle", e => { const k = e.target.dataset && e.target.dataset.keep; if (k) ui[k] = e.target.open; }, true);
const plan = () => ((S.report && S.report.plan) || []).map((x, i) => ({ ...x, i, _d: isDone(x) }));
const alerts = () => ((S.report && S.report.alerts) || []).map((a, i) => ({ ...a, i })).filter(a => !a.done);

M.dzis = { plan, alerts }; /* dla innych modułów, np. odsłuchiwania */

M.panel({
  id: "dzis", label: "Dziś", icon: "dzis", order: 10,
  badge: () => { const n = alerts().filter(a => a.level === "bad").length; return { n, hot: false }; },
  render: () => `<div class="bento">${M.widgets().map(w => w.raw ? w.render(S) : `<section class="card ${w.span || "c12"} ${w.cls || ""}" id="w-${w.id}">${w.render(S)}</section>`).join("")}</div>`,
});

M.widget({ id: "hero", order: 10, span: "c12", cls: "hero", render: () => {
  const pl = plan(), left = pl.filter(x => !x._d), done = pl.length - left.length, C = 2 * Math.PI * 52;
  const d = new Date(), r = S.report, next = left[0];
  return `<div class="ring" role="img" aria-label="Plan dnia: załatwione ${done} z ${pl.length}"><svg viewBox="0 0 120 120"><circle class="t" cx="60" cy="60" r="52"/><circle class="v" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${pl.length ? C * (1 - done / pl.length) : C}"/></svg><div><b>${done}/${pl.length}</b><span>plan dnia</span></div></div>
  <div style="min-width:0"><div class="eyebrow">${esc(d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" }))}</div>
  <h1>${d.getHours() < 18 ? "Dzień dobry" : "Dobry wieczór"}${S.settings.owner ? ", " + esc(S.settings.owner) : ""}</h1>
  <div class="next">${next ? `Następne: <b>${esc(next.text)}</b>` : pl.length ? "Plan dnia załatwiony w całości." : "Plan dnia pojawi się po porannym przebiegu agentów."}</div>
  ${r ? `<div class="meta"><span class="chip">raport z ${esc(fmt(r.generatedAt || r.date))}</span>${left.filter(x => x.prio === "pilne").length ? `<span class="chip bad">${icon("alert")}${left.filter(x => x.prio === "pilne").length} pilne</span>` : ""}</div>` : ""}</div>`;
}});

M.widget({ id: "kpi", order: 20, raw: true, render: () => {
  const pend = S.approvals.filter(a => a.status === "pending").length;
  const bad = alerts().filter(a => a.level === "bad").length;
  const todos = S.projects.reduce((s, p) => s + h.openTodos(p), 0);
  const unas = S.inbox.filter(m => m.status !== "done" && !m.project).length;
  const k = (to, n, label, ic, cls) => `<a class="card c3 kpi ${cls}" href="#${to}">${icon(ic)}<b>${n}</b><span>${label}</span></a>`;
  return k("decyzje", pend, "czeka na Twoją decyzję", "decyzje", pend ? "hot" : "") + k("dzis", bad, "pilne alerty", "alert", bad ? "bad" : "")
    + k("projekty", todos, "otwarte sprawy w projektach", "projekty", "") + k("poczta", unas, "maile bez projektu", "poczta", "");
}});

const planRow = (x, n) => `<div class="todo ${x._d ? "done" : ""}"><input class="check" type="checkbox" data-act="plan-done" data-i="${x.i}" ${x._d ? "checked" : ""} aria-label="Załatwione: ${esc(x.text)}">
  <div style="min-width:0;flex:1"><div class="tx">${x._d ? "" : `<span class="mono muted">${n}. </span>`}${esc(x.text)}</div>${!x._d && x.why ? `<div class="why">${esc(x.why)}</div>` : ""}
  ${x._d ? "" : `<div class="meta">${x.project ? `<a class="chip" href="#projekty/${encodeURIComponent(x.project)}">${esc(x.project)}</a>` : ""}${x.prio === "pilne" ? `<span class="chip bad">${icon("alert")}pilne</span>` : ""}${x.due ? `<span class="chip ${x.due < today() ? "bad" : ""}">do ${esc(fmt(x.due, false))}</span>` : ""}</div>`}</div></div>`;
M.widget({ id: "plan", order: 30, span: "c7", render: () => {
  const pl = plan(), left = pl.filter(x => !x._d), done = pl.filter(x => x._d);
  return `<h2>Plan dnia <span class="mono">· zostało ${left.length}</span></h2>${pl.length ? `<div class="scroll">${left.slice(0, 6).map((x, n) => planRow(x, n + 1)).join("") || '<p class="muted">Wszystko z planu załatwione.</p>'}${left.length > 6 ? `<details class="rest" ${ui.plan ? "open" : ""} data-keep="plan"><summary>Pozostałe (${left.length - 6})</summary>${left.slice(6).map((x, n) => planRow(x, n + 7)).join("")}</details>` : ""}${done.length ? `<details style="margin-top:8px"><summary class="muted" style="cursor:pointer">Załatwione (${done.length})</summary>${done.map(x => planRow(x, 0)).join("")}</details>` : ""}</div>` : '<div class="empty">Brak planu na dziś.</div>'}`;
}});
M.on("plan-done", el => {
  const i = +el.dataset.i, pl = [...S.report.plan], x = pl[i], l = link(x), on = el.checked, at = on ? new Date().toISOString() : null;
  pl[i] = { ...x, done: on, doneAt: at };
  if (l && l.kind === "todo") { const td = [...l.p.todo]; td[l.i] = { ...td[l.i], done: on, doneAt: at }; M.Store.save("projects", l.p.id, { todo: td }); }
  if (l && l.kind === "inbox") M.Store.save("inbox", l.m.id, { status: on ? "done" : "open" });
  M.save("report", "report", { plan: pl }, on ? "Załatwione" : "Przywrócone");
});

const LV = { bad: ["alert", "Pilne"], warn: ["alert", "Uwaga"], info: ["info", "Info"] };
const row = a => { const [ic, lb] = LV[a.level] || LV.warn; return `<div class="alert ${a.level || "warn"}"><span class="lv">${icon(ic)}</span><p><small>${lb}</small>${esc(a.text)}</p><button data-act="alert-done" data-i="${a.i}" aria-label="Ukryj alert" title="Załatwione / nieaktualne">${icon("check")}</button></div>`; };
M.widget({ id: "alerty", order: 40, span: "c5", render: () => {
  const al = alerts().sort((a, b) => "bad warn info".indexOf(a.level || "warn") - "bad warn info".indexOf(b.level || "warn"));
  return `<h2>Alerty <span class="mono">· ${al.length}</span></h2>${al.length ? `<div class="scroll">${al.slice(0, 6).map(row).join("")}${al.length > 6 ? `<details class="rest" ${ui.alerty ? "open" : ""} data-keep="alerty"><summary>Pozostałe (${al.length - 6})</summary>${al.slice(6).map(row).join("")}</details>` : ""}</div>` : '<p class="muted">Brak alertów.</p>'}`;
}});
M.on("alert-done", el => { const al = [...S.report.alerts]; al[+el.dataset.i] = { ...al[+el.dataset.i], done: true, doneAt: new Date().toISOString() }; M.save("report", "report", { alerts: al }, "Alert ukryty"); });

M.widget({ id: "poczta21", order: 50, span: "c7", render: () => {
  const days = 21, last = S.inbox.reduce((m, x) => (x.date > m ? x.date : m), ""), end = toDate((last || today()).slice(0, 10));
  const by = {}; S.inbox.forEach(m => { const k = String(m.date || "").slice(0, 10); by[k] = (by[k] || 0) + 1; });
  const pts = Array.from({ length: days }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (days - 1 - i)); const k = iso(d); return { k, d, n: by[k] || 0 }; });
  const max = Math.max(1, ...pts.map(p => p.n)), w7 = pts.slice(-7).reduce((s, p) => s + p.n, 0);
  const open = S.inbox.filter(m => m.status !== "done").length, imp = S.inbox.filter(m => m.status !== "done" && m.flag).length;
  return `<h2>Poczta — karty z ostatnich ${days} dni <a class="more" href="#poczta">otwórz pocztę</a></h2>
  <div class="statline"><div><b>${w7}</b><span>kart w 7 dni</span></div><div><b>${open}</b><span>otwartych</span></div><div><b>${imp}</b><span>ważnych otwartych</span></div></div>
  <div class="bars" role="img" aria-label="Liczba kart poczty na dzień">${pts.map(p => `<div class="b ${[0, 6].includes(p.d.getDay()) ? "we" : ""}" data-tip="${esc(p.d.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" }))}" data-tipv="${p.n}"><i style="height:${Math.round(p.n / max * 100)}%"></i></div>`).join("")}</div>
  <div class="axis"><span>${esc(fmt(pts[0].k, false))}</span><span>${esc(fmt(pts[Math.floor(days / 2)].k, false))}</span><span>${esc(fmt(pts[days - 1].k, false))}</span></div>`;
}});

M.widget({ id: "lejek", order: 60, span: "c5", render: () => {
  const act = S.projects.filter(p => p.status !== "zamknięty"), rows = STAGES.map(s => [s, act.filter(p => p.status === s).length]).filter(r => r[1]);
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<h2>Projekty wg etapu <span class="mono">· ${act.length}</span><a class="more" href="#projekty">tablica</a></h2><div class="funnel">${rows.map(([s, n]) => `<a href="#projekty" data-tip="${esc(s)}" data-tipv="${n}"><span>${esc(s)}</span><span class="tr"><i style="width:${Math.round(n / max * 100)}%"></i></span><b>${n}</b></a>`).join("")}</div>`;
}});

M.widget({ id: "agenci", order: 70, span: "c12", render: () => {
  const ms = [...S.modules].sort((a, b) => (a.order || 99) - (b.order || 99));
  return `<h2>Agenci <span class="mono">· ${ms.filter(m => m.enabled).length}/${ms.length} włączonych</span><a class="more" href="#agenci">szczegóły</a></h2><div class="agents">${ms.map(m => `<a class="agent" href="#agenci"><b><span class="dot ${!m.enabled ? "off" : m.lastRun ? "on" : "idle"}"></span>${esc(m.name)}</b><span>${m.lastRun ? "ostatnio " + esc(fmt(m.lastRun)) : m.enabled ? "czeka na przebieg" : "wyłączony"}</span></a>`).join("")}</div>`;
}});

M.widget({ id: "polecenie", order: 80, span: "c12", render: () => {
  const q = S.tasks.filter(t => t.status !== "done");
  return `<h2>Polecenie dla agentów</h2><div class="cmd"><input id="task-in" placeholder="np. znajdź atesty HEB200 z marca do ST-26.007" aria-label="Treść polecenia"><select id="task-mod" aria-label="Moduł">${S.modules.map(m => `<option value="${esc(m.key)}">${esc(m.name)}</option>`).join("")}</select><button class="btn primary" data-act="task-add">Zleć ${icon("arrow")}</button></div>
  ${q.length ? `<div class="meta" style="margin-top:12px">${q.map(t => `<span class="chip acc" data-tip="${esc(t.text)}">${esc(t.module || "")} · ${t.status === "running" ? "w toku" : "w kolejce"}</span>`).join("")}</div>` : ""}`;
}});
M.on("task-add", () => { const v = document.getElementById("task-in").value.trim(); if (!v) return M.toast("Wpisz treść polecenia"); M.save("tasks", null, { text: v, module: document.getElementById("task-mod").value, status: "queued", requestedBy: M.who() + " (panel)" }, "Polecenie dodane do kolejki"); });
})();
