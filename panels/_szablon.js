/* WZÓR NOWEGO PANELU — skopiuj ten plik pod nową nazwą (np. finanse.js),
   dopisz nazwę do panels.json i gotowe. Rdzenia (app.js) nie trzeba ruszać.

   M.S          — dane: M.S.projects, inbox, approvals, trucks, carriers, modules, tasks, report
   M.save(kolekcja, id, {pola}, "komunikat")  — zapis (id = null tworzy nowy dokument)
   M.h          — pomocnicze: esc, icon, fmt, rel, pln, today, project, openTodos
   M.on(nazwa, fn)      — obsługa kliknięcia/zmiany elementu z data-act="nazwa"
   M.widget({...})      — kafelek na ekranie „Dziś" (span: c3/c4/c5/c6/c7/c8/c12) */
(() => {
const { S, h } = M, { esc, pln } = h;

M.panel({
  id: "przyklad",            // adres: #przyklad
  label: "Przykład",         // nazwa w menu
  icon: "info",              // id symbolu z index.html (i-info, i-alert, i-zboze…)
  order: 70,                 // kolejność w menu
  badge: () => ({ n: 0 }),   // licznik przy nazwie (hot:true = pomarańczowy)
  render: () => `<div class="head"><div><h1>Przykład</h1><p>Opis panelu.</p></div></div>
    <div class="bento"><section class="card c6"><h2>Kafelek</h2>
      <p>Projektów w bazie: <b>${S.projects.length}</b></p>
      <button class="btn primary" data-act="przyklad-klik">Kliknij</button></section></div>`,
  search: (t, hit) => [],    // (opcjonalnie) wyniki do wyszukiwarki Ctrl+K
});
M.on("przyklad-klik", () => M.toast("Działa"));

M.widget({ id: "przyklad", order: 90, span: "c4", render: () => `<h2>Mój kafelek</h2><p class="muted">Treść ${esc("bezpiecznie")} ${pln(1000)}</p>` });
})();
