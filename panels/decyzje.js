/* Panel „Decyzje" — nic nie wychodzi z systemu bez akceptacji. */
(() => {
const { S, h } = M, { esc, icon, fmt } = h;
const f = { view: "pending" };
const LBL = { pending: "Czekające", approved: "Zatwierdzone", fix: "Do poprawy", rejected: "Odrzucone", done: "Wykonane", all: "Wszystkie" };
const TONE = { approved: "ok", done: "ok", rejected: "bad", fix: "acc", pending: "acc" };

M.panel({
  id: "decyzje", label: "Decyzje", icon: "decyzje", order: 20,
  badge: () => ({ n: S.approvals.filter(a => a.status === "pending").length, hot: true }),
  render: () => {
    const ls = S.approvals.filter(a => f.view === "all" || a.status === f.view).sort((a, b) => String(b.createdAt || b.created || "").localeCompare(String(a.createdAt || a.created || "")));
    return `<div class="head"><div><h1>Decyzje</h1><p>Oferta, mail, zapytanie do przewoźnika, nowy wiersz w arkuszu — agent przygotowuje szkic, a wykonuje dopiero po Twoim „Zatwierdź”.</p></div></div>
    <div class="tools"><div class="seg" role="group" aria-label="Status">${Object.entries(LBL).map(([v, l]) => `<button data-act="ap-view" data-v="${v}" aria-pressed="${f.view === v}">${l} <span class="mono muted">${S.approvals.filter(a => v === "all" || a.status === v).length}</span></button>`).join("")}</div></div>
    ${ls.length ? `<div class="list">${ls.map(a => `<article class="card">
      <div class="meta" style="margin:0 0 8px"><span class="chip">${esc(a.type || "szkic")}</span>${a.project ? `<a class="chip info" href="#projekty/${encodeURIComponent(a.project)}">${esc(a.project)}</a>` : ""}<span class="chip ${TONE[a.status] || ""}">${esc(LBL[a.status] || a.status)}</span><span class="mono muted" style="margin-left:auto;font-size:12px">${esc(fmt(a.createdAt || a.created))}</span></div>
      <div style="font-weight:600;font-size:17px">${esc(a.title)}</div>
      ${a.to ? `<div class="muted" style="margin-top:2px">Do: <span class="mono">${esc(a.to)}</span>${a.subject ? " · " + esc(a.subject) : ""}</div>` : ""}
      ${a.summary ? `<p style="margin:8px 0 0">${esc(a.summary)}</p>` : ""}
      ${a.draft ? `<details ${a.status === "pending" ? "open" : ""}><summary class="muted" style="cursor:pointer;margin-top:8px">Szkic</summary><div class="draft">${esc(a.draft)}</div></details>` : ""}
      ${(a.attachments || []).length ? `<div class="meta">${[].concat(a.attachments).map(x => `<span class="chip">${icon("clip")}${esc(x)}</span>`).join("")}</div>` : ""}
      ${a.status === "pending" ? `<textarea id="note-${esc(a.id)}" placeholder="Uwagi dla agenta (opcjonalnie)" style="width:100%;margin-top:12px;min-height:56px">${esc(a.note || "")}</textarea>
        <div class="meta" style="margin-top:10px"><button class="btn primary" data-act="ap" data-s="approved" data-id="${esc(a.id)}">${icon("check")}Zatwierdź</button><button class="btn" data-act="ap" data-s="fix" data-id="${esc(a.id)}">Popraw wg uwag</button><button class="btn danger" data-act="ap" data-s="rejected" data-id="${esc(a.id)}">Odrzuć</button></div>`
      : `${a.note ? `<p class="muted" style="margin:10px 0 0">Uwagi: ${esc(a.note)}</p>` : ""}${a.result ? `<p style="margin:6px 0 0"><span class="chip ok">${icon("check")}wynik</span> ${esc(a.result)}</p>` : ""}`}
    </article>`).join("")}</div>` : `<div class="empty">${f.view === "pending" ? "Nic nie czeka na Twoją decyzję." : "Brak pozycji w tym widoku."}</div>`}`;
  },
});
M.on("ap-view", el => { f.view = el.dataset.v; M.refresh(); });
M.on("ap", el => { const id = el.dataset.id, s = el.dataset.s, note = (document.getElementById("note-" + id) || {}).value || "";
  if (s === "fix" && !note.trim()) return M.toast("Wpisz uwagi, co poprawić");
  M.save("approvals", id, { status: s, note: note.trim(), decidedAt: new Date().toISOString() }, s === "approved" ? "Zatwierdzone — agent wykona przy następnym przebiegu" : s === "fix" ? "Odesłane do poprawy" : "Odrzucone"); });
})();
