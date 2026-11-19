(() => {
'use strict';
const CFG = window.CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let token = null, st = null;

/* ---------- API ---------- */
async function api(action, data = {}) {
  const r = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, action, ...data }) });
  const j = await r.json();
  if (!j.ok) { const e = new Error(j.error || 'server_error'); e.code = j.error; throw e; }
  return j;
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800); }

/* ---------- Токен ---------- */
function jwtExp(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch { return 0; } }
function saveToken(t) { token = t; try { localStorage.setItem('adv_token', t); } catch {} }
function loadToken() {
  try { const t = localStorage.getItem('adv_token'); if (!t) return null; if (t.startsWith('dev:')) return t; if (jwtExp(t) > Date.now() + 60000) return t; } catch {}
  return null;
}
function logout() { token = null; try { localStorage.removeItem('adv_token'); } catch {} showLogin(); }

/* ---------- Вхід ---------- */
function showLogin(msg) {
  app.innerHTML = `<section class="hero">
    ${ICONS.star}
    <div class="eyebrow">Грудень · 24 дні</div><h1>Наш <em>Адвент</em></h1>
    <p class="muted">Двадцять чотири вікна з сюрпризами — тільки для двох. Увійди через Google, щоб відкрити свій календар.</p>
    <div id="gbtn"></div>
    <p class="err">${esc(msg || '')}</p>
  </section>`;
  if (CFG.DEV) {
    $('#gbtn').innerHTML = (CFG.DEV_EMAILS || []).map(e => `<button class="btn" data-dev="${esc(e)}" style="margin:4px">Dev: ${esc(e)}</button>`).join('') +
      `<button class="btn ghost" data-dev="stranger@evil.com" style="margin:4px">Dev: чужий</button>`;
    return;
  }
  const init = () => {
    if (!window.google?.accounts?.id) return setTimeout(init, 200);
    google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: r => { saveToken(r.credential); boot(); }, auto_select: true });
    google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'uk' });
  };
  init();
}
app.addEventListener('click', e => {
  const b = e.target.closest('[data-dev]'); if (!b) return;
  saveToken('dev:' + b.dataset.dev); boot();
});

/* ---------- Анкета ---------- */
const GIFT_OPTS = { sweet: 'Солодощі', tea: 'Чай і кава', beauty: 'Догляд і б’юті', cozy: 'Затишок', book: 'Книги', tech: 'Гаджети', game: 'Ігри', craft: 'Творчість', plant: 'Рослини', jewel: 'Прикраси', sport: 'Спорт', music: 'Музика', art: 'Арт і декор', gourmet: 'Гурме', fun: 'Кумедні дрібнички', photo: 'Фото та спогади', alcohol: 'Вино й крафт', scent: 'Аромати' };
const AVOID_OPTS = { alcohol: 'Не п’ю алкоголь', sweet: 'Без солодкого', scent: 'Без парфумів і ароматів' };
const INTIM_OPTS = { mas: 'Масаж', bath: 'Ванна / SPA', dance: 'Танці', game: 'Ігри', role: 'Рольові ігри', blind: 'Сенсорні (пов’язка)', photo: 'Фото лише для нас', words: 'Слова й листи', food: 'Смаколики', tease: 'Флірт і дражнилки', cozy: 'Затишок', music: 'Музика', dress: 'Образи й білизна' };
const ACT_OPTS = { home: 'Затишок удома', out: 'Прогулянки', food: 'Їжа й заклади', cult: 'Культура й музеї', act: 'Актив і спорт', craft: 'Творчість', relax: 'SPA й релакс', night: 'Вечірній відпочинок', cine: 'Кіно', play: 'Ігри', trip: 'Поїздки околицями', music: 'Музика' };
const LEVELS = [
  ['Романтика', 'I', 'Ніжність, свічки, обійми, масаж і слова'],
  ['Гра', 'II', 'Флірт, пікантні ігри, дотики із зав’язаними очима'],
  ['Смілива ніч', 'III', 'Відверто, але завжди з повагою до комфорту обох']
];
const ICONS = {
  gift: '<svg class="ico" viewBox="0 0 48 48"><rect x="7" y="18" width="34" height="23" rx="2"/><rect x="5" y="12" width="38" height="6" rx="1"/><path d="M24 12v29M24 12c-3-7-11-7-11-3s6 3 11 3zm0 0c3-7 11-7 11-3s-6 3-11 3z"/></svg>',
  intim: '<svg class="ico" viewBox="0 0 48 48"><path d="M24 40S7 29 7 18a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 11-17 22-17 22z"/></svg>',
  act: '<svg class="ico" viewBox="0 0 48 48"><path d="M24 5l3.5 10.5H38l-8.5 6.2 3.3 10.3L24 25.8l-8.8 6.2 3.3-10.3L10 15.5h10.5z"/><path d="M24 33v10"/></svg>',
  star: '<svg class="ico" viewBox="0 0 48 48"><path d="M24 4v40M4 24h40M10 10l28 28M38 10L10 38"/></svg>'
};
const ACT_BUDGETS = [['Безкоштовно', 'Лише те, що не коштує грошей'], ['До ~300 ₴ на двох', 'Кава, кіно, невеличкі розваги'], ['До ~800 ₴', 'Ресторан, майстер-клас, концерт'], ['Без обмежень', 'Термальні води, подорожі, свята']];

let ans = { name: '', budget: 300, giftLikes: [], avoid: [], level: 1, intimLikes: [], actLikes: [], actBudget: 1, car: false };
let step = 0;
const chips = (key, opts) => `<div class="chips">${Object.entries(opts).map(([k, v]) => `<button type="button" class="chip ${ans[key].includes(k) ? 'on' : ''}" data-chip="${key}" data-v="${k}">${v}</button>`).join('')}</div>`;

const STEPS = [
  () => `<h2>Привіт</h2><p>Кілька швидких питань, щоб календар був саме для вас. Свої відповіді бачиш тільки ти — партнер їх не побачить, як і ти його.</p>
    <div><label class="lbl" for="nm">Як тебе називати?</label><input id="nm" type="text" maxlength="30" value="${esc(ans.name)}" placeholder="Ім’я"></div>`,
  () => `<h2>Подарунки</h2>
    <div><label class="lbl">Мій бюджет на один подарунок</label><div class="big" id="bv">${ans.budget} ₴</div>
    <input class="range" id="bg" type="range" min="100" max="500" step="50" value="${ans.budget}"></div>
    <div><label class="lbl">Що люблю отримувати</label>${chips('giftLikes', GIFT_OPTS)}</div>
    <div><label class="lbl">Мені краще без…</label>${chips('avoid', AVOID_OPTS)}</div>`,
  () => `<h2>Пригоди для двох</h2><p class="muted">Береться менший рівень із двох — ніхто нікого не змушує.</p>
    <div class="opts">${LEVELS.map((l, i) => `<button type="button" class="opt ${ans.level === i + 1 ? 'on' : ''}" data-level="${i + 1}"><b>${l[1]} · ${l[0]}</b><small>${l[2]}</small></button>`).join('')}</div>
    <div><label class="lbl">Що мені до вподоби</label>${chips('intimLikes', INTIM_OPTS)}</div>`,
  () => `<h2>Спільні активності</h2>
    <div><label class="lbl">Що ми любимо робити</label>${chips('actLikes', ACT_OPTS)}</div>
    <div><label class="lbl">Бюджет на день для двох</label><div class="opts">${ACT_BUDGETS.map((b, i) => `<button type="button" class="opt ${ans.actBudget === i ? 'on' : ''}" data-ab="${i}"><b>${b[0]}</b><small>${b[1]}</small></button>`).join('')}</div></div>
    <div><label class="lbl">Є машина для поїздок околицями?</label><div class="opts two">
      <button type="button" class="opt ${ans.car ? 'on' : ''}" data-car="1"><b>Є</b></button><button type="button" class="opt ${!ans.car ? 'on' : ''}" data-car="0"><b>Ні</b></button></div></div>`,
  () => `<div class="center" style="min-height:0">${ICONS.gift}<h2>Усе готово</h2><p>Після відправки анкету змінити не можна. Календар складеться, коли відповість і другий з вас — і все ж ви не знатимете, що чекає. Це секрет.</p></div>`
];

function showSurvey() {
  app.innerHTML = `<div class="card"><div class="dots">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="step">${STEPS[step]()}</div>
    <div class="nav"><button class="btn ghost" id="back" ${step === 0 ? 'style="visibility:hidden"' : ''}>Назад</button>
    <button class="btn" id="next">${step === STEPS.length - 1 ? 'Відправити' : 'Далі'}</button></div></div>`;
  const nm = $('#nm'); if (nm) { nm.oninput = () => ans.name = nm.value; }
  const bg = $('#bg'); if (bg) bg.oninput = () => { ans.budget = +bg.value; $('#bv').textContent = ans.budget + ' ₴'; };
  $('#back').onclick = () => { step--; showSurvey(); };
  $('#next').onclick = async () => {
    if (step === 0 && !ans.name.trim()) return toast('Напиши, як тебе називати');
    if (step < STEPS.length - 1) { step++; showSurvey(); scrollTo({ top: 0, behavior: 'smooth' }); return; }
    $('#next').disabled = true;
    try { st = await api('saveSurvey', { answers: ans }); confetti(); route(); }
    catch (e) { toast(errText(e)); $('#next').disabled = false; }
  };
}
app.addEventListener('click', e => {
  const c = e.target.closest('[data-chip]'); if (c) { const arr = ans[c.dataset.chip], v = c.dataset.v, i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); c.classList.toggle('on'); return; }
  const l = e.target.closest('[data-level]'); if (l) { ans.level = +l.dataset.level; document.querySelectorAll('[data-level]').forEach(x => x.classList.toggle('on', x === l)); return; }
  const a = e.target.closest('[data-ab]'); if (a) { ans.actBudget = +a.dataset.ab; document.querySelectorAll('[data-ab]').forEach(x => x.classList.toggle('on', x === a)); return; }
  const k = e.target.closest('[data-car]'); if (k) { ans.car = k.dataset.car === '1'; document.querySelectorAll('[data-car]').forEach(x => x.classList.toggle('on', x === k)); }
});

/* ---------- Очікування партнера ---------- */
let pollT;
function showWaiting() {
  app.innerHTML = `<div class="center">${ICONS.gift}<h2>Дякую, ${esc(st.me.name)}</h2>
    <p class="muted">Твоя анкета збережена. Чекаємо, поки ${st.partner.name ? esc(st.partner.name) : 'твоя половинка'} теж відповість —<br>тоді я складу календар. Підглядати не можна.</p>
    <button class="btn ghost sm" id="chk">Перевірити</button><button class="btn ghost sm" id="out">Вийти</button></div>`;
  $('#chk').onclick = refresh; $('#out').onclick = logout;
  clearTimeout(pollT); pollT = setTimeout(refresh, 30000);
}
async function refresh() { try { st = await api('state'); route(); } catch (e) { handleErr(e); } }

/* ---------- Календар ---------- */
function order() { // однаковий «перемішаний» порядок для обох
  const a = Array.from({ length: 24 }, (_, i) => i + 1); let s = 7;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1);[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function unlockDate(day) { return new Date(st.year, 11, day, st.unlockHour, 0, 0); }
const fmtT = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; const d = Math.floor(h / 24); return (d ? d + ' д ' : '') + [h % 24, m, x].map(n => String(n).padStart(2, '0')).join(':'); };

let timerI;
function showCalendar() {
  const opened = new Set(st.opened), today = st.today;
  const nextDay = today + 1, hasNext = nextDay <= 24;
  app.innerHTML = `<div class="head">
      <div class="eyebrow">Грудень · 24 дні</div><h1>Наш <em>Адвент</em></h1>
      <p class="muted">${today === 0 ? 'Календар відкриється 1 грудня' : 'Привіт, ' + esc(st.me.name) + '. Сьогодні — вікно №' + today}</p>
      ${hasNext ? `<div class="timer" id="tm"></div><div class="eyebrow" style="color:var(--muted)">до вікна №${nextDay}</div>` : '<div class="timer">Усі вікна відкриті</div>'}
      <div class="progress"><i style="width:${(opened.size / 24) * 100}%"></i></div>
      <div class="muted" style="font-size:12px;letter-spacing:.1em">відкрито ${opened.size} з 24</div>
    </div>
    <div class="grid">${order().map(d => {
      const lock = d > today;
      return `<button class="door ${lock ? 'locked' : ''} ${d === today && !opened.has(d) ? 'today' : ''} ${opened.has(d) ? 'opened' : ''}" data-d="${d}" aria-label="Вікно ${d}">
        <div class="face front">${d}</div><div class="face back"><div>${d}<small>ВІДКРИТО</small></div></div></button>`;
    }).join('')}</div>
    <div class="tools"><button class="btn ghost sm" id="out">Вийти</button></div>`;
  $('#out').onclick = logout;
  clearInterval(timerI);
  if (hasNext) {
    const tick = () => { const el = $('#tm'); if (!el) return clearInterval(timerI); const ms = unlockDate(nextDay) - new Date(); el.textContent = fmtT(ms); if (ms <= 0) { clearInterval(timerI); refresh(); } };
    tick(); timerI = setInterval(tick, 1000);
  }
}
app.addEventListener('click', e => {
  const d = e.target.closest('.door'); if (!d) return;
  const day = +d.dataset.d;
  if (day > st.today) {
    d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
    const u = unlockDate(day); toast(`Це вікно відкриється ${u.getDate()} грудня о ${String(st.unlockHour).padStart(2, '0')}:00`); return;
  }
  openDay(day);
});

/* ---------- День ---------- */
const TILES = [
  { k: 'gift', t: 'Подарунок' },
  { k: 'intim', t: 'Пригода для двох' },
  { k: 'act', t: 'Спільна активність' }
];
async function openDay(day) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="sheet"><div class="center"><div class="spinner"></div></div></div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); refresh(); };
  const onKey = e => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  let d;
  try { d = await api('day', { day }); } catch (e) { ov.remove(); document.removeEventListener('keydown', onKey); return handleErr(e); }
  const revealed = {};
  const render = () => {
    ov.firstElementChild.innerHTML = `<header><h2>Вікно <span>№${day}</span></h2><button class="x" aria-label="Закрити">✕</button></header>
      ${TILES.map(t => `<div class="tile" data-k="${t.k}">${revealed[t.k] ? tileBody(t, d) : `<button class="wrap" data-rev="${t.k}">${ICONS[t.k].replace('class="ico"','class="ico sm"')}<b>${t.t}</b><small>торкнись, щоб відкрити</small></button>`}</div>`).join('')}
      <div class="row"><button class="btn ghost sm" id="all">Відкрити все</button></div>`;
    ov.querySelector('.x').onclick = close;
    ov.querySelector('#all').onclick = () => { TILES.forEach(t => revealed[t.k] = true); render(); confetti(); };
  };
  render();
  ov.addEventListener('click', async e => {
    const r = e.target.closest('[data-rev]');
    if (r) { revealed[r.dataset.rev] = true; render(); confetti(e.clientX, e.clientY, 60); return; }
    const c = e.target.closest('[data-mark]');
    if (c) { try { await api('mark', { day, key: c.dataset.mark, done: c.checked }); d.done[c.dataset.mark] = c.checked; if (c.checked) { confetti(e.clientX, e.clientY, 30); toast('Чудово'); } } catch (er) { c.checked = !c.checked; toast(errText(er)); } }
  });
  if (day === st.today) confetti(innerWidth / 2, 160, 80);
}
function tileBody(t, d) {
  const x = d[t.k]; let meta = '', hint = '', tag = t.t;
  if (t.k === 'gift') { tag = `Подарунок для: ${d.forName}`; meta = `<span>${x.price ? '≈ ' + x.price + ' ₴' : 'у межах твого бюджету'}</span>`; hint = '<div class="hint">Це сюрприз — не показуй і не розповідай.</div>'; }
  if (t.k === 'intim') { meta = `<span>${['Романтика', 'Гра', 'Смілива ніч'][x.level - 1]}</span>`; hint = '<div class="hint">Лише для вас двох. Зупиняйтесь, якщо комусь некомфортно.</div>'; }
  if (t.k === 'act') { meta = `<span>${['безкоштовно', 'до ~300 ₴', 'до ~800 ₴', 'дорожче / далі'][x.cost]}</span>${x.car ? '<span>потрібна машина</span>' : ''}`; }
  return `<div class="reveal"><div class="tag">${esc(tag)}</div><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p>
    <div class="meta">${meta}</div>${x.link ? `<a class="link" href="${esc(x.link.url)}" target="_blank" rel="noopener noreferrer">${esc(x.link.label)} ↗</a>` : ''}${hint}
    <label class="tick"><input type="checkbox" data-mark="${t.k}" ${d.done[t.k] ? 'checked' : ''}> Виконано</label></div>`;
}

/* ---------- Маршрутизація ---------- */
function errText(e) {
  return ({ auth: 'Сесія закінчилась — увійди знову', forbidden: 'Цей акаунт не має доступу', not_yet: 'Ще зарано', locked: 'Анкету вже не можна змінити', bad_name: 'Вкажи ім’я', config: 'Бекенд налаштований неправильно' })[e.code] || 'Щось пішло не так. Спробуй ще раз.';
}
function handleErr(e) {
  if (e.code === 'auth') { token = null; try { localStorage.removeItem('adv_token'); } catch {} return showLogin('Сесія закінчилась — увійди знову'); }
  if (e.code === 'forbidden') { token = null; try { localStorage.removeItem('adv_token'); } catch {} return showLogin('Цей акаунт не має доступу до календаря.'); }
  toast(errText(e));
}
function route() {
  clearTimeout(pollT); clearInterval(timerI);
  if (!st.myDone) return showSurvey();
  if (!st.ready) return showWaiting();
  showCalendar();
}
async function boot() {
  app.innerHTML = '<div class="center"><div class="spinner"></div></div>';
  try { st = await api('state'); route(); }
  catch (e) { if (e.code) handleErr(e); else { app.innerHTML = '<div class="center"><p class="err">Не вдалося зв’язатися із сервером.</p><button class="btn" onclick="location.reload()">Спробувати ще</button></div>'; } }
}

/* ---------- FX: сніг, гірлянда, конфеті ---------- */
const cv = $('#fx'), cx = cv.getContext('2d');
let W, H, flakes = [], parts = [], dpr = Math.min(devicePixelRatio || 1, 2);
function resize() { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); const n = reduceMotion ? 0 : Math.min(70, Math.floor(W / 16)); while (flakes.length < n) flakes.push(flake(true)); flakes.length = n; }
function flake(rand) { return { x: Math.random() * W, y: rand ? Math.random() * H : -10, r: Math.random() * 1.6 + .5, v: Math.random() * .6 + .2, s: Math.random() * Math.PI * 2, d: Math.random() * .02 + .005 }; }
function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 60) {
  if (reduceMotion) return;
  const cols = ['#d6b46a', '#f0d79a', '#f3efe6', '#b8924a'];
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * 8 + 3; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, w: Math.random() * 5 + 3, h: Math.random() * 2 + 2, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 1 }); }
}
function frame() {
  cx.clearRect(0, 0, W, H);
  cx.fillStyle = 'rgba(255,255,255,.55)';
  for (const f of flakes) { f.y += f.v; f.s += f.d; f.x += Math.sin(f.s) * .5; if (f.y > H + 5) Object.assign(f, flake(false), { x: Math.random() * W }); cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 6.3); cx.fill(); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy += .28; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= .008; if (p.life <= 0 || p.y > H + 20) { parts.splice(i, 1); continue; } cx.save(); cx.globalAlpha = Math.min(1, p.life * 2); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); }
  requestAnimationFrame(frame);
}
addEventListener('resize', resize); resize(); if (!reduceMotion) requestAnimationFrame(frame);

/* ---------- Старт ---------- */
token = loadToken();
if (token) boot(); else showLogin();
})();
