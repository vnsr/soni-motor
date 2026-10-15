/**
 * Soni Motor Training School — Sheet API for the phone app  · v1.2
 * The Google Sheet is the only data store. The phone app (a PWA on GitHub Pages) sends every
 * request here; this script checks the person's own PIN (Staff tab), stamps every entry with their
 * name, and is the only thing that reads or writes the sheet.
 *
 * FIRST TIME  (full steps: docs/SETUP.md in the repo)
 *   1. Open the Sheet → Extensions → Apps Script. Replace everything in Code.gs with this file. Save.
 *   2. Choose setup in the function menu and press Run. Approve the permissions.
 *      setup() is safe to run again: it only adds missing tabs and columns, it never deletes data.
 *   3. Fill the Settings, Staff and Packages tabs. Run checkSetup() until the log says "Setup complete".
 *   4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *      Copy the Web app URL (ends in /exec) into config.js of the app.
 *
 * UPDATING LATER
 *   Replace the code, then Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
 *   The /exec URL stays the same, so the app needs no change.
 */

const VERSION = '1.3.0';
const MAX_FAILS = 8, LOCK_SECONDS = 15 * 60;   // wrong-PIN protection

const TABS = {
  Settings: ['Key', 'Value', 'Notes'],
  Staff: ['Name', 'PIN', 'Active'],
  Packages: ['PackageID', 'Car', 'Transmission', 'Lessons', 'MinutesPerLesson', 'PriceINR', 'Active'],
  Enquiries: ['ID', 'Date', 'Name', 'Phone', 'Source', 'CarInterest', 'Note', 'Status', 'FollowUp', 'LoggedBy', 'Timestamp'],
  Students: ['ID', 'JoinDate', 'Name', 'Phone', 'PackageID', 'Price', 'Instructor', 'Licence', 'Status', 'CompletedDate', 'ReviewAsked', 'ReviewDone', 'EnquiryID', 'Notes', 'LoggedBy', 'Timestamp'],
  Lessons: ['ID', 'Date', 'StudentID', 'LessonNo', 'Instructor', 'LoggedBy', 'Timestamp'],
  Payments: ['ID', 'Date', 'StudentID', 'AmountINR', 'Mode', 'LoggedBy', 'Timestamp'],
  Skills: ['StudentID', 'Skill', 'Date', 'LoggedBy', 'Timestamp'],
  Bookings: ['ID', 'Date', 'Car', 'Slot', 'Type', 'StudentID', 'Note', 'LoggedBy', 'Timestamp'],
  Activity: ['Timestamp', 'Name', 'Action', 'Ref']
};

/* columns kept as plain text so Sheets does not turn them into numbers or dates */
const TEXT_COLS = ['PIN', 'Ref', 'Slot', 'Car', 'ID', 'Date', 'JoinDate', 'CompletedDate', 'ReviewAsked', 'FollowUp', 'Phone', 'StudentID', 'EnquiryID', 'PackageID', 'Timestamp', 'Value', 'Skill'];

const DEFAULT_SETTINGS = [
  ['SchoolName', 'Soni Motor Training School', ''],
  ['SchoolPhone', '', 'School WhatsApp number, 10 digits'],
  ['ReviewLink', 'https://g.page/r/CWKtBfMYEdoAEBM/review', 'Google review link from the Business Profile'],
  ['SlotStart', '06:30', 'Timetable: first slot of the day (HH:MM)'],
  ['SlotEnd', '20:00', 'Timetable: the last slot ends at this time (HH:MM)'],
  ['SlotMinutes', '30', 'Timetable: length of one slot in minutes'],
  ['Cars', '', 'Timetable: car names, comma-separated. Empty = the car names from Packages'],
  ['QuizLink', 'https://vnsr.github.io/soni-motor/quiz/', 'Public learner-licence practice quiz'],
  ['ReviewMsgGU', 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલમાં ડ્રાઇવિંગ શીખવા બદલ આભાર! તમારો અનુભવ ગૂગલ પર બે લીટીમાં લખશો તો બીજા લોકોને સ્કૂલ પસંદ કરવામાં મદદ થશે: {link}', '{name} = first name, {link} = ReviewLink'],
  ['ReviewMsgEN', 'Hello {name}, thank you for learning to drive with Soni Motor Training School! If you write two lines about your experience on Google, it helps others choose a school: {link}', ''],
  ['FollowMsgGU', 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલ તરફથી. ડ્રાઇવિંગ શીખવા વિશે પૂછપરછ કરવા બદલ આભાર. તમે ક્યારથી શરૂ કરવા માંગો છો?', ''],
  ['FollowMsgEN', 'Hello {name}, this is Soni Motor Training School. Thank you for your enquiry about driving lessons. When would you like to start?', ''],
  ['QuizMsgGU', 'નમસ્તે {name}, લર્નિંગ લાઇસન્સની પરીક્ષાની મફત પ્રેક્ટિસ અહીં કરો (ગુજરાતી અને અંગ્રેજીમાં): {quiz}', '{quiz} = QuizLink'],
  ['QuizMsgEN', 'Hello {name}, here is a free practice test for the learner licence exam (Gujarati and English): {quiz}', '']
];

/* ================= web app (JSON API) ================= */
/** Health check: opening the /exec URL in a browser shows this. */
function doGet() {
  return json_({ ok: true, app: 'soni-motor', version: VERSION });
}

/**
 * The phone app POSTs text/plain JSON: { pin, action, payload }.
 * (text/plain keeps it a "simple" request, so browsers send it without a CORS preflight.)
 * Answers { ok: true, db, result } or { ok: false, error: 'PIN' | 'LOCKED' | message }.
 */
function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'Bad request' }); }
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pinFails') || 0);
  if (fails >= MAX_FAILS) return json_({ ok: false, error: 'LOCKED' });
  try {
    const r = api(req.pin, req.action, req.payload);
    if (fails) cache.remove('pinFails');
    return json_({ ok: true, db: r.db, result: r.result });
  } catch (err) {
    const m = String(err && err.message || err);
    if (m === 'PIN') { cache.put('pinFails', String(fails + 1), LOCK_SECONDS); return json_({ ok: false, error: 'PIN' }); }
    return json_({ ok: false, error: m });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Single entry point for the app. Returns { db, result }.
 * Throws 'PIN' when the PIN does not match, which makes the app ask again.
 */
function api(pin, action, p) {
  const ss = SpreadsheetApp.getActive();
  const settings = readSettings_(ss);
  p = p || {};
  const user = whoIs_(ss, settings, pin, p.LoggedBy);
  if (!user) throw new Error('PIN');
  const who = user.name;            // always the PIN's owner; what the phone says is ignored
  const now = new Date().toISOString();
  let result = null;

  if (action === 'load') {
    logLogin_(ss, who, now);
  } else {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      result = write_(ss, action, p, who, now);
      append_(ss, 'Activity', { Timestamp: now, Name: who, Action: action, Ref: clean_((result && result.ID) || p.ID || p.StudentID || '') });
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
  const db = loadDb_(ss, settings);
  db.me = user.personal ? who : '';
  return { db: db, result: result };
}

/**
 * Finds the person behind a PIN. Each active row in Staff has its own PIN.
 * Until anyone has a personal PIN (an older sheet), the old shared PIN in Settings still works,
 * and the name comes from the phone as before.
 */
function whoIs_(ss, settings, pin, claimed) {
  pin = String(pin == null ? '' : pin).trim();
  if (!pin) return null;
  const staff = rows_(ss, 'Staff').filter(function (r) { return r.Name && String(r.Active).toLowerCase() !== 'no'; });
  const withPin = staff.filter(function (r) { return String(r.PIN || '').trim(); });
  if (withPin.length) {
    const hit = withPin.filter(function (r) { return String(r.PIN).trim() === pin; })[0];
    return hit ? { name: String(hit.Name).trim(), personal: true } : null;
  }
  if (settings.PIN && pin === String(settings.PIN).trim()) return { name: String(claimed || '').slice(0, 40), personal: false };
  return null;
}

/** One "login" row per person every 3 hours of use, so the Activity tab shows who used the app when. */
function logLogin_(ss, who, now) {
  const cache = CacheService.getScriptCache(), key = 'seen:' + who;
  if (cache.get(key)) return;
  cache.put(key, '1', 3 * 3600);
  append_(ss, 'Activity', { Timestamp: now, Name: who, Action: 'login', Ref: '' });
}

function write_(ss, action, p, who, now) {
  switch (action) {
    case 'addEnquiry': {
      const r = { ID: newId_('E'), Date: today_(), Name: clean_(p.Name), Phone: phone_(p.Phone), Source: clean_(p.Source), CarInterest: clean_(p.CarInterest),
        Note: clean_(p.Note), Status: 'New', FollowUp: date_(p.FollowUp), LoggedBy: who, Timestamp: now };
      append_(ss, 'Enquiries', r); return r;
    }
    case 'updateEnquiry':
      update_(ss, 'Enquiries', p.ID, pick_(p, ['Status', 'FollowUp', 'Note', 'CarInterest'])); return null;

    case 'addStudent': {
      const r = { ID: newId_('S'), JoinDate: today_(), Name: clean_(p.Name), Phone: phone_(p.Phone), PackageID: clean_(p.PackageID), Price: num_(p.Price),
        Instructor: clean_(p.Instructor), Licence: clean_(p.Licence) || 'None', Status: 'Active', CompletedDate: '', ReviewAsked: '', ReviewDone: '',
        EnquiryID: clean_(p.EnquiryID), Notes: '', LoggedBy: who, Timestamp: now };
      append_(ss, 'Students', r);
      if (r.EnquiryID) update_(ss, 'Enquiries', r.EnquiryID, { Status: 'Joined' });
      if (num_(p.PayAmount) > 0) append_(ss, 'Payments', { ID: newId_('P'), Date: today_(), StudentID: r.ID, AmountINR: num_(p.PayAmount), Mode: clean_(p.PayMode) || 'Cash', LoggedBy: who, Timestamp: now });
      return r;
    }
    case 'updateStudent':
      update_(ss, 'Students', p.ID, pick_(p, ['Status', 'CompletedDate', 'ReviewAsked', 'ReviewDone', 'Licence', 'Notes', 'Instructor', 'Price'])); return null;

    case 'logLesson': {
      const n = rows_(ss, 'Lessons').filter(function (l) { return l.StudentID === p.StudentID; }).length + 1;
      const r = { ID: newId_('L'), Date: date_(p.Date) || today_(), StudentID: clean_(p.StudentID), LessonNo: n, Instructor: clean_(p.Instructor), LoggedBy: who, Timestamp: now };
      append_(ss, 'Lessons', r); return r;
    }
    case 'undoLesson':
      remove_(ss, 'Lessons', function (r) { return r.ID === p.ID; }); return null;

    case 'addPayment': {
      const amt = num_(p.AmountINR); if (!(amt > 0)) throw new Error('Amount');
      const r = { ID: newId_('P'), Date: date_(p.Date) || today_(), StudentID: clean_(p.StudentID), AmountINR: amt, Mode: clean_(p.Mode) || 'Cash', LoggedBy: who, Timestamp: now };
      append_(ss, 'Payments', r); return r;
    }
    case 'setSkill': {
      /* p: { StudentID, Skill, On } — ticks or unticks one item on the progress card */
      remove_(ss, 'Skills', function (r) { return r.StudentID === p.StudentID && r.Skill === p.Skill; });
      if (p.On) append_(ss, 'Skills', { StudentID: clean_(p.StudentID), Skill: clean_(p.Skill), Date: today_(), LoggedBy: who, Timestamp: now });
      return null;
    }
    case 'setSlots': {
      /* p: { Date, Car, Slots: ['06:30', …], Type: 'Booked' | 'Blocked', StudentID, Note, Days }
         Days > 1 repeats a block on the following days. A slot that is already taken is refused with TAKEN,
         unless p.Replace is set (the person tapped that exact slot and chose to change it). */
      const type = p.Type === 'Blocked' ? 'Blocked' : 'Booked';
      if (type === 'Booked' && !p.StudentID) throw new Error('Student missing');
      const car = clean_(p.Car), slots = (p.Slots || []).map(clean_).filter(function (x) { return /^\d{2}:\d{2}$/.test(x); });
      const days = type === 'Blocked' ? Math.min(31, Math.max(1, num_(p.Days) || 1)) : 1;
      const dates = []; for (let i = 0; i < days; i++) dates.push(addDays_(date_(p.Date) || today_(), i));
      const taken = rows_(ss, 'Bookings').filter(function (b) { return b.Car === car && dates.indexOf(b.Date) >= 0 && slots.indexOf(b.Slot) >= 0; });
      if (taken.length && !p.Replace) throw new Error('TAKEN');
      if (taken.length) remove_(ss, 'Bookings', function (b) { return b.Car === car && dates.indexOf(b.Date) >= 0 && slots.indexOf(b.Slot) >= 0; });
      const out = [];
      dates.forEach(function (d) { slots.forEach(function (sl) {
        const r = { ID: newId_('B'), Date: d, Car: car, Slot: sl, Type: type, StudentID: type === 'Booked' ? clean_(p.StudentID) : '', Note: clean_(p.Note), LoggedBy: who, Timestamp: now };
        append_(ss, 'Bookings', r); out.push(r);
      }); });
      return { ID: out.length ? out[0].ID : '', count: out.length };
    }
    case 'clearSlots': {
      const car = clean_(p.Car), d = date_(p.Date), slots = (p.Slots || []).map(clean_);
      remove_(ss, 'Bookings', function (b) { return b.Car === car && b.Date === d && slots.indexOf(b.Slot) >= 0; });
      return null;
    }
    default:
      throw new Error('Unknown action: ' + action);
  }
}

/* ================= reading ================= */
function loadDb_(ss, settings) {
  const pub = {};
  Object.keys(settings).forEach(function (k) { if (k !== 'PIN') pub[k] = settings[k]; });
  return {
    version: VERSION,
    today: today_(),
    settings: pub,
    staff: rows_(ss, 'Staff').filter(function (r) { return String(r.Active).toLowerCase() !== 'no'; }).map(function (r) { return r.Name; }).filter(String),
    packages: rows_(ss, 'Packages').filter(function (r) { return r.PackageID && String(r.Active).toLowerCase() !== 'no'; })
      .map(function (r) { r.Lessons = num_(r.Lessons); r.MinutesPerLesson = num_(r.MinutesPerLesson); r.PriceINR = num_(r.PriceINR); return r; }),
    enquiries: rows_(ss, 'Enquiries'),
    students: rows_(ss, 'Students').map(function (r) { r.Price = num_(r.Price); return r; }),
    lessons: rows_(ss, 'Lessons').map(function (r) { r.LessonNo = num_(r.LessonNo); return r; }),
    payments: rows_(ss, 'Payments').map(function (r) { r.AmountINR = num_(r.AmountINR); return r; }),
    skills: rows_(ss, 'Skills'),
    /* timetable: last 14 days to 90 days ahead keeps the phone's copy small */
    bookings: (function () { const from = addDays_(today_(), -14), to = addDays_(today_(), 90);
      return rows_(ss, 'Bookings').filter(function (b) { return b.Date >= from && b.Date <= to; }); })()
  };
}

function readSettings_(ss) {
  const o = {};
  rows_(ss, 'Settings').forEach(function (r) { if (r.Key) o[String(r.Key).trim()] = String(r.Value == null ? '' : r.Value).trim(); });
  return o;
}

/** All rows of a tab as objects; every value is a string or number (no Date objects, which google.script.run cannot return). */
function rows_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const h = v[0].map(String);
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i].every(function (c) { return c === '' || c === null; })) continue;
    const o = {};
    h.forEach(function (k, j) { if (k) o[k] = plain_(v[i][j], k); });
    out.push(o);
  }
  return out;
}

function plain_(c, key) {
  if (Object.prototype.toString.call(c) === '[object Date]') {
    return key === 'Timestamp' ? c.toISOString() : Utilities.formatDate(c, 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  if (key === 'Phone') return String(c).replace(/\D/g, '').slice(-10);
  return c === null ? '' : c;
}

/* ================= writing ================= */
function append_(ss, name, obj) {
  const sh = ss.getSheetByName(name);
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(h.map(function (k) { return obj[k] === undefined ? '' : obj[k]; }));
}

function update_(ss, name, id, fields) {
  if (!id) throw new Error('Missing ID');
  const sh = ss.getSheetByName(name);
  const v = sh.getDataRange().getValues();
  const h = v[0].map(String), idc = h.indexOf('ID');
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][idc]) === String(id)) {
      Object.keys(fields).forEach(function (k) {
        const c = h.indexOf(k);
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(fields[k]);
      });
      return;
    }
  }
  throw new Error('Not found: ' + id);
}

function remove_(ss, name, test) {
  const sh = ss.getSheetByName(name);
  if (sh.getLastRow() < 2) return;
  const v = sh.getDataRange().getValues();
  const h = v[0].map(String);
  for (let i = v.length - 1; i >= 1; i--) {
    const o = {}; h.forEach(function (k, j) { o[k] = plain_(v[i][j], k); });
    if (test(o)) sh.deleteRow(i + 1);
  }
}

/* ================= small helpers ================= */
function addDays_(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function today_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }
function newId_(prefix) { return prefix + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function clean_(s) { return String(s == null ? '' : s).trim().slice(0, 300); }
function phone_(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
function num_(x) { const n = Number(String(x == null ? '' : x).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; }
function date_(s) { s = String(s || ''); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function pick_(p, keys) { const o = {}; keys.forEach(function (k) { if (p[k] !== undefined) o[k] = k === 'Price' ? num_(p[k]) : clean_(p[k]); }); return o; }

/* ================= setup ================= */
/** Creates missing tabs and columns. Safe to run again; never deletes anything. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('This script is not attached to a Google Sheet. Open the Sheet → Extensions → Apps Script and paste the code there.');
  Logger.log('Setting up: "' + ss.getName() + '"');
  ss.setSpreadsheetTimeZone('Asia/Kolkata');
  Object.keys(TABS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const want = TABS[name];
    const lastCol = Math.max(1, sh.getLastColumn());
    const have = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String).filter(String);
    const missing = want.filter(function (k) { return have.indexOf(k) < 0; });
    if (missing.length) sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]);
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    head.forEach(function (k, j) {
      if (TEXT_COLS.indexOf(k) >= 0) sh.getRange(2, j + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#F2F3F5');
    sh.setFrozenRows(1);
  });

  const s = readSettings_(ss), set = ss.getSheetByName('Settings');
  DEFAULT_SETTINGS.forEach(function (d) { if (!(d[0] in s)) set.appendRow(d); });
  if ('PIN' in s) retireSharedPin_(set);
  if (!rows_(ss, 'Staff').length) ss.getSheetByName('Staff').getRange(2, 1, 2, 1).setValues([['Trainer'], ['Office']]);
  givePins_(ss);
  if (!rows_(ss, 'Packages').length) {
    ss.getSheetByName('Packages').getRange(2, 1, 1, 7).setValues([['P1', 'EDIT: car name', 'Manual', 15, 30, 0, 'Yes']]);
  }
  ['Sheet1', 'Blatt1', 'Tabelle1', 'Tabellenblatt1'].forEach(function (n) { const x = ss.getSheetByName(n); if (x && x.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(x); });
  checkSetup();
}

/** Every active person without a PIN gets a random 4-digit one that nobody else has. */
function givePins_(ss) {
  const sh = ss.getSheetByName('Staff');
  const v = sh.getDataRange().getValues(), h = v[0].map(String);
  const cN = h.indexOf('Name'), cP = h.indexOf('PIN'), cA = h.indexOf('Active');
  const used = {};
  for (let i = 1; i < v.length; i++) if (String(v[i][cP]).trim()) used[String(v[i][cP]).trim()] = 1;
  for (let i = 1; i < v.length; i++) {
    const name = String(v[i][cN]).trim();
    if (!name || String(v[i][cP]).trim()) continue;
    let pin; do { pin = String(1000 + Math.floor(Math.random() * 9000)); } while (used[pin]);
    used[pin] = 1;
    sh.getRange(i + 1, cP + 1).setValue(pin);
    if (cA >= 0 && !String(v[i][cA]).trim()) sh.getRange(i + 1, cA + 1).setValue('Yes');
    Logger.log('PIN for ' + name + ': ' + pin + '  (Staff tab)');
  }
}

/** The old shared PIN stops working once people have their own; mark the row so nobody relies on it. */
function retireSharedPin_(set) {
  const v = set.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).trim() === 'PIN') {
    set.getRange(i + 1, 3).setValue('No longer used: each person now has their own PIN in the Staff tab.');
  }
}

function update_byKey_(sh, key, value) {
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  sh.appendRow([key, value, '']);
}

/** Lists what is still missing before go-live. Run from the editor and read the execution log. */
function checkSetup() {
  const ss = SpreadsheetApp.getActive(), s = readSettings_(ss), issues = [];
  if (!s.ReviewLink) issues.push('Settings: ReviewLink is empty (review requests will have no link)');
  if (!s.SchoolPhone) issues.push('Settings: SchoolPhone is empty');
  if (!s.QuizLink) issues.push('Settings: QuizLink is empty (the "send quiz" button stays hidden)');
  const pk = rows_(ss, 'Packages');
  if (!pk.length) issues.push('Packages: no packages');
  pk.forEach(function (p) {
    if (/EDIT/i.test(p.Car)) issues.push('Packages: ' + p.PackageID + ' still has the placeholder car name');
    if (!(num_(p.PriceINR) > 0)) issues.push('Packages: ' + p.PackageID + ' has no price');
    if (!(num_(p.Lessons) > 0)) issues.push('Packages: ' + p.PackageID + ' has no lesson count');
  });
  const staff = rows_(ss, 'Staff').filter(function (r) { return r.Name && String(r.Active).toLowerCase() !== 'no'; });
  if (!staff.length) issues.push('Staff: no names');
  const seen = {};
  staff.forEach(function (r) {
    const pin = String(r.PIN || '').trim();
    if (!pin) issues.push('Staff: ' + r.Name + ' has no PIN (run setup to create one)');
    else if (!/^\d{4,8}$/.test(pin)) issues.push('Staff: ' + r.Name + "'s PIN should be 4 to 8 digits");
    else if (seen[pin]) issues.push('Staff: ' + r.Name + ' and ' + seen[pin] + ' have the same PIN');
    else seen[pin] = r.Name;
  });
  Logger.log(issues.length ? 'Still to do:\n- ' + issues.join('\n- ') : 'Setup complete. Ready for go-live.');
  return issues;
}
