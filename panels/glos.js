/* Moduł „Głos" — czyta na głos plan dnia i alerty (np. w samochodzie).
   Używa syntezatora mowy wbudowanego w przeglądarkę/telefon: bez internetu, bez kosztów. */
(() => {
const { S, h } = M, { esc, icon } = h;
M.icons({ play: '<path d="M7 4.5v15l12-7.5z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>' });
const synth = window.speechSynthesis;
const st = { on: "" };
const clean = t => String(t || "").replace(/[–—]/g, ", ").replace(/\bzł\b/g, "złotych").replace(/\bt\b/g, "ton").replace(/\bws\./g, "w sprawie").replace(/[„”"]/g, "");

function speak(kind, lines) {
  if (!synth) return M.toast("Ta przeglądarka nie obsługuje czytania na głos");
  synth.cancel();
  const voice = synth.getVoices().find(v => /^pl/i.test(v.lang));
  st.on = kind; M.refresh();
  lines.forEach((t, i) => { const u = new SpeechSynthesisUtterance(clean(t)); u.lang = "pl-PL"; if (voice) u.voice = voice; u.rate = 1;
    if (i === lines.length - 1) u.onend = u.onerror = () => { st.on = ""; M.refresh(); };
    synth.speak(u); });
}
const planLines = () => { const left = M.dzis.plan().filter(x => !x._d);
  return left.length ? [`Plan dnia. Zostało ${left.length} ${left.length === 1 ? "sprawa" : "spraw"}.`, ...left.map((x, i) => `${i + 1}. ${x.prio === "pilne" ? "Pilne. " : ""}${x.text}.`), "Koniec planu."] : ["Plan dnia jest załatwiony w całości."]; };
const alertLines = () => { const al = M.dzis.alerts().filter(a => a.level === "bad");
  return al.length ? [`Pilne alerty: ${al.length}.`, ...al.map((a, i) => `${i + 1}. ${a.text}`), "Koniec alertów."] : ["Nie ma pilnych alertów."]; };
const todoLines = () => { const rows = S.projects.flatMap(p => (p.todo || []).filter(t => !t.done && t.prio === "pilne").map(t => `${p.client}: ${t.text}`));
  return rows.length ? [`Pilne sprawy w projektach: ${rows.length}.`, ...rows.map((t, i) => `${i + 1}. ${t}`), "Koniec."] : ["Nie ma pilnych spraw w projektach."]; };

M.widget({ id: "glos", order: 15, span: "c12", render: () => {
  const b = (kind, label) => `<button class="btn ${st.on === kind ? "primary" : ""}" data-act="glos" data-k="${kind}">${icon(st.on === kind ? "stop" : "play")}${label}</button>`;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><h2 style="margin:0 8px 0 0">Odsłuchaj</h2>${synth ? b("plan", "Plan dnia") + b("alerty", "Pilne alerty") + b("sprawy", "Pilne sprawy projektów") : '<span class="muted">Czytanie na głos nie jest dostępne w tej przeglądarce.</span>'}</div>`;
}});
M.on("glos", el => { const k = el.dataset.k; if (st.on === k) { synth.cancel(); st.on = ""; return M.refresh(); }
  speak(k, k === "plan" ? planLines() : k === "alerty" ? alertLines() : todoLines()); });
if (synth) synth.getVoices(); /* iOS/Chrome ładują listę głosów z opóźnieniem */
})();
