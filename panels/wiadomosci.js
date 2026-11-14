/* Panel „Napisz" — wiadomość jednym zdaniem:
     „wyślij wiadomość do Jana Kowalskiego i napisz, że auta będą w czwartek, załącz awizację"
   Panel sam rozpoznaje odbiorcę (z kontaktów), kanał, treść i załącznik; Ty tylko potwierdzasz.
   - WhatsApp / SMS / poczta telefonu: otwiera aplikację z gotową treścią (jedno dotknięcie).
   - E-mail przez MASTER: zatwierdzona pozycja w kolejce — agent poczty wysyła z firmowej skrzynki
     i dołącza plik opisany w „załącz …" z folderu projektu.
   Historia: kolekcja `messages`. */
(() => {
const { S, h } = M, { esc, icon, fmt } = h;
M.icons({ send: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>' });
const f = { name: "", email: "", phone: "", project: "", subject: "", text: "", attach: "", channel: "" };
const ui = { cmd: "", note: "", picks: [], listening: "" };
const SR = window.SpeechRecognition || window.webkitSpeechRecognition, synth = window.speechSynthesis;
const CH = { wa: "WhatsApp", sms: "SMS", mail: "E-mail przez MASTER", mailto: "E-mail z telefonu" };
let rec = null;

/* ---------- kontakty i dopasowanie nazwiska (odmiana: „do Justyny" = „Justyna") ---------- */
function contacts() {
  const out = [], seen = new Set();
  const add = (name, email, phone, src, project) => { const k = String(email || phone || name).toLowerCase(); if (!name || seen.has(k)) return; seen.add(k); out.push({ name, email: email || "", phone: phone || "", src, project: project || "" }); };
  S.carriers.forEach(c => add(c.contact ? `${c.contact} (${c.name})` : c.name, c.email, c.phone, "przewoźnik"));
  S.trucks.forEach(t => add(t.driver, "", t.phone, "kierowca", t.project));
  S.projects.forEach(p => /@/.test(p.contact || "") && add(`${p.client} (${p.nr})`, p.contact, "", "projekt", p.nr));
  return out;
}
const norm = s => String(s || "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "");
const toks = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
const alike = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n >= Math.max(3, Math.min(a.length, b.length) - 3); };
function findContacts(q) {
  const qs = toks(q); let best = [], top = 0;
  for (const c of contacts()) { const cs = toks(c.name); const s = qs.filter(a => cs.some(b => alike(a, b))).length; if (s > top) { top = s; best = [c]; } else if (s && s === top) best.push(c); }
  return best;
}

/* ---------- rozbiór polecenia ---------- */
function parse(raw) {
  const t = raw.trim().replace(/\s+/g, " "), n = norm(t);
  const m = n.match(/^(?:prosze\s+)?(?:wyslij|wysli|napisz)\s+(?:(e-?maila?|maila?|sms-?a?|whatsapp\w*|wiadomosc)\s+)?(?:(?:na|przez)\s+(whatsapp\w*|sms\w*|e-?maila?|maila?)\s+)?do\s+(.+?)[,.]?\s+(?:i\s+)?(?:napisz|tresc|o tresci|ze)\b[:,]?\s*(.*)$/d);
  if (!m) return null;
  const who = t.slice(...m.indices[3]); let body = t.slice(m.indices[4][0]).replace(/^(że|ze)\s+/i, "").replace(/^,\s*/, "");
  let attach = ""; const a = norm(body).match(/[,.]?\s+(?:i\s+)?(?:zalacz|dolacz|z zalacznikiem|w zalaczniku)\s+(.+)$/);
  if (a) { attach = body.slice(a.index + a[0].length - a[1].length).replace(/[.\s]+$/, ""); body = body.slice(0, a.index); }
  body = body.trim().replace(/^./, c => c.toUpperCase()); if (body && !/[.!?]$/.test(body)) body += ".";
  const w = (m[1] || "") + " " + (m[2] || "");
  return { who, text: body, attach, channel: /whats/.test(w) ? "wa" : /sms/.test(w) ? "sms" : /mail/.test(w) ? "mail" : "" };
}
function setContact(c) { f.name = c.name; f.email = c.email; f.phone = c.phone; if (c.project) f.project = c.project; ui.picks = []; fixChannel(); }
function fixChannel() { /* załącznik idzie tylko e-mailem przez MASTER; bez telefonu nie ma WhatsAppa */
  if (f.attach && f.email) f.channel = "mail";
  else if (!f.channel || ((f.channel === "wa" || f.channel === "sms") && !f.phone) || (f.channel === "mail" && !f.email)) f.channel = f.phone ? "wa" : f.email ? "mail" : "";
}
function run(raw) {
  const p = parse(raw); ui.picks = []; ui.note = "";
  if (!p) { ui.note = "Nie rozpoznałem polecenia. Powiedz np.: „wyślij wiadomość do Jana Kowalskiego i napisz, że auta będą w czwartek”."; return say("Nie rozumiem polecenia."), M.refresh(); }
  Object.assign(f, { name: p.who, email: "", phone: "", text: p.text, attach: p.attach, channel: p.channel, subject: "" });
  const hits = findContacts(p.who);
  if (hits.length === 1) setContact(hits[0]);
  else if (hits.length) { ui.picks = hits.slice(0, 6); ui.note = `Kilka kontaktów pasuje do „${p.who}” — wybierz właściwy.`; }
  else ui.note = `Nie znam kontaktu „${p.who}” — wpisz e-mail albo telefon.`;
  ui.cmd = ""; M.refresh();
  if (hits.length === 1) say(`${CH[f.channel] || "Wiadomość"} do: ${f.name.replace(/\(.*?\)/g, "")}. Treść: ${f.text}${f.attach ? " Załącznik: " + f.attach + "." : ""} ${f.channel === "mail" ? "Wysłać?" : "Dotknij Wyślij."}`, f.channel === "mail" ? confirmByVoice : null);
  else say(ui.note);
}
function say(t, then) { if (!synth) return then && then(); synth.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[„”]/g, "")); u.lang = "pl-PL"; const v = synth.getVoices().find(x => /^pl/i.test(x.lang)); if (v) u.voice = v; if (then) u.onend = then; synth.speak(u); }
function listen(kind, onText) {
  if (!SR) return M.toast("Ta przeglądarka nie obsługuje dyktowania — użyj mikrofonu na klawiaturze");
  if (rec) { rec.stop(); return; }
  if (synth) synth.cancel();
  rec = new SR(); rec.lang = "pl-PL"; rec.continuous = kind === "text"; rec.interimResults = false; ui.listening = kind;
  rec.onresult = e => { let s = ""; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) s += e.results[i][0].transcript + " "; if (s.trim()) onText(s.trim()); };
  rec.onerror = e => { if (e.error !== "no-speech" && e.error !== "aborted") M.toast(e.error === "not-allowed" ? "Brak zgody na mikrofon" : "Dyktowanie przerwane"); };
  rec.onend = () => { rec = null; ui.listening = ""; M.refresh(); };
  rec.start(); M.refresh();
}
const confirmByVoice = () => SR && listen("confirm", t => { const n = norm(t); if (/\b(tak|wyslij|potwierdzam|wysylaj)\b/.test(n)) send("mail"); else if (/\b(nie|anuluj|stop)\b/.test(n)) { M.toast("Anulowano — wiadomość czeka w formularzu"); } });

/* ---------- wysyłka ---------- */
const digits = p => { const d = String(p || "").replace(/\D/g, ""); return d.length === 9 ? "48" + d : d; };
const need = (...keys) => { const miss = keys.find(k => !String(f[k]).trim()); if (miss) M.toast({ text: "Podyktuj albo wpisz treść", email: "Podaj adres e-mail", phone: "Podaj numer telefonu" }[miss]); return !miss; };
const log = (channel, status) => M.Store.save("messages", null, { channel, to: channel === "mail" || channel === "mailto" ? f.email : f.phone, name: f.name, subject: f.subject, text: f.text, attach: f.attach || null, project: f.project || null, status, at: new Date().toISOString() });
const done = msg => { Object.assign(f, { text: "", subject: "", attach: "", channel: "" }); ui.note = ""; M.toast(msg); M.refresh(); };
function send(c) {
  const text = encodeURIComponent(f.text);
  if (c === "wa") { if (!need("text", "phone")) return; window.open(`https://wa.me/${digits(f.phone)}?text=${text}`, "_blank", "noopener"); log("wa", "otwarto w WhatsApp"); return done("Otwieram WhatsApp — dotknij „Wyślij”"); }
  if (c === "sms") { if (!need("text", "phone")) return; location.href = `sms:+${digits(f.phone)}?&body=${text}`; log("sms", "otwarto w Wiadomościach"); return done("Otwieram SMS"); }
  if (c === "mailto") { if (!need("text", "email")) return; location.href = `mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent(f.subject)}&body=${text}`; log("mailto", "otwarto w poczcie telefonu"); return done("Otwieram pocztę"); }
  if (!need("text", "email")) return;
  const at = new Date().toISOString();
  M.Store.save("approvals", null, { type: "mail", title: `Mail do ${f.name || f.email}`, to: f.email, subject: f.subject || "", draft: f.text, attachRequest: f.attach || null, project: f.project || null, status: "approved", createdBy: M.who() + " (panel, polecenie głosowe)", createdAt: at, approvedAt: at, approvedBy: M.who() + " (wysłane z panelu)" });
  log("mail", "w kolejce — wyśle agent poczty"); say("Wiadomość w kolejce do wysłania."); done("W kolejce — agent poczty wyśle z firmowej skrzynki");
}

/* ---------- widok ---------- */
const cmdBox = big => `<div class="cmd"><input id="cmd-in" data-input="cmd" placeholder="wyślij wiadomość do … i napisz …, załącz …" value="${esc(ui.cmd)}" aria-label="Polecenie" autocomplete="off" style="${big ? "font-size:16px;padding:13px 14px" : ""}">
  ${SR ? `<button class="btn ${ui.listening === "cmd" ? "primary" : ""}" data-act="cmd-mic" aria-label="Powiedz polecenie">${icon("mic")}${ui.listening === "cmd" ? "Słucham…" : "Powiedz"}</button>` : ""}<button class="btn primary" data-act="cmd-run">Wykonaj ${icon("arrow")}</button></div>`;

M.panel({
  id: "napisz", label: "Napisz", icon: "send", order: 25,
  render: () => {
    const hist = [...(S.messages || [])].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12);
    const ready = f.text && f.channel && (f.channel === "mail" || f.channel === "mailto" ? f.email : f.phone);
    return `<div class="head"><div><h1>Napisz</h1><p>Powiedz albo wpisz jedno zdanie — panel sam znajdzie odbiorcę, ułoży treść i zapamięta, co załączyć.</p></div></div>
    <div class="bento">
    <section class="card c12 hero" style="display:block"><h2>Polecenie</h2>${cmdBox(true)}
      ${ui.note ? `<p style="margin:10px 0 0;color:var(--accent)">${esc(ui.note)}</p>` : `<p class="muted" style="margin:10px 0 0;font-size:12.5px">Wzór: <b>wyślij</b> [maila / SMS / na WhatsApp] <b>do</b> kogo <b>napisz</b> treść, <b>załącz</b> co. Na telefonie możesz dyktować mikrofonem z klawiatury.</p>`}
      ${ui.picks.length ? `<div class="chips" style="margin-top:8px">${ui.picks.map((c, i) => `<button class="chip acc" data-act="ms-choose" data-i="${i}">${esc(c.name)} · ${esc(c.email || c.phone)}</button>`).join("")}</div>` : ""}</section>
    <section class="card c7" style="display:flex;flex-direction:column;gap:10px">
      <h2 style="margin:0">Wiadomość</h2>
      <input id="ms-name" data-input="ms" data-k="name" data-act="ms-pick" list="ms-dl" placeholder="Odbiorca" value="${esc(f.name)}" aria-label="Odbiorca" autocomplete="off">
      <datalist id="ms-dl">${contacts().map(c => `<option value="${esc(c.name)}">${esc(c.src)} · ${esc(c.email || c.phone)}</option>`).join("")}</datalist>
      <div class="cmd"><input id="ms-email" data-input="ms" data-k="email" type="email" placeholder="E-mail" value="${esc(f.email)}" aria-label="E-mail"><input id="ms-phone" data-input="ms" data-k="phone" type="tel" placeholder="Telefon (WhatsApp / SMS)" value="${esc(f.phone)}" aria-label="Telefon"></div>
      <div class="cmd"><input id="ms-subject" data-input="ms" data-k="subject" placeholder="Temat (e-mail; pusty = agent nada sam)" value="${esc(f.subject)}" aria-label="Temat"><select id="ms-project" data-act="ms-proj" aria-label="Projekt" style="flex:0 1 200px"><option value="">— bez projektu —</option>${S.projects.filter(p => p.status !== "zamknięty").map(p => `<option value="${esc(p.nr)}" ${f.project === p.nr ? "selected" : ""}>${esc(p.nr)} ${esc(p.client)}</option>`).join("")}</select></div>
      <textarea id="ms-text" data-input="ms" data-k="text" placeholder="Treść wiadomości…" aria-label="Treść" style="min-height:140px;font-size:16px;line-height:1.5">${esc(f.text)}</textarea>
      <input id="ms-attach" data-input="ms" data-k="attach" placeholder="Załącz — opisz plik, np. „ofertę z 12.11” (tylko e-mail przez MASTER)" value="${esc(f.attach)}" aria-label="Załącznik">
      <div class="meta" style="margin:0">${SR ? `<button class="btn sm ${ui.listening === "text" ? "primary" : ""}" data-act="ms-mic">${icon("mic")}${ui.listening === "text" ? "Słucham… dotknij, aby skończyć" : "Dopowiedz treść"}</button>` : ""}<button class="btn sm" data-act="ms-clear">Wyczyść</button></div>
      <div class="meta" style="margin:6px 0 0;padding-top:12px;border-top:1px solid var(--line)">
        ${ready ? `<button class="btn primary" data-act="ms-send" data-c="${f.channel}" style="padding:12px 18px;font-size:15px">${icon("send")}Wyślij: ${CH[f.channel]}</button>` : ""}
        ${Object.keys(CH).filter(c => !ready || c !== f.channel).map(c => `<button class="btn sm" data-act="ms-send" data-c="${c}">${CH[c]}</button>`).join("")}</div>
      ${f.attach && f.channel !== "mail" ? `<p style="margin:0;color:var(--accent);font-size:12.5px">Załącznik „${esc(f.attach)}” pójdzie tylko e-mailem przez MASTER.</p>` : ""}
      <p class="muted" style="margin:0;font-size:12.5px">WhatsApp, SMS i „E-mail z telefonu” otwierają aplikację z gotową treścią. „E-mail przez MASTER” wysyła agent poczty z firmowej skrzynki i to on dołącza opisany plik z folderu projektu.</p>
    </section>
    <section class="card c5"><h2>Ostatnie <span class="mono">· ${hist.length}</span></h2>${hist.map(m => `<div class="mailrow"><div style="display:flex;gap:8px;align-items:baseline"><span class="chip">${esc({ wa: "WhatsApp", sms: "SMS", mail: "e-mail", mailto: "e-mail" }[m.channel] || m.channel)}</span><span class="s" style="flex:1;min-width:0">${esc(m.name || m.to)}</span><span class="mono muted" style="font-size:12px">${esc(fmt(m.at))}</span></div><p>${esc(m.text)}</p><div class="muted" style="font-size:12px">${m.attach ? "załącznik: " + esc(m.attach) + " · " : ""}${esc(m.status || "")}</div></div>`).join("") || '<p class="muted" style="margin:0">Tu pojawi się historia wysłanych wiadomości.</p>'}</section></div>`;
  },
});
/* skrót na ekranie „Dziś" */
M.widget({ id: "polecenie-glos", order: 16, span: "c12", render: () => `<h2>Wyślij wiadomość jednym zdaniem</h2>${cmdBox(false)}` });

M.onInput("cmd", el => { ui.cmd = el.value; });
M.on("cmd-run", () => { const v = (document.getElementById("cmd-in") || {}).value || ui.cmd; if (!v.trim()) return M.toast("Powiedz albo wpisz polecenie"); ui.cmd = v; if (!location.hash.startsWith("#napisz")) location.hash = "napisz"; run(v); });
M.on("cmd-mic", () => listen("cmd", t => { ui.cmd = t; if (!location.hash.startsWith("#napisz")) location.hash = "napisz"; run(t); }));
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "cmd-in") { e.preventDefault(); ui.cmd = e.target.value; if (!location.hash.startsWith("#napisz")) location.hash = "napisz"; run(ui.cmd); } });
M.on("ms-choose", el => { setContact(ui.picks[+el.dataset.i]); ui.note = ""; M.refresh(); });
M.onInput("ms", el => { f[el.dataset.k] = el.value; });
M.on("ms-pick", el => { const c = contacts().find(x => x.name === el.value); if (c) { setContact(c); M.refresh(); } });
M.on("ms-proj", el => { f.project = el.value; });
M.on("ms-clear", () => { Object.keys(f).forEach(k => (f[k] = "")); ui.note = ""; ui.picks = []; M.refresh(); });
M.on("ms-mic", () => listen("text", t => { f.text = (f.text ? f.text.trimEnd() + " " : "") + t; const e = document.getElementById("ms-text"); if (e) e.value = f.text; }));
M.on("ms-send", el => send(el.dataset.c));
M.parseCommand = parse; /* do testów i dla innych modułów */
})();
