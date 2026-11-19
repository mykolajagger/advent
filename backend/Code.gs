/**
 * ADVENT CALENDAR — бекенд (Google Apps Script Web App).
 *
 * Скриптові властивості (Project Settings → Script properties):
 *   CLIENT_ID       — OAuth Client ID (Google Sign-In)
 *   ALLOWED_EMAILS  — рівно дві пошти через кому: you@gmail.com,she@gmail.com
 *   YEAR            — (необов'язково) рік календаря, за замовчуванням 2026
 *   UNLOCK_HOUR     — (необов'язково) година відкриття вікна за Києвом, за замовчуванням 7
 *   TEST_DAY        — (необов'язково) примусово вважати «сьогодні» цим днем (для тестів!). Видали перед стартом.
 *
 * Дані зберігаються у Script Properties (не в таблиці!), щоб ви не могли підглянути розклад наперед.
 */

var TZ = "Europe/Kyiv";

function prop_(k, d) { var v = PropertiesService.getScriptProperties().getProperty(k); return v === null || v === "" ? d : v; }
function getJson_(k, d) { var v = PropertiesService.getScriptProperties().getProperty(k); return v ? JSON.parse(v) : d; }
function setJson_(k, v) { PropertiesService.getScriptProperties().setProperty(k, JSON.stringify(v)); }

function allowedEmails_() {
  return String(prop_("ALLOWED_EMAILS", "")).split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
}

// ---------- Web App ----------
function doGet() {
  return json_({ ok: true, service: "advent" });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var email = verifyToken_(req.token);
    var emails = allowedEmails_();
    var handlers = { state: actionState_, saveSurvey: actionSaveSurvey_, day: actionDay_, mark: actionMark_ };
    var h = handlers[req.action];
    if (!h) throw new Error("bad_action");
    return json_(h(email, emails, req));
  } catch (err) {
    var m = String(err && err.message || err);
    return json_({ ok: false, error: /^[a-z_]+$/.test(m) ? m : "server_error" });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Авторизація ----------
function verifyToken_(token) {
  if (!token || typeof token !== "string") throw new Error("auth");
  var cache = CacheService.getScriptCache();
  var key = "t_" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var email = cache.get(key);
  if (!email) {
    var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error("auth");
    var info = JSON.parse(res.getContentText());
    if (info.aud !== prop_("CLIENT_ID", "")) throw new Error("auth");
    if (String(info.email_verified) !== "true") throw new Error("auth");
    email = String(info.email || "").toLowerCase();
    cache.put(key, email, 600);
  }
  if (allowedEmails_().indexOf(email) < 0) throw new Error("forbidden");
  return email;
}

// ---------- Час ----------
/** Повертає номер доступного дня: 0 — ще не почалось, 1..24 */
function today_() {
  var t = prop_("TEST_DAY", "");
  if (t !== "") return Math.max(0, Math.min(DAYS, Number(t)));
  var year = Number(prop_("YEAR", 2026)), unlock = Number(prop_("UNLOCK_HOUR", 7));
  var p = Utilities.formatDate(new Date(), TZ, "yyyy-M-d-H").split("-").map(Number);
  if (p[0] < year || (p[0] === year && p[1] < 12)) return 0;
  if (p[0] > year || p[1] > 12) return DAYS;
  var day = p[2] - (p[3] < unlock ? 1 : 0);
  return Math.max(0, Math.min(DAYS, day));
}

// ---------- Дії ----------
function partnerOf_(email, emails) { return emails[0] === email ? emails[1] : emails[0]; }

function actionState_(email, emails) {
  if (emails.length !== 2) throw new Error("config");
  var surveys = getJson_("surveys", {});
  var partner = partnerOf_(email, emails);
  var mine = surveys[email] || null, theirs = surveys[partner] || null;
  var sched = getJson_("schedule", null);
  var prog = getJson_("progress_" + email, { opened: {}, done: {} });
  return {
    ok: true,
    me: { email: email, name: mine ? mine.name : null },
    partner: { name: theirs ? theirs.name : null },
    myDone: !!mine,
    partnerDone: !!theirs,
    ready: !!sched,
    today: today_(),
    year: Number(prop_("YEAR", 2026)),
    unlockHour: Number(prop_("UNLOCK_HOUR", 7)),
    opened: Object.keys(prog.opened).map(Number),
    mySurvey: mine
  };
}

function actionSaveSurvey_(email, emails, req) {
  var clean = sanitizeSurvey_(req.answers);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var surveys = getJson_("surveys", {});
    if (getJson_("schedule", null)) throw new Error("locked"); // розклад уже складено — анкету змінити не можна
    surveys[email] = clean;
    setJson_("surveys", surveys);
    if (surveys[emails[0]] && surveys[emails[1]]) {
      var seed = Math.floor(Math.random() * 2147483647);
      setJson_("schedule", generateSchedule_(surveys, emails, seed, Number(prop_("YEAR", 2026))));
    }
  } finally {
    lock.releaseLock();
  }
  return actionState_(email, emails);
}

function actionDay_(email, emails, req) {
  var d = Math.round(Number(req.day));
  if (!(d >= 1 && d <= DAYS)) throw new Error("bad_day");
  if (d > today_()) throw new Error("not_yet");
  var sched = getJson_("schedule", null);
  if (!sched) throw new Error("not_ready");
  var plan = sched.days[d];
  var surveys = getJson_("surveys", {});
  var partner = partnerOf_(email, emails);
  var gifts = buildGifts_(), intim = buildIntimate_(), acts = buildActivities_();

  var key = "progress_" + email;
  var prog = getJson_(key, { opened: {}, done: {} });
  prog.opened[d] = 1;
  setJson_(key, prog);

  var done = prog.done[d] || {};
  return {
    ok: true,
    day: d,
    forName: surveys[partner].name,
    gift: giftView_(gifts[plan.gift[email]]),
    intim: intimView_(intim[plan.intim]),
    act: actView_(acts[plan.act]),
    done: { gift: !!done.gift, intim: !!done.intim, act: !!done.act }
  };
}

function actionMark_(email, emails, req) {
  var d = Math.round(Number(req.day));
  if (!(d >= 1 && d <= DAYS) || d > today_()) throw new Error("bad_day");
  if (["gift", "intim", "act"].indexOf(req.key) < 0) throw new Error("bad_key");
  var key = "progress_" + email;
  var prog = getJson_(key, { opened: {}, done: {} });
  prog.done[d] = prog.done[d] || {};
  prog.done[d][req.key] = !!req.done;
  setJson_(key, prog);
  return { ok: true };
}

// ---------- Службові функції (запускати вручну з редактора Apps Script) ----------

/** Повне скидання: анкети, розклад, прогрес. УВАГА: незворотно. */
function resetAll() {
  PropertiesService.getScriptProperties().getKeys().forEach(function (k) {
    if (["surveys", "schedule"].indexOf(k) >= 0 || k.indexOf("progress_") === 0) {
      PropertiesService.getScriptProperties().deleteProperty(k);
    }
  });
}

/** Перевірка контенту: скільки елементів у кожній категорії. */
function checkContent() {
  Logger.log("Подарунки: " + GIFTS_RAW.length + ", пригоди: " + INTIMATE_RAW.length + ", активності: " + ACTIVITIES_RAW.length);
}
