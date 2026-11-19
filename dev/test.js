const { ctx, store } = (() => { process.env.TEST_DAY = '24'; return require('./server.js'); })();
const assert = require('assert');
const call = (email, o) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ token: 'dev:' + email, ...o }) } }).s);
console.log('content:', ctx.GIFTS_RAW.length, ctx.INTIMATE_RAW.length, ctx.ACTIVITIES_RAW.length);
const A = 'me@test.com', B = 'she@test.com';
assert.equal(call('x@evil.com', { action: 'state' }).error, 'forbidden');
assert.equal(call(A, { action: 'state' }).ready, false);
call(A, { action: 'saveSurvey', answers: { name: 'Він', budget: 300, giftLikes: ['sweet', 'tech'], avoid: [], level: 3, intimLikes: ['mas'], actLikes: ['food', 'trip'], actBudget: 2, car: true } });
assert.equal(call(A, { action: 'state' }).ready, false);
let s = call(B, { action: 'saveSurvey', answers: { name: 'Вона', budget: 200, giftLikes: ['beauty', 'cozy'], avoid: ['alcohol'], level: 2, intimLikes: ['bath'], actLikes: ['cult', 'home'], actBudget: 1, car: false } });
assert.equal(s.ready, true);
const seenG = { A: new Set(), B: new Set() }, seenI = new Set(), seenA = new Set();
for (let d = 1; d <= 24; d++) {
  const a = call(A, { action: 'day', day: d }), b = call(B, { action: 'day', day: d });
  assert(a.ok && b.ok, JSON.stringify(a));
  assert.equal(a.intim.title, b.intim.title); assert.equal(a.act.title, b.act.title);
  assert(a.intim.level <= 2); assert(a.act.cost <= 1);
  assert(!a.gift.title.match(/вино|пиво|сидр/i), 'alcohol for B: ' + a.gift.title);
  if (d !== 6 && d !== 24) { assert(a.gift.price <= 300 && b.gift.price <= 200, `${d} price ${a.gift.price}/${b.gift.price}`); }
  seenG.A.add(a.gift.title); seenG.B.add(b.gift.title); seenI.add(a.intim.title); seenA.add(a.act.title);
  if (d <= 6 || d === 24) console.log(d, '|', a.gift.title, a.gift.price, '|', b.gift.title, b.gift.price, '|', a.intim.level, a.intim.title, '|', a.act.title);
}
assert.equal(seenG.A.size, 24); assert.equal(seenG.B.size, 24); assert.equal(seenI.size, 24); assert.equal(seenA.size, 24);
assert.equal(call(A, { action: 'saveSurvey', answers: { name: 'x' } }).error, 'locked');
store.TEST_DAY = '3';
assert.equal(call(A, { action: 'day', day: 4 }).error, 'not_yet');
assert.equal(call(A, { action: 'state' }).opened.length, 24);
// Стрес: багато випадкових анкет — розклад завжди складається
const tags = ctx.GIFT_TAGS_, at = ctx.ACT_TAGS_, it = ctx.INTIM_TAGS_;
const pick = (arr, n) => arr.filter(() => Math.random() < n);
for (let i = 0; i < 300; i++) {
  const mk = () => ctx.sanitizeSurvey_({ name: 'n', budget: 100 + Math.floor(Math.random() * 9) * 50, giftLikes: pick(tags, .3), avoid: pick(['alcohol', 'sweet', 'scent'], .5), level: 1 + Math.floor(Math.random() * 3), intimLikes: pick(it, .3), actLikes: pick(at, .3), actBudget: Math.floor(Math.random() * 4), car: Math.random() < .5 });
  const sc = ctx.generateSchedule_({ a: mk(), b: mk() }, ['a', 'b'], i + 1, 2026);
  assert.equal(Object.keys(sc.days).length, 24);
}
console.log('ALL OK');
