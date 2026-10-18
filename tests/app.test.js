/* Checks on the phone app without a browser: every script parses, the versions agree, the offline cache lists
   real files, and the queue for changes made without signal behaves (sent once, in order, same IDs). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('every script parses', () => {
  for (const f of ['app/i18n.js', 'app/core.js', 'app/screens.js', 'app/demo.js', 'sw.js', 'quiz/sw.js', 'quiz/bank.js']) new vm.Script(read(f), { filename: f });
  for (const f of ['index.html', 'quiz/index.html', 'student/index.html']) {
    [...read(f).matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => new vm.Script(m[1], { filename: `${f} script ${i + 1}` }));
  }
});

test('app, Sheet API and offline cache carry the same version', () => {
  const app = /APP_VERSION = '([\d.]+)'/.exec(read('app/i18n.js'))[1];
  const gs = /const VERSION = '([\d.]+)'/.exec(read('apps-script/Code.gs'))[1];
  const cache = /const CACHE = 'soni-motor-v([\d-]+)'/.exec(read('sw.js'))[1];
  assert.equal(app, gs);
  assert.equal(cache, app.replace(/\./g, '-'));
});

test('the offline cache lists only files that exist', () => {
  for (const [sw, dir] of [['sw.js', ''], ['quiz/sw.js', 'quiz']]) {
    const files = JSON.parse(/const FILES = (\[[^\]]*\])/.exec(read(sw))[1].replace(/'/g, '"'));
    files.filter(f => f !== './').forEach(f => assert.ok(fs.existsSync(path.join(ROOT, dir, f)), `${sw}: ${f}`));
  }
});

test('topic pages are up to date with the question bank', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-topics.js'), '--check'], { stdio: 'pipe' });
});

/* loads the app's core (state, queue, reducer) with just enough of a browser around it */
function loadCore(fetchImpl) {
  const store = new Map(), toasts = [];
  const el = () => ({ hidden: true });
  const sandbox = {
    console, URL, Uint8Array, Date, Math, JSON, Promise, setTimeout,
    crypto: { getRandomValues: a => require('crypto').randomFillSync(a) },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { search: '', href: 'https://vnsr.github.io/soni-motor/' },
    navigator: { onLine: true },
    document: { querySelector: el, addEventListener() { }, documentElement: {} },
    window: { SONI_CONFIG: { API_URL: 'https://example.test/exec' }, addEventListener() { } },
    setInterval() { },
    fetch: fetchImpl,
    render() { }, toast: m => toasts.push(m)
  };
  vm.createContext(sandbox);
  vm.runInContext(read('app/i18n.js') + '\n' + read('app/core.js') + '\n;globalThis.__core = { st, act, flush, queue, reduce, adopt, newId };', sandbox);
  const c = sandbox.__core;
  c.st.pin = '482913'; c.st.me = 'Ravi'; c.st.lang = 'en';
  c.st.db = { today: '2026-10-18', settings: {}, staff: ['Ravi'], packages: [{ PackageID: 'P1', Car: 'Swift', Lessons: 15 }], enquiries: [], students: [{ ID: 'S261001-AAAA', Name: 'Kiran', Phone: '9800000001', PackageID: 'P1', Price: 5000, Status: 'Active' }], lessons: [], payments: [], skills: [], bookings: [], requests: [] };
  return { c, store, toasts };
}

test('without signal, changes are queued with their IDs and sent once, in order, when signal returns', async () => {
  let online = false; const sent = [];
  const server = { lessons: [] };
  const fetchImpl = async (url, opt) => {
    if (!online) throw new TypeError('Failed to fetch');
    const body = JSON.parse(opt.body); sent.push(body);
    if (body.action === 'logLesson' && !server.lessons.some(l => l.ID === body.payload.NewID)) server.lessons.push({ ID: body.payload.NewID, StudentID: body.payload.StudentID, Date: body.payload.Date, LessonNo: server.lessons.length + 1 });
    return { json: async () => ({ ok: true, db: Object.assign({}, env.c.st.db, { lessons: server.lessons.slice() }), result: null }) };
  };
  const env = loadCore(fetchImpl);
  const { c } = env;
  const r1 = await c.act('logLesson', { StudentID: 'S261001-AAAA', Date: '2026-10-18', Instructor: 'Ravi' });
  const r2 = await c.act('logLesson', { StudentID: 'S261001-AAAA', Date: '2026-10-18', Instructor: 'Ravi' });
  assert.equal(c.queue().length, 2);
  assert.match(r1.ID, /^L\d{6}-[A-Z0-9]{6}$/);
  assert.equal(r2.LessonNo, 2, 'counted on the phone meanwhile');
  assert.equal(c.st.db.lessons.length, 2);
  await assert.rejects(c.act('setSlots', { Car: 'Swift', Date: '2026-10-18', Slots: ['07:00'], Type: 'Booked', StudentID: 'S261001-AAAA' }));
  assert.equal(c.queue().length, 2, 'timetable changes are not queued');

  online = true;
  await c.flush();
  assert.equal(c.queue().length, 0);
  assert.deepEqual(sent.map(b => b.payload.NewID), [r1.ID, r2.ID], 'same IDs, same order');
  assert.ok(sent.every(b => /^[a-z0-9]{16}$/.test(b.dev)), 'device code sent');
  assert.equal(server.lessons.length, 2);
  assert.equal(c.st.db.lessons.length, 2, 'no doubles after the Sheet copy comes back');
});

test('undoing a lesson that never left the phone removes it from the queue', async () => {
  const { c } = loadCore(async () => { throw new TypeError('offline'); });
  const r = await c.act('logLesson', { StudentID: 'S261001-AAAA', Date: '2026-10-18' });
  assert.equal(c.queue().length, 1);
  await c.act('undoLesson', { ID: r.ID });
  assert.equal(c.queue().length, 0);
  assert.equal(c.st.db.lessons.length, 0);
});

test('a queued change the Sheet refuses is dropped and reported, the rest still go', async () => {
  let online = false;
  const env = loadCore(async (url, opt) => {
    if (!online) throw new TypeError('offline');
    const b = JSON.parse(opt.body);
    if (b.action === 'addPayment') return { json: async () => ({ ok: false, error: 'Amount' }) };
    return { json: async () => ({ ok: true, db: env.c.st.db }) };
  });
  const { c, toasts } = env;
  await c.act('addPayment', { StudentID: 'S261001-AAAA', AmountINR: 500 });
  await c.act('setSkill', { StudentID: 'S261001-AAAA', Skill: 'controls', On: true });
  online = true; await c.flush();
  assert.equal(c.queue().length, 0);
  assert.ok(toasts.some(t => /refused/.test(t) && /Amount/.test(t)));
});
