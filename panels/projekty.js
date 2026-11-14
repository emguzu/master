/* Panel „Projekty" — tablica etapów, lista i szuflada projektu (#projekty/<nr>). */
(() => {
const { S, h } = M, { esc, icon, fmt, rel, pln, today, project, openTodos, sender } = h;
const ST = ["zapytanie", "oferta", "zamówienie", "projekt", "produkcja", "realizacja", "wysyłka", "faktura", "rozliczenie", "gwarancja", "zamknięty"];
const ZB = ["kontrakt", "transport", "w realizacji", "dokumenty", "faktura", "rozliczenie", "zamknięty"];
const ALL = [...new Set([...ST.slice(0, 6), ...ZB.slice(0, 3), ...ST.slice(6, 7), ...ZB.slice(3), ...ST.slice(7)])];
const stages = p => (p.line === "ZBOZE" ? ZB : ST);
const f = { line: "", q: "", mode: "board", closed: false };
const W = { wysoka: 3, normalna: 2, niska: 1 };
const rank = (a, b) => (W[b.waga] || 2) - (W[a.waga] || 2) || openTodos(b) - openTodos(a) || String(b.lastMail || "").localeCompare(String(a.lastMail || ""));
const list = () => S.projects.filter(p => (!f.line || p.line === f.line) && (f.closed || p.status !== "zamknięty") && (!f.q || `${p.nr} ${p.client} ${p.name}`.toLowerCase().includes(f.q.toLowerCase()))).sort(rank);

const card = p => { const n = openTodos(p), late = (p.todo || []).some(t => !t.done && t.due && t.due < today());
  return `<a class="pcard ${p.waga === "wysoka" ? "hi" : ""}" href="#projekty/${encodeURIComponent(p.id)}"><span class="r1">${esc(p.nr || p.id)}${n ? `<span class="chip ${late ? "bad" : "acc"}">${n} ${n === 1 ? "sprawa" : n < 5 ? "sprawy" : "spraw"}</span>` : ""}</span><strong>${esc(p.client)}</strong><em>${esc(p.name)}</em><span class="r3"><span>${icon("poczta").replace('class="i"', 'class="i" style="width:13px;height:13px;vertical-align:-2px"')} ${esc(rel(p.lastMail)) || "—"}</span>${p.value ? `<span class="mono">${pln(p.value)}</span>` : ""}</span></a>`; };

M.panel({
  id: "projekty", label: "Projekty", icon: "projekty", order: 30,
  badge: () => ({ n: S.projects.filter(p => p.status !== "zamknięty").length }),
  render: () => {
    const ps = list(), cols = ALL.filter(s => ps.some(p => p.status === s));
    return `<div class="head"><div><h1>Projekty</h1><p>${ps.length} aktywnych · ${ps.reduce((s, p) => s + openTodos(p), 0)} otwartych spraw. Pomarańczowa krawędź = waga wysoka.</p></div></div>
    <div class="tools"><div class="seg" role="group" aria-label="Linia">${[["", "Wszystko"], ["STAL", "Stal"], ["ZBOZE", "Zboże"]].map(([v, l]) => `<button data-act="pf-line" data-v="${v}" aria-pressed="${f.line === v}">${l}</button>`).join("")}</div>
      <input id="pf-q" data-input="pf-q" placeholder="Szukaj: numer, klient, nazwa" value="${esc(f.q)}" aria-label="Szukaj projektu">
      <div class="seg" role="group" aria-label="Widok" style="margin-left:auto">${[["board", "Tablica"], ["list", "Lista"]].map(([v, l]) => `<button data-act="pf-mode" data-v="${v}" aria-pressed="${f.mode === v}">${l}</button>`).join("")}</div></div>
    ${!ps.length ? '<div class="empty">Brak projektów dla tego filtra.</div>' : f.mode === "board"
      ? `<div class="board">${cols.map(s => { const c = ps.filter(p => p.status === s); return `<section class="col"><header>${esc(s)}<span>${c.length}</span></header><div class="stack">${c.map(card).join("")}</div></section>`; }).join("")}</div>`
      : `<div class="card tablewrap"><table class="table"><thead><tr><th>Nr</th><th>Klient</th><th>Nazwa</th><th>Etap</th><th>Sprawy</th><th>Ostatni mail</th></tr></thead><tbody>${ps.map(p => `<tr data-act="go" data-to="projekty/${encodeURIComponent(p.id)}"><td class="mono">${esc(p.nr || p.id)}</td><td><b>${esc(p.client)}</b></td><td>${esc(p.name)}</td><td><span class="chip">${esc(p.status)}</span></td><td>${openTodos(p) ? `<span class="chip acc">${openTodos(p)}</span>` : '<span class="muted">—</span>'}</td><td class="mono muted">${esc(rel(p.lastMail))}</td></tr>`).join("")}</tbody></table></div>`}`;
  },
  overlay: (_, arg) => (arg ? drawer(arg) : ""),
  search: (t, hit) => S.projects.filter(p => t && hit(`${p.nr} ${p.client} ${p.name}`)).sort(rank).map(p => ({ grp: "Projekty", icon: "projekty", text: `${p.client} — ${p.name}`, hint: p.nr, go: "projekty/" + encodeURIComponent(p.id) })),
});
M.on("pf-line", el => { f.line = el.dataset.v; M.refresh(); });
M.on("pf-mode", el => { f.mode = el.dataset.v; M.refresh(); });
M.onInput("pf-q", el => { f.q = el.value; clearTimeout(f.t); f.t = setTimeout(M.refresh, 180); });

function drawer(ref) {
  const p = project(ref);
  if (!p) return `<div class="scrim" data-act="go" data-to="projekty"></div><aside class="drawer"><div class="body"><div class="empty">Nie ma takiego projektu.</div></div></aside>`;
  const st = stages(p), si = st.indexOf(p.status);
  const todo = (p.todo || []).map((x, i) => ({ ...x, i })).sort((a, b) => (!!a.done - !!b.done) || String(a.due || "9").localeCompare(String(b.due || "9")));
  const open = todo.filter(x => !x.done), done = todo.filter(x => x.done);
  const mails = S.inbox.filter(m => m.project === p.nr || m.project === p.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const row = x => `<div class="todo ${x.done ? "done" : ""}"><input class="check" type="checkbox" data-act="todo" data-id="${esc(p.id)}" data-i="${x.i}" ${x.done ? "checked" : ""} aria-label="Załatwione"><div style="min-width:0;flex:1"><div class="tx">${esc(x.text)}</div>${x.done && x.doneNote ? `<div class="why">${esc(x.doneNote)}</div>` : ""}${x.done ? "" : `<div class="meta">${x.prio === "pilne" ? `<span class="chip bad">${icon("alert")}pilne</span>` : ""}${x.due ? `<span class="chip ${x.due < today() ? "bad" : ""}">do ${esc(fmt(x.due, false))}</span>` : ""}${x.source ? `<span class="muted" style="font-size:12px">${esc(x.source)}</span>` : ""}</div>`}</div></div>`;
  return `<div class="scrim" data-act="go" data-to="projekty"></div>
  <aside class="drawer" role="dialog" aria-label="Projekt ${esc(p.nr)}"><header>
    <div class="r"><span class="chip mono">${esc(p.nr || p.id)}</span>${p.waga === "wysoka" ? `<span class="chip acc">${icon("flag")}waga wysoka</span>` : ""}<span class="chip">${esc(p.line === "ZBOZE" ? "zboże" : "stal")}</span><button class="icon-btn" style="margin-left:auto" data-act="go" data-to="projekty" aria-label="Zamknij">${icon("x")}</button></div>
    <h1>${esc(p.name)}</h1><div class="muted" style="margin-top:4px">${esc(p.client)}${p.contact ? ` · <span class="mono" style="user-select:all">${esc(p.contact)}</span>` : ""}</div>
    <div class="steps" role="img" aria-label="Etap: ${esc(p.status)}">${st.slice(0, -1).map((_, i) => `<i class="${i <= si ? "d" : ""}"></i>`).join("")}</div>
    <div class="steps-l"><span>${esc(st[0])}</span><span style="color:var(--accent)">${esc(p.status)}</span><span>${esc(st[st.length - 2])}</span></div>
  </header><div class="body">
    ${p.summary ? `<section><h2>Stan ${p.analysisAt ? `<span class="mono" style="letter-spacing:0;text-transform:none">· analiza ${esc(fmt(p.analysisAt))}</span>` : ""}</h2><div>${esc(p.summary)}</div>${p.hint ? `<div class="muted" style="margin-top:6px">${esc(p.hint)}</div>` : ""}</section>` : ""}
    <section><h2>Do załatwienia <span class="mono">· ${open.length}</span></h2>${open.map(row).join("") || '<p class="muted" style="margin:0">Brak otwartych spraw.</p>'}
      <div class="cmd" style="margin-top:12px"><input id="todo-in" placeholder="Dodaj sprawę" aria-label="Nowa sprawa"><input id="todo-due" type="date" aria-label="Termin" style="flex:0 0 150px"><button class="btn" data-act="todo-add" data-id="${esc(p.id)}">Dodaj</button></div>
      ${done.length ? `<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">Załatwione (${done.length})</summary>${done.map(row).join("")}</details>` : ""}</section>
    <section><h2>Wiadomości <span class="mono">· ${mails.length}</span></h2>${mails.slice(0, 20).map(m => `<div class="mailrow"><div style="display:flex;gap:10px;align-items:baseline"><span class="s" style="flex:1;min-width:0">${esc(m.subject)}</span><span class="mono muted" style="font-size:12px;white-space:nowrap">${esc(fmt(m.date))}</span></div><div class="muted" style="font-size:12.5px">${esc(sender(m.from))}</div>${m.summary ? `<p>${esc(m.summary)}</p>` : ""}</div>`).join("") || `<p class="muted" style="margin:0">Brak przypisanych maili.${p.lastMail ? " Ostatni mail w wątku: " + esc(fmt(p.lastMail)) + "." : ""}</p>`}${mails.length > 20 ? `<p class="muted">…i ${mails.length - 20} starszych</p>` : ""}</section>
    <section><h2>Dane</h2><dl class="facts">${[["Wartość", p.value ? pln(p.value) : ""], ["Koszt plan", p.costPlan ? pln(p.costPlan) : ""], ["Zafakturowano", p.invoiced ? pln(p.invoiced) : ""], ["Folder", p.folder], ["Notatka", p.note], ["Agent", p.agentNote]].filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>
  </div></aside>`;
}
M.on("todo", el => { const p = project(el.dataset.id), td = [...(p.todo || [])], i = +el.dataset.i; td[i] = { ...td[i], done: el.checked, doneAt: el.checked ? new Date().toISOString() : null }; M.save("projects", p.id, { todo: td }, el.checked ? "Załatwione" : "Przywrócone"); });
M.on("todo-add", el => { const v = document.getElementById("todo-in").value.trim(); if (!v) return M.toast("Wpisz sprawę"); const p = project(el.dataset.id); M.save("projects", p.id, { todo: [...(p.todo || []), { text: v, due: document.getElementById("todo-due").value || null, done: false, source: M.who(), at: new Date().toISOString() }] }, "Dodano"); });
})();
