/**
 * ЛОГІКА ПІДБОРУ. Чисті функції без доступу до Google-сервісів — тому їх можна тестувати в Node.
 */

var DAYS = 24;

// Теги «уникати» в анкеті -> теги контенту, які тоді виключаються
var AVOID_MAP = { alcohol: "alcohol", sweet: "sweet", scent: "scent" };

function splitTags_(s) { return s ? String(s).split(",").filter(Boolean) : []; }

function mulberry32_(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlap_(tags, likes) {
  var n = 0;
  for (var i = 0; i < tags.length; i++) if (likes.indexOf(tags[i]) >= 0) n++;
  return n;
}

function hasAvoided_(tags, avoid) {
  for (var i = 0; i < avoid.length; i++) {
    var t = AVOID_MAP[avoid[i]];
    if (t && tags.indexOf(t) >= 0) return true;
  }
  return false;
}

function buildGifts_() {
  return GIFTS_RAW.map(function (r, i) {
    return { id: i, title: r[0], desc: r[1], price: r[2], tags: splitTags_(r[3]), store: r[4], q: r[5], day: r[6] || 0 };
  });
}
function buildIntimate_() {
  return INTIMATE_RAW.map(function (r, i) {
    return { id: i, title: r[0], desc: r[1], level: r[2], tags: splitTags_(r[3]), day: r[4] || 0 };
  });
}
function buildActivities_() {
  return ACTIVITIES_RAW.map(function (r, i) {
    return { id: i, title: r[0], desc: r[1], cost: r[2], tags: splitTags_(r[3]), q: r[4], day: r[5] || 0 };
  });
}

/** Зважений вибір без повторів. cands: [{item, w}]. Повертає item і видаляє його з масиву. */
function takeWeighted_(cands, rnd) {
  var total = 0, i;
  for (i = 0; i < cands.length; i++) total += cands[i].w;
  var r = rnd() * total;
  for (i = 0; i < cands.length; i++) {
    r -= cands[i].w;
    if (r <= 0) break;
  }
  if (i >= cands.length) i = cands.length - 1;
  return cands.splice(i, 1)[0].item;
}

function weekdayOf_(year, day) { return new Date(Date.UTC(year, 11, day)).getUTCDay(); } // 0=нд

/**
 * answers: { email: {name, budget, giftLikes[], avoid[], level, intimLikes[], actLikes[], actBudget, car} }
 * emails: [a, b]
 * Повертає { seed, days: { "1": { gift: {a: id, b: id}, intim: id, act: id } ... } , stretched: bool }
 */
function generateSchedule_(answers, emails, seed, year) {
  var rnd = mulberry32_(seed);
  var A = emails[0], B = emails[1];
  var gifts = buildGifts_(), intim = buildIntimate_(), acts = buildActivities_();
  var days = {};
  for (var d = 1; d <= DAYS; d++) days[d] = { gift: {} };

  // ---- Подарунки: кожен дарує іншому ----
  var stretched = false;
  [[A, B], [B, A]].forEach(function (pair) {
    var giver = answers[pair[0]], recv = answers[pair[1]];
    var special = gifts.filter(function (g) { return g.day; });
    var regular = gifts.filter(function (g) { return !g.day && !hasAvoided_(g.tags, recv.avoid || []); });
    var budget = giver.budget;
    var pool = regular.filter(function (g) { return g.price <= budget; });
    if (pool.length < DAYS) {              // замало варіантів у бюджеті — трохи розширюємо
      stretched = true;
      pool = regular.slice().sort(function (x, y) { return x.price - y.price; }).slice(0, DAYS + 6);
    }
    var cands = pool.map(function (g) { return { item: g, w: 1 + 3 * overlap_(g.tags, recv.giftLikes || []) }; });
    for (var d = 1; d <= DAYS; d++) {
      var sp = special.filter(function (g) { return g.day === d; })[0];
      days[d].gift[pair[0]] = sp ? sp.id : takeWeighted_(cands, rnd).id;
    }
  });

  // ---- Інтимні пригоди: спільні, рівень = мінімум з двох, з поступовим наростанням ----
  var maxLevel = Math.min(answers[A].level || 1, answers[B].level || 1);
  var iPool = intim.filter(function (x) { return !x.day && x.level <= maxLevel; });
  var iCands = iPool.map(function (x) {
    return { item: x, w: 1 + 2 * overlap_(x.tags, answers[A].intimLikes || []) + 2 * overlap_(x.tags, answers[B].intimLikes || []) };
  });
  for (var d2 = 1; d2 <= DAYS; d2++) {
    var spI = intim.filter(function (x) { return x.day === d2; })[0];
    if (spI) { days[d2].intim = spI.id; continue; }
    var target = 1 + ((d2 - 1) / (DAYS - 1)) * (maxLevel - 1);   // 1 -> maxLevel
    var local = iCands.map(function (c) {
      var bonus = 1 / (1 + 1.5 * Math.abs(c.item.level - target));
      return { item: c.item, w: c.w * (0.25 + bonus) };
    });
    var pick = takeWeighted_(local, rnd);
    days[d2].intim = pick.id;
    iCands = iCands.filter(function (c) { return c.item.id !== pick.id; });
  }

  // ---- Активності: спільні ----
  var maxCost = Math.min(answers[A].actBudget, answers[B].actBudget);
  var hasCar = !!(answers[A].car || answers[B].car);
  var avoid = (answers[A].avoid || []).concat(answers[B].avoid || []);
  var aPool = acts.filter(function (x) {
    if (x.day) return false;
    if (x.cost > maxCost) return false;
    if (x.tags.indexOf("car") >= 0 && !hasCar) return false;
    if (hasAvoided_(x.tags, avoid)) return false;
    return true;
  });
  var aCands = aPool.map(function (x) {
    var la = answers[A].actLikes || [], lb = answers[B].actLikes || [];
    var oa = overlap_(x.tags, la), ob = overlap_(x.tags, lb);
    return { item: x, w: 1 + 2 * oa + 2 * ob + (oa && ob ? 2 : 0) };
  });
  for (var d3 = 1; d3 <= DAYS; d3++) {
    var spA = acts.filter(function (x) { return x.day === d3; })[0];
    if (spA) { days[d3].act = spA.id; continue; }
    var wd = weekdayOf_(year, d3), weekend = wd === 0 || wd === 6;
    var loc = aCands.map(function (c) {
      var m = 1, t = c.item.tags;
      if (t.indexOf("trip") >= 0) m *= weekend ? 3 : 0.15;
      if (t.indexOf("home") >= 0 && !weekend) m *= 1.4;
      if (c.item.cost >= 3 && !weekend) m *= 0.3;
      return { item: c.item, w: c.w * m };
    });
    var pickA = takeWeighted_(loc, rnd);
    days[d3].act = pickA.id;
    aCands = aCands.filter(function (c) { return c.item.id !== pickA.id; });
  }

  return { seed: seed, days: days, stretched: stretched };
}

var STORES_ = {
  r: ["https://rozetka.com.ua/ua/search/?text=", "Rozetka"],
  p: ["https://prom.ua/ua/search?search_term=", "Prom.ua"],
  y: ["https://www.yakaboo.ua/ua/search/?q=", "Yakaboo"],
  m: ["https://makeup.com.ua/ua/search/?q=", "Makeup"],
  e: ["https://epicentrk.ua/ua/search/?q=", "Епіцентр"],
  g: ["https://www.google.com/maps/search/", "На мапі"]
};

function storeLink_(store, q) {
  var s = STORES_[store];
  if (!s || !q) return null;
  var query = store === "g" && q.indexOf("Ужгород") < 0 ? q + " Ужгород" : q;
  return { url: s[0] + encodeURIComponent(query), label: store === "g" ? "На мапі" : "Шукати на " + s[1] };
}

function giftView_(g) {
  return { title: g.title, desc: g.desc, price: g.price, link: storeLink_(g.store, g.q) };
}
function intimView_(x) { return { title: x.title, desc: x.desc, level: x.level }; }
function actView_(x) {
  return { title: x.title, desc: x.desc, cost: x.cost, car: x.tags.indexOf("car") >= 0, link: x.q ? storeLink_("g", x.q) : null };
}

/** Сума та перевірка анкети (довіряти фронтенду не можна) */
var GIFT_TAGS_ = ["sweet", "tea", "beauty", "cozy", "book", "tech", "game", "craft", "plant", "jewel", "sport", "music", "art", "gourmet", "fun", "photo", "alcohol", "scent"];
var INTIM_TAGS_ = ["mas", "bath", "dance", "game", "role", "blind", "photo", "words", "food", "tease", "cozy", "music", "dress"];
var ACT_TAGS_ = ["home", "out", "food", "cult", "act", "craft", "relax", "night", "cine", "play", "trip", "music"];

function pickAllowed_(arr, allowed) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(function (x) { return allowed.indexOf(x) >= 0; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
}

function sanitizeSurvey_(a) {
  a = a || {};
  var name = String(a.name || "").replace(/[<>]/g, "").trim().slice(0, 30);
  if (!name) throw new Error("bad_name");
  var budget = Math.max(100, Math.min(1000, Math.round(Number(a.budget) || 300)));
  var level = Math.max(1, Math.min(3, Math.round(Number(a.level) || 1)));
  var actBudget = Math.max(0, Math.min(3, Math.round(a.actBudget === undefined ? 1 : Number(a.actBudget))));
  return {
    name: name,
    budget: budget,
    giftLikes: pickAllowed_(a.giftLikes, GIFT_TAGS_),
    avoid: pickAllowed_(a.avoid, ["alcohol", "sweet", "scent"]),
    level: level,
    intimLikes: pickAllowed_(a.intimLikes, INTIM_TAGS_),
    actLikes: pickAllowed_(a.actLikes, ACT_TAGS_),
    actBudget: actBudget,
    car: !!a.car
  };
}
