/* Panel „Poczta" — karty maili posortowane przez router, do szybkiego przeglądu i przypisania. */
(() => {
const { S, h } = M, { esc, icon, fmt, sender } = h;
const f = { view: "open", cat: "", q: "", limit: 40 };
const VIEWS = [["open", "Otwarte"], ["flag", "Ważne"], ["unas", "Bez projektu"], ["all", "Wszystkie"]];
const inView = (m, v) => v === "all" || (m.status !== "done" && (v === "open" || (v === "flag" ? !!m.flag : !m.project)));
const list = () => S.inbox.filter(m => inView(m, f.view) && (!f.cat || m.category === f.cat) && (!f.q || `${m.subject} ${m.from} ${m.summary} ${m.project}`.toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => String(b.date).localeCompare(String(a.date)));

M.panel({
  id: "poczta", label: "Poczta", icon: "poczta", order: 40,
  badge: () => ({ n: S.inbox.filter(m => m.status !== "done" && !m.project).length }),
  render: () => {
    const ms = list(), base = S.inbox.filter(m => inView(m, f.view)), cats = {};
    base.forEach(m => (cats[m.category || "inne"] = (cats[m.category || "inne"] || 0) + 1));
    const opts = S.projects.filter(p => p.status !== "zamknięty").map(p => `<option value="${esc(p.nr || p.id)}">${esc(p.nr || p.id)} ${esc(p.client)}</option>`).join("");
    return `<div class="head"><div><h1>Poczta</h1><p>Router czyta Thunderbirda, streszcza każdy wątek i proponuje akcję. Przypisz projekt albo oznacz jako załatwione.</p></div></div>
    <div class="tools"><div class="seg" role="group" aria-label="Widok">${VIEWS.map(([v, l]) => `<button data-act="mf-view" data-v="${v}" aria-pressed="${f.view === v}">${l} <span class="mono muted">${S.inbox.filter(m => inView(m, v)).length}</span></button>`).join("")}</div>
      <input id="mf-q" data-input="mf-q" placeholder="Szukaj w poczcie" value="${esc(f.q)}" aria-label="Szukaj w poczcie"></div>
    <div class="chips" style="margin-bottom:16px"><button class="chip ${f.cat ? "" : "on"}" data-act="mf-cat" data-v="">wszystkie kategorie</button>${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<button class="chip ${f.cat === c ? "on" : ""}" data-act="mf-cat" data-v="${esc(c)}">${esc(c)} ${n}</button>`).join("")}</div>
    ${ms.length ? `<div class="list">${ms.slice(0, f.limit).map(m => `<article class="card mail ${m.flag && m.status !== "done" ? "flag" : ""}">
      <div style="min-width:0"><div class="s">${esc(m.subject)}</div><div class="f">${esc(sender(m.from))}</div></div><div class="d">${esc(fmt(m.date))}</div>
      ${m.summary ? `<p>${esc(m.summary)}</p>` : ""}
      <div class="meta"><span class="chip">${esc(m.category || "inne")}</span>${m.flag ? `<span class="chip bad">${icon("flag")}ważne</span>` : ""}${m.action ? `<span class="chip acc" style="white-space:normal">${icon("arrow")}${esc(m.action)}</span>` : ""}${m.attachments ? `<span class="chip">${icon("clip")}${esc(m.attachments)}</span>` : ""}
        <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center">${m.project ? `<a class="chip info" href="#projekty/${encodeURIComponent(m.project)}">${esc(m.project)}</a>` : `<select data-act="m-proj" data-id="${esc(m.id)}" aria-label="Przypisz projekt" style="padding:4px 8px;font-size:12.5px;max-width:190px"><option value="">— przypisz projekt —</option>${opts}</select>`}
        ${m.status !== "done" ? `<button class="btn sm" data-act="m-done" data-id="${esc(m.id)}">${icon("check")}Załatwione</button>` : `<span class="chip ok">${icon("check")}załatwione</span>`}</span></div>
    </article>`).join("")}</div>${ms.length > f.limit ? `<p style="text-align:center;margin-top:16px"><button class="btn" data-act="mf-more">Pokaż kolejne (${ms.length - f.limit})</button></p>` : ""}` : '<div class="empty">Brak maili w tym widoku.</div>'}`;
  },
  search: (t, hit) => S.inbox.filter(m => t && hit(`${m.subject} ${m.from}`)).sort((a, b) => String(b.date).localeCompare(String(a.date))).map(m => ({ grp: "Poczta", icon: "poczta", text: m.subject, hint: fmt(m.date, false), run: () => { f.view = "all"; f.cat = ""; f.q = m.subject; M.go("poczta"); } })),
});
M.on("mf-view", el => { f.view = el.dataset.v; f.cat = ""; f.limit = 40; M.refresh(); });
M.on("mf-cat", el => { f.cat = el.dataset.v; f.limit = 40; M.refresh(); });
M.on("mf-more", () => { f.limit += 40; M.refresh(); });
M.onInput("mf-q", el => { f.q = el.value; f.limit = 40; clearTimeout(f.t); f.t = setTimeout(M.refresh, 180); });
M.on("m-done", el => M.save("inbox", el.dataset.id, { status: "done", closedBy: M.who() }, "Oznaczone jako załatwione"));
M.on("m-proj", el => el.value && M.save("inbox", el.dataset.id, { project: el.value, assignedBy: M.who() }, "Przypisano — agent przeniesie pliki"));
})();
