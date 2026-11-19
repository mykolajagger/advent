// Локальний dev-сервер: віддає frontend/ та емулює Apps Script (завантажує ті самі .gs файли).
// Запуск: node dev/server.js   (TEST_DAY=5 node dev/server.js — щоб відкрити перші 5 вікон)
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const store = {
  CLIENT_ID: 'dev', ALLOWED_EMAILS: process.env.ALLOWED || 'me@test.com,she@test.com', YEAR: '2026',
  ...(process.env.TEST_DAY ? { TEST_DAY: process.env.TEST_DAY } : {})
};
const ctx = {
  console, Math, Date, JSON, Object, Array, String, Number, Error, parseInt, isNaN,
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => (k in store ? store[k] : null),
    setProperty: (k, v) => { store[k] = v; },
    deleteProperty: k => { delete store[k]; },
    getKeys: () => Object.keys(store) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: {
    base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'),
    computeDigest: (_, s) => crypto.createHash('sha256').update(s).digest(),
    DigestAlgorithm: { SHA_256: 1 },
    formatDate: (d, tz, fmt) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
      return `${p.year}-${+p.month}-${+p.day}-${+p.hour}`;
    } },
  UrlFetchApp: { fetch: url => {
      const t = decodeURIComponent(url.split('id_token=')[1]);
      const email = t.replace('dev:', '');
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ aud: 'dev', email_verified: 'true', email }) };
    } },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  Logger: { log: console.log }
};
vm.createContext(ctx);
for (const f of ['Content', 'Logic', 'Code']) vm.runInContext(fs.readFileSync(path.join(root, 'backend', f + '.gs'), 'utf8'), ctx, { filename: f + '.gs' });
if (require.main !== module) module.exports = { ctx, store };
else {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api') {
      let b = ''; req.on('data', c => b += c); req.on('end', () => {
        const out = ctx.doPost({ postData: { contents: b } });
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(out.s);
      }); return;
    }
    if (req.url === '/config.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      return res.end('window.CONFIG={API_URL:"/api",GOOGLE_CLIENT_ID:"",DEV:true,DEV_EMAILS:' + JSON.stringify(store.ALLOWED_EMAILS.split(',')) + '};');
    }
    let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    const fp = path.join(root, 'frontend', path.normalize(p));
    if (!fp.startsWith(path.join(root, 'frontend')) || !fs.existsSync(fp)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': types[path.extname(fp)] || 'application/octet-stream' }); res.end(fs.readFileSync(fp));
  }).listen(8787, () => console.log('dev: http://localhost:8787'));
}
