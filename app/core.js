/* Soni Motor app: storage, state, dates, talking to the Sheet, saving without signal, and the shared reducer. */
/* ================= storage ================= */
const ls = {
  get(k, d) { try { const v = localStorage.getItem('smts.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('smts.' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('smts.' + k); } catch (e) { } }
};

/* ================= state ================= */
const API_URL = (window.SONI_CONFIG && window.SONI_CONFIG.API_URL) || '';
const IS_LIVE = !!API_URL && !/[?&]demo\b/.test(location.search);
const st = {
  lang: ls.get('lang', 'gu'), pin: ls.get('pin', IS_LIVE ? '' : '1993'), me: ls.get('me', IS_LIVE ? '' : 'Trainer'),
  trainer: ls.get('trainer', ''), tab: 'home', db: null, sFilter: 'Active', eFilter: 'open', q: ''
};
const T = () => I18N[st.lang];
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GU_DIG = '૦૧૨૩૪૫૬૭૮૯';
const n2 = n => String(n);
const inr = n => '₹' + n2(Math.round(n).toLocaleString('en-IN'));

/* dates are 'yyyy-mm-dd' strings, IST */
function istToday() { return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); }
function addDays(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function weekStart(s) { const d = new Date(s + 'T00:00:00Z'); const w = (d.getUTCDay() + 6) % 7; return addDays(s, -w); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5); }
const MON_GU = ['જાન્યુ', 'ફેબ્રુ', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઑગસ્ટ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_GU = ['રવિ', 'સોમ', 'મંગળ', 'બુધ', 'ગુરુ', 'શુક્ર', 'શનિ'], DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function fd(s, withDay) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00Z'), m = d.getUTCMonth(), day = d.getUTCDate();
  const base = st.lang === 'gu' ? `${n2(day)} ${MON_GU[m]}` : `${day} ${MON_EN[m]}`;
  return withDay ? (st.lang === 'gu' ? DAY_GU : DAY_EN)[d.getUTCDay()] + ', ' + base : base;
}
function rel(s) {
  const n = daysBetween(s, today());
  if (n === 0) return st.lang === 'gu' ? 'આજે' : 'today';
  if (n === 1) return st.lang === 'gu' ? 'ગઈકાલે' : 'yesterday';
  if (n === -1) return st.lang === 'gu' ? 'આવતીકાલે' : 'tomorrow';
  if (n > 0) return st.lang === 'gu' ? `${n2(n)} દિવસ પહેલાં` : `${n} days ago`;
  return st.lang === 'gu' ? `${n2(-n)} દિવસ પછી` : `in ${-n} days`;
}
const today = () => (st.db && st.db.today) || istToday();
function addMonths(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
/* Learner licence rules (Central Motor Vehicles Rules): driving test 30 days after the LL at the earliest; the LL is valid 6 months */
const LL_WAIT_DAYS = 30, LL_VALID_MONTHS = 6, DOCS = ['id', 'address', 'age', 'photos', 'll'];
function llInfo(s) { return s.LLDate ? { from: addDays(s.LLDate, LL_WAIT_DAYS), until: addMonths(s.LLDate, LL_VALID_MONTHS) } : null; }
function studentUrl(s) { const base = (st.db.settings || {}).StudentLink || new URL('student/', location.href.split(/[?#]/)[0]).href; return base + (base.includes('?') ? '&' : '?') + 't=' + s.Token; }

/* ================= data access ================= */
/* A random code for this phone. The Sheet remembers phones that logged in, so they keep working
   even while a stranger is guessing PINs. */
const DEVICE = (() => { let d = ls.get('dev', ''); if (!/^[a-z0-9]{16}$/.test(d)) { d = rnd(16, 'abcdefghijklmnopqrstuvwxyz0123456789'); ls.set('dev', d); } return d; })();
function rnd(n, abc) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => abc[x % abc.length]).join(''); }
/* New rows get their ID on the phone, so a change that is sent twice (no signal, then sent again) is saved once */
const NEW_ID = { addEnquiry: 'E', addStudent: 'S', logLesson: 'L', addPayment: 'P' };
function newId(prefix) { return prefix + istToday().slice(2).replace(/-/g, '') + '-' + rnd(6, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'); }
/* what can be saved without signal; the timetable and links need the Sheet's answer */
const OFFLINE_OK = ['addEnquiry', 'updateEnquiry', 'addStudent', 'updateStudent', 'logLesson', 'undoLesson', 'addPayment', 'setSkill'];

function call(action, payload) {
  payload = Object.assign({ LoggedBy: st.me }, payload || {});
  if (NEW_ID[action] && !payload.NewID) payload.NewID = newId(NEW_ID[action]);
  $('#busy').hidden = false;
  const done = r => { $('#busy').hidden = true; return r; };
  if (!IS_LIVE) return new Promise((res, rej) => setTimeout(() => {
    if (Mock.offline && action !== 'load') { done(); const e = new Error('net'); e.net = true; e.payload = payload; return rej(e); }
    try { res(done(Mock.api(st.pin, action, payload))); } catch (e) { done(); e.server = true; rej(e); } }, 180));
  /* text/plain keeps this a simple request: no CORS preflight, which Apps Script cannot answer */
  return fetch(API_URL, { method: 'POST', body: JSON.stringify({ pin: st.pin, dev: DEVICE, action, payload }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' })
    .then(r => r.json())
    .then(r => { done(); if (!r.ok) { const e = new Error(r.error || 'error'); e.server = true; throw e; } if (r.db) { st.offline = false; st.loadedAt = Date.now(); ls.set('db', r.db); } return r; })
    .catch(e => { done(); if (!e.server) { e.net = true; e.payload = payload; } throw e; });
}
/* the Sheet's copy, with this phone's unsent changes laid on top */
function adopt(db) {
  st.db = db;
  if (db) queue().forEach(op => { try { reduce(st.db, op.action, op.payload, st.me); } catch (e) { } });
  if (db && db.me) {
    st.me = db.me; ls.set('me', db.me);
    if (!st.trainer || !(db.staff || []).includes(st.trainer)) { st.trainer = (db.staff || []).includes(db.me) ? db.me : ((db.staff || [])[0] || db.me); ls.set('trainer', st.trainer); }
  }
}
const queue = () => ls.get('queue', []);
async function act(action, payload, okMsg) {
  /* undoing a lesson that never left this phone just takes it out of the queue */
  if (action === 'undoLesson' && queue().some(op => op.payload.NewID === payload.ID)) {
    ls.set('queue', queue().filter(op => op.payload.NewID !== payload.ID));
    const saved = ls.get('db', null); if (saved) adopt(saved); else reduce(st.db, 'undoLesson', payload, st.me);
    render();
    if (okMsg) toast(okMsg); return null;
  }
  try {
    const r = await call(action, payload);
    adopt(r.db); render();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r.result) : okMsg);
    if (queue().length) flush();
    return r.result;
  } catch (e) {
    const m = String(e && e.message || e);
    if (m === 'PIN') { ls.del('pin'); st.pin = ''; st.pinBad = true; st.db = null; render(); return null; }
    if (m === 'TAKEN') { toast(T().taken); try { const r = await call('load'); adopt(r.db); render(); } catch (x) { } throw e; }
    if (e.net && OFFLINE_OK.includes(action) && st.db) {
      ls.set('queue', [...queue(), { action, payload: e.payload, at: Date.now() }]);
      const result = reduce(st.db, action, e.payload, st.me);
      st.offline = true; render(); toast(T().savedLocal);
      return result;
    }
    toast(m === 'LOCKED' ? T().locked : e.net && !OFFLINE_OK.includes(action) ? T().needNet : T().offline); throw e;
  }
}
/* sends the queued changes in the order they were made; stops at the first one that finds no signal */
let flushing = false;
async function flush() {
  if (flushing || !queue().length || !st.pin) return;
  flushing = true;
  let refused = 0, why = '';
  try {
    while (queue().length) {
      const op = queue()[0];
      try {
        const r = await call(op.action, op.payload);
        ls.set('queue', queue().slice(1)); adopt(r.db);
      } catch (e) {
        if (e.net) break;
        const m = String(e && e.message || e);
        if (m === 'PIN' || m === 'LOCKED') break;
        ls.set('queue', queue().slice(1)); refused++; why = m;
      }
    }
  } finally { flushing = false; }
  render();
  if (refused) toast(T().dropped(refused, why));
}
window.addEventListener('online', () => flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !st.db || !st.pin) return;
  if (queue().length) flush();
  else if (IS_LIVE && Date.now() - (st.loadedAt || 0) > 5 * 60e3) call('load').then(r => { adopt(r.db); render(); }).catch(() => { });
});
setInterval(() => { if (queue().length && navigator.onLine !== false) flush(); }, 60e3);

/* The same changes the Sheet makes, done on the phone's copy: used by the demo and for changes saved without signal */
function reduce(db, action, p, me) {
  const td = today(), now = new Date().toISOString(), find = (arr, id) => (arr || []).find(x => x.ID === id);
  const by = { LoggedBy: me, Timestamp: now };
  if (action === 'addEnquiry') { if (find(db.enquiries, p.NewID)) return find(db.enquiries, p.NewID); const r = Object.assign({ ID: p.NewID, Date: td, Name: p.Name, Phone: p.Phone, Source: p.Source, CarInterest: p.CarInterest || '', Note: p.Note || '', Status: 'New', FollowUp: p.FollowUp || '', LL: '', ReferredBy: '' }, by); db.enquiries.push(r); return r; }
  if (action === 'updateEnquiry') { const e = find(db.enquiries, p.ID); if (e) ['Status', 'FollowUp', 'Note', 'CarInterest'].forEach(k => { if (p[k] !== undefined) e[k] = p[k]; }); return null; }
  if (action === 'addStudent') {
    if (find(db.students, p.NewID)) return find(db.students, p.NewID);
    const r = Object.assign({ ID: p.NewID, JoinDate: td, Name: p.Name, Phone: p.Phone, PackageID: p.PackageID, Price: Number(p.Price) || 0, Instructor: p.Instructor, Licence: p.Licence || 'None', Status: 'Active', CompletedDate: '', ReviewAsked: '', ReviewDone: '', EnquiryID: p.EnquiryID || '', Notes: '', LLDate: p.LLDate || '', TestDate: '', TestResult: '', Docs: '', Token: '' }, by);
    db.students.push(r);
    const e = p.EnquiryID && find(db.enquiries, p.EnquiryID); if (e) e.Status = 'Joined';
    if (Number(p.PayAmount) > 0) db.payments.push(Object.assign({ ID: p.NewID.replace(/^S/, 'P') + 'F', Date: td, StudentID: r.ID, AmountINR: Number(p.PayAmount), Mode: p.PayMode || 'Cash' }, by));
    return r;
  }
  if (action === 'updateStudent') { const s = find(db.students, p.ID); if (s) ['Status', 'CompletedDate', 'ReviewAsked', 'ReviewDone', 'Licence', 'Notes', 'Instructor', 'Price', 'LLDate', 'TestDate', 'TestResult', 'Docs'].forEach(k => { if (p[k] !== undefined) s[k] = p[k]; }); return null; }
  if (action === 'studentLink') { const s = find(db.students, p.ID); if (s && (!s.Token || p.Renew)) s.Token = rnd(32, 'abcdefghijklmnopqrstuvwxyz0123456789'); return s ? { ID: s.ID, Token: s.Token } : null; }
  if (action === 'logLesson') {
    if (find(db.lessons, p.NewID)) return find(db.lessons, p.NewID);
    const r = Object.assign({ ID: p.NewID, Date: p.Date || td, StudentID: p.StudentID, LessonNo: db.lessons.filter(l => l.StudentID === p.StudentID).length + 1, Instructor: p.Instructor || '' }, by);
    db.lessons.push(r); return r;
  }
  if (action === 'undoLesson') { db.lessons = db.lessons.filter(l => l.ID !== p.ID); return null; }
  if (action === 'addPayment') { if (find(db.payments, p.NewID)) return find(db.payments, p.NewID); const r = Object.assign({ ID: p.NewID, Date: p.Date || td, StudentID: p.StudentID, AmountINR: Number(p.AmountINR), Mode: p.Mode || 'Cash' }, by); db.payments.push(r); return r; }
  if (action === 'setSkill') { db.skills = (db.skills || []).filter(x => !(x.StudentID === p.StudentID && x.Skill === p.Skill)); if (p.On) db.skills.push(Object.assign({ StudentID: p.StudentID, Skill: p.Skill, Date: td }, by)); return null; }
  if (action === 'setSlots') {
    const days = p.Type === 'Blocked' ? Math.max(1, +p.Days || 1) : 1, dates = Array.from({ length: days }, (_, i) => addDays(p.Date, i));
    const hit = b => b.Car === p.Car && dates.includes(b.Date) && p.Slots.includes(b.Slot);
    if (db.bookings.some(hit) && !p.Replace) throw new Error('TAKEN');
    db.bookings = db.bookings.filter(b => !hit(b));
    dates.forEach(d => p.Slots.forEach(sl => db.bookings.push(Object.assign({ ID: newId('B'), Date: d, Car: p.Car, Slot: sl, Type: p.Type, StudentID: p.Type === 'Booked' ? p.StudentID : '', Note: p.Note || '' }, by))));
    if (p.RequestID) db.requests = (db.requests || []).filter(r => r.ID !== p.RequestID);
    return { count: dates.length * p.Slots.length };
  }
  if (action === 'clearSlots') { db.bookings = db.bookings.filter(b => !(b.Car === p.Car && b.Date === p.Date && p.Slots.includes(b.Slot))); return null; }
  if (action === 'closeRequest') { db.requests = (db.requests || []).filter(r => r.ID !== p.ID); return null; }
  if (action !== 'load') throw new Error('Unknown action: ' + action);
  return null;
}

/* derived */
function pkgOf(id) { return (st.db.packages || []).find(p => String(p.PackageID) === String(id)); }
function pkgLabel(p) { return p ? `${p.Car} · ${p.Transmission === 'Automatic' ? (st.lang === 'gu' ? 'ઑટોમેટિક' : 'Automatic') : (st.lang === 'gu' ? 'મેન્યુઅલ' : 'Manual')}` : ''; }
function studentsX() {
  const db = st.db, L = {}, P = {};
  db.lessons.forEach(l => { const a = L[l.StudentID] || (L[l.StudentID] = { n: 0, last: '' }); a.n++; if (l.Date > a.last) a.last = l.Date; });
  db.payments.forEach(p => { P[p.StudentID] = (P[p.StudentID] || 0) + Number(p.AmountINR || 0); });
  return db.students.map(s => {
    const pk = pkgOf(s.PackageID), tot = pk ? Number(pk.Lessons) : 0, done = (L[s.ID] || {}).n || 0, paid = P[s.ID] || 0;
    return Object.assign({}, s, { Phone: String(s.Phone || ''), pk, tot, done, last: (L[s.ID] || {}).last || '', paid, bal: Math.max(0, Number(s.Price || 0) - paid) });
  });
}
