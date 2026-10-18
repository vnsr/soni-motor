/**
 * Soni Motor Training School — Sheet API for the phone app  · v2.0
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
 *   5. Run installTriggers() once for the morning email, the Monday report and the weekly backup.
 *
 * UPDATING LATER
 *   Replace the code, then Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
 *   The /exec URL stays the same, so the app needs no change. Run setup() once for new columns.
 */

const VERSION = '2.0.0';

/* wrong-PIN protection. Each phone sends a random device code it made itself.
   A phone that guesses wrong 5 times is locked for 15 minutes. If 30 wrong PINs arrive from anywhere
   within 15 minutes, every phone that has never logged in is locked out too, but phones that have
   logged in before keep working, so a stranger can't lock the school out of its own app. */
const DEVICE_FAILS = 5, GLOBAL_FAILS = 30, LOCK_SECONDS = 15 * 60, TRUST_DAYS = 120, PIN_DIGITS = 6;

const TABS = {
  Settings: ['Key', 'Value', 'Notes'],
  Staff: ['Name', 'PIN', 'Active'],
  Packages: ['PackageID', 'Car', 'Transmission', 'Lessons', 'MinutesPerLesson', 'PriceINR', 'Active'],
  Enquiries: ['ID', 'Date', 'Name', 'Phone', 'Source', 'CarInterest', 'Note', 'Status', 'FollowUp', 'LoggedBy', 'Timestamp', 'LL', 'ReferredBy'],
  Students: ['ID', 'JoinDate', 'Name', 'Phone', 'PackageID', 'Price', 'Instructor', 'Licence', 'Status', 'CompletedDate', 'ReviewAsked', 'ReviewDone', 'EnquiryID', 'Notes', 'LoggedBy', 'Timestamp',
    'LLDate', 'TestDate', 'TestResult', 'Docs', 'Token'],
  Lessons: ['ID', 'Date', 'StudentID', 'LessonNo', 'Instructor', 'LoggedBy', 'Timestamp'],
  Payments: ['ID', 'Date', 'StudentID', 'AmountINR', 'Mode', 'LoggedBy', 'Timestamp'],
  Skills: ['StudentID', 'Skill', 'Date', 'LoggedBy', 'Timestamp'],
  Bookings: ['ID', 'Date', 'Car', 'Slot', 'Type', 'StudentID', 'Note', 'LoggedBy', 'Timestamp'],
  Requests: ['ID', 'Date', 'StudentID', 'Want', 'Note', 'Status', 'ClosedBy', 'Timestamp'],
  Activity: ['Timestamp', 'Name', 'Action', 'Ref'],
  QuizStats: ['Timestamp', 'Device', 'Event', 'Score', 'Total', 'Lang', 'Ready', 'Source']
};

/* columns kept as plain text so Sheets does not turn them into numbers or dates */
const TEXT_COLS = ['PIN', 'Ref', 'Slot', 'Car', 'ID', 'Date', 'JoinDate', 'CompletedDate', 'ReviewAsked', 'FollowUp', 'Phone', 'StudentID', 'EnquiryID', 'PackageID', 'Timestamp', 'Value', 'Skill',
  'LLDate', 'TestDate', 'Token', 'ReferredBy', 'Docs'];

const DEFAULT_SETTINGS = [
  ['SchoolName', 'Soni Motor Training School', ''],
  ['SchoolPhone', '', 'School WhatsApp number, 10 digits'],
  ['ReviewLink', 'https://g.page/r/CWKtBfMYEdoAEBM/review', 'Google review link from the Business Profile'],
  ['SlotStart', '06:30', 'Timetable: first slot of the day (HH:MM)'],
  ['SlotEnd', '20:00', 'Timetable: the last slot ends at this time (HH:MM)'],
  ['SlotMinutes', '30', 'Timetable: length of one slot in minutes'],
  ['Cars', '', 'Timetable: car names, comma-separated. Empty = the car names from Packages'],
  ['QuizLink', 'https://vnsr.github.io/soni-motor/quiz/', 'Public learner-licence practice quiz'],
  ['StudentLink', 'https://vnsr.github.io/soni-motor/student/', 'Student page: each student gets a private link to their progress'],
  ['OfficeAddress', '', 'Practice app: office address shown after someone sends the lessons form'],
  ['OfficeHours', '', 'Practice app: office hours, e.g. Mon–Sat 8:00–19:00'],
  ['ContactPerson', '', 'Practice app: contact person shown with the phone number, e.g. the proprietor'],
  ['MapLink', '', 'Practice app: Google Maps link to the office. Empty = directions to OfficeAddress'],
  ['OwnerEmail', '', 'Morning summary, Monday report and wrong-PIN alerts go here. Several: separate with commas'],
  ['ArchiveDays', '180', 'Students finished longer ago than this (and fully paid) stay in the Sheet but are no longer sent to the phones'],
  ['ReviewMsgGU', 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલમાં ડ્રાઇવિંગ શીખવા બદલ આભાર! તમારો અનુભવ ગૂગલ પર બે લીટીમાં લખશો તો બીજા લોકોને સ્કૂલ પસંદ કરવામાં મદદ થશે: {link}', '{name} = first name, {link} = ReviewLink'],
  ['ReviewMsgEN', 'Hello {name}, thank you for learning to drive with Soni Motor Training School! If you write two lines about your experience on Google, it helps others choose a school: {link}', ''],
  ['FollowMsgGU', 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલ તરફથી. ડ્રાઇવિંગ શીખવા વિશે પૂછપરછ કરવા બદલ આભાર. તમે ક્યારથી શરૂ કરવા માંગો છો?', ''],
  ['FollowMsgEN', 'Hello {name}, this is Soni Motor Training School. Thank you for your enquiry about driving lessons. When would you like to start?', ''],
  ['QuizMsgGU', 'નમસ્તે {name}, લર્નિંગ લાઇસન્સની પરીક્ષાની મફત પ્રેક્ટિસ અહીં કરો (ગુજરાતી અને અંગ્રેજીમાં): {quiz}', '{quiz} = QuizLink'],
  ['QuizMsgEN', 'Hello {name}, here is a free practice test for the learner licence exam (Gujarati and English): {quiz}', ''],
  ['DueMsgGU', 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલ તરફથી. તમારી ફીના {amount} બાકી છે. આવતા લેસન વખતે અથવા UPIથી ચૂકવી શકો છો. આભાર!', '{amount} = balance'],
  ['DueMsgEN', 'Hello {name}, this is Soni Motor Training School. {amount} of your fee is still due. You can pay at your next lesson or by UPI. Thank you!', ''],
  ['LLMsgGU', 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલ તરફથી. લર્નિંગ લાઇસન્સની પરીક્ષા ક્યારે છે? તૈયારી માટે મફત પ્રેક્ટિસ: {quiz} LL મળે પછી 30 દિવસમાં ગાડી શીખવાનું શરૂ કરો તો પાકા લાઇસન્સની ટેસ્ટ સમયસર આપી શકશો.', ''],
  ['LLMsgEN', 'Hello {name}, this is Soni Motor Training School. When is your learner licence test? Free practice: {quiz} If you start lessons once you have the LL, you will be ready for the driving test after the 30-day wait.', ''],
  ['StudentMsgGU', 'નમસ્તે {name}, તમારી ડ્રાઇવિંગ પ્રગતિ, આગળના લેસન અને લાઇસન્સની તારીખો અહીં જુઓ (ફક્ત તમારા માટે): {student}', '{student} = the student\'s private link'],
  ['StudentMsgEN', 'Hello {name}, see your driving progress, next lessons and licence dates here (this link is just for you): {student}', '']
];

/* Learner licence rules (Central Motor Vehicles Rules): the driving test can be taken 30 days after the
   learner licence is issued, and the learner licence is valid for 6 months. */
const LL_WAIT_DAYS = 30, LL_VALID_MONTHS = 6;
const DOCS = ['id', 'address', 'age', 'photos', 'll'];
const ID_RE = /^[A-Z]\d{6}-[A-Z0-9]{4,8}$/;

/* ================= web app (JSON API) ================= */
/**
 * Health check: opening the /exec URL in a browser shows this.
 * ?public=1 gives the public practice quiz the school's name, WhatsApp number, contact person,
 * office address, hours and map link (nothing else).
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.public === '1') return json_(publicInfo_(readSettings_(SpreadsheetApp.getActive())));
  return json_({ ok: true, app: 'soni-motor', version: VERSION });
}

function publicInfo_(s) {
  return { ok: true, school: s.SchoolName || '', phone: phone_(s.SchoolPhone),
    contact: clean_(s.ContactPerson).slice(0, 80), address: clean_(s.OfficeAddress), hours: clean_(s.OfficeHours), map: /^https:\/\//.test(String(s.MapLink || '')) ? clean_(s.MapLink) : '' };
}

/**
 * The phone app POSTs text/plain JSON: { pin, dev, action, payload }.
 * (text/plain keeps it a "simple" request, so browsers send it without a CORS preflight.)
 * Answers { ok: true, db, result } or { ok: false, error: 'PIN' | 'LOCKED' | message }.
 */
function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'Bad request' }); }
  const cache = CacheService.getScriptCache();
  if (req.action === 'quizStat') return json_(quizStat_(req.payload || {}, cache));   // public, anonymous, no PIN
  if (req.action === 'publicEnquiry') return json_(publicEnquiry_(req.payload || {}, cache));   // public lessons form, no PIN
  if (req.action === 'student') return json_(studentView_(req.payload || {}, cache));   // student's own page, private link
  if (req.action === 'studentRequest') return json_(studentRequest_(req.payload || {}, cache));
  return json_(guarded_(req, cache));
}

/** PIN check with per-phone and school-wide limits; see DEVICE_FAILS above. */
function guarded_(req, cache) {
  const dev = /^[a-z0-9]{8,32}$/.test(String(req.dev || '')) ? String(req.dev) : '';
  const kDev = 'pf:' + (dev || 'none');
  const devFails = Number(cache.get(kDev) || 0), allFails = Number(cache.get('pinFails') || 0);
  const trusted = dev && isTrusted_(dev);
  if (devFails >= DEVICE_FAILS || (allFails >= GLOBAL_FAILS && !trusted)) return { ok: false, error: 'LOCKED' };
  try {
    const r = api(req.pin, req.action, req.payload);
    if (devFails) cache.remove(kDev);
    if (dev && (!trusted || req.action === 'load')) trust_(dev, r.who);
    return { ok: true, db: r.db, result: r.result };
  } catch (err) {
    const m = String(err && err.message || err);
    if (m !== 'PIN') return { ok: false, error: m };
    cache.put(kDev, String(devFails + 1), LOCK_SECONDS);
    cache.put('pinFails', String(allFails + 1), LOCK_SECONDS);
    if (allFails + 1 === GLOBAL_FAILS) alertLock_(cache);
    return { ok: false, error: devFails + 1 >= DEVICE_FAILS ? 'LOCKED' : 'PIN' };
  }
}

/* A phone that logged in with a correct PIN is remembered for TRUST_DAYS (refreshed while it is used). */
function isTrusted_(dev) {
  const v = PropertiesService.getScriptProperties().getProperty('dev:' + dev);
  if (!v) return false;
  try { return JSON.parse(v).until >= today_(); } catch (e) { return false; }
}
function trust_(dev, who) {
  const props = PropertiesService.getScriptProperties(), k = 'dev:' + dev, until = addDays_(today_(), TRUST_DAYS);
  const old = props.getProperty(k);
  try { if (old && JSON.parse(old).until > addDays_(until, -7) && JSON.parse(old).name === who) return; } catch (e) { }
  props.setProperty(k, JSON.stringify({ name: who, until: until }));
}
/** Forget every remembered phone (run from the editor if a phone is lost; everyone then enters their PIN again). */
function forgetPhones() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('dev:') === 0) props.deleteProperty(k); });
  Logger.log('All phones forgotten. Each person enters their PIN again on next use.');
}

function alertLock_(cache) {
  if (cache.get('alerted')) return;
  cache.put('alerted', '1', 3600);
  const s = readSettings_(SpreadsheetApp.getActive());
  mail_(s, 'Soni Motor app: many wrong PINs',
    'In the last 15 minutes ' + GLOBAL_FAILS + ' wrong PINs were tried on the school app. Phones that have logged in before keep working; new phones are locked for 15 minutes.\n\n' +
    'If this was not one of you, someone may be guessing PINs. Give everyone a new PIN: in the Sheet, clear the PIN column in the Staff tab, then run setup in Apps Script.');
}

/**
 * Anonymous counts from the public practice quiz. No names or numbers: only a random device code
 * made on the student's phone, the event, the score, the language and where the link came from.
 * Throttled so a single phone (or a script) cannot flood the sheet.
 */
function quizStat_(p, cache) {
  const device = String(p.Device || ''), event = String(p.Event || '');
  if (!/^[a-z0-9]{6,20}$/.test(device) || ['open', 'test', 'book', 'share', 'form'].indexOf(event) < 0) return { ok: false, error: 'Bad stat' };
  const day = today_(), kAll = 'qall:' + day, kDev = 'qd:' + day + ':' + device;
  const all = Number(cache.get(kAll) || 0), mine = Number(cache.get(kDev) || 0);
  if (all >= 3000 || mine >= 40) return { ok: true, skipped: true };
  if (event === 'open') { const kOpen = 'qo:' + day + ':' + device; if (cache.get(kOpen)) return { ok: true, skipped: true }; cache.put(kOpen, '1', 21600); }
  cache.put(kAll, String(all + 1), 21600); cache.put(kDev, String(mine + 1), 21600);
  const n = function (x, max) { x = Math.round(num_(x)); return x >= 0 && x <= max ? x : ''; };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    append_(SpreadsheetApp.getActive(), 'QuizStats', { Timestamp: new Date().toISOString(), Device: device, Event: event,
      Score: event === 'test' ? n(p.Score, 50) : '', Total: event === 'test' ? n(p.Total, 50) : '',
      Lang: p.Lang === 'en' ? 'en' : 'gu', Ready: p.Ready === 'yes' ? 'yes' : (event === 'test' ? 'no' : ''),
      Source: String(p.Source || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) });
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/**
 * "Start driving lessons" form in the public practice app. Adds a row to Enquiries (Source Practice,
 * follow-up today) so the school sees it in the app. The person then visits the office.
 * Guarded: a hidden field that only bots fill, valid Indian mobile numbers only, at most 3 forms per
 * phone and 100 per day, and the same number within 30 days returns the existing enquiry.
 * Ref is the code of the student who shared the link (from the student's own page), if any.
 */
const FORM_WHEN = { morning: 'Morning / સવારે', afternoon: 'Afternoon / બપોરે', evening: 'Evening / સાંજે' };
const FORM_LL = { have: 'Has learner licence / LL છે', applied: 'LL applied / LL માટે અરજી કરી', no: 'No LL yet / હજી LL નથી' };
const FORM_GEAR = { manual: 'Manual', automatic: 'Automatic' };
function publicEnquiry_(p, cache) {
  if (String(p.Website || '')) return { ok: true, ref: '' };   // honeypot
  const name = clean_(p.Name).replace(/[<>"]/g, '').slice(0, 60);
  let phone = String(p.Phone || '').replace(/\D/g, '');
  if (phone.length === 12 && phone.slice(0, 2) === '91') phone = phone.slice(2);
  if (phone.length === 11 && phone[0] === '0') phone = phone.slice(1);
  if (name.length < 2) return { ok: false, error: 'NAME' };
  if (!/^[6-9]\d{9}$/.test(phone)) return { ok: false, error: 'PHONE' };
  const device = /^[a-z0-9]{6,20}$/.test(String(p.Device || '')) ? String(p.Device) : 'none';
  const day = today_(), kAll = 'eall:' + day, kDev = 'ed:' + day + ':' + device;
  const all = Number(cache.get(kAll) || 0), mine = Number(cache.get(kDev) || 0);
  if (all >= 100 || mine >= 3) return { ok: false, error: 'LIMIT' };
  cache.put(kAll, String(all + 1), 21600); cache.put(kDev, String(mine + 1), 21600);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive(), since = addDays_(day, -30);
    const dup = rows_(ss, 'Enquiries').filter(function (r) { return phone_(r.Phone) === phone && String(r.Date) >= since && r.Status !== 'Lost' && r.Status !== 'Joined'; })[0];
    if (dup) return { ok: true, ref: dup.ID, again: true };
    const src = String(p.Source || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    const referrer = refStudent_(ss, p.Ref);
    const note = [FORM_WHEN[p.When], FORM_LL[p.Licence], src && src !== 'direct' ? 'Link: ' + src : '', referrer ? 'Referred by ' + referrer.Name : ''].filter(Boolean).join(' · ');
    const now = new Date().toISOString();
    const r = { ID: newId_('E'), Date: day, Name: name, Phone: phone, Source: 'Practice', CarInterest: FORM_GEAR[p.Gear] || '', Note: note,
      Status: 'New', FollowUp: day, LoggedBy: 'Practice app form', Timestamp: now, LL: FORM_LL[p.Licence] ? p.Licence : '', ReferredBy: referrer ? referrer.ID : '' };
    append_(ss, 'Enquiries', r);
    append_(ss, 'Activity', { Timestamp: now, Name: 'Practice app form', Action: 'addEnquiry', Ref: r.ID });
    return { ok: true, ref: r.ID };
  } finally { lock.releaseLock(); }
}

/* The referral code in a shared link is the first 8 letters of the student's private token, so the
   student ID and the full token never appear in public links. */
function refStudent_(ss, ref) {
  ref = String(ref || '');
  if (!/^[a-z0-9]{8}$/.test(ref)) return null;
  return rows_(ss, 'Students').filter(function (s) { return String(s.Token || '').slice(0, 8) === ref; })[0] || null;
}

/* ================= student's own page (private link, no PIN) ================= */
function studentByToken_(ss, token, cache) {
  token = String(token || '');
  if (!/^[a-z0-9]{20,40}$/.test(token)) return { err: 'LINK' };
  const day = today_(), kAll = 'sall:' + day, kTok = 'st:' + day + ':' + token.slice(0, 8);
  const all = Number(cache.get(kAll) || 0), mine = Number(cache.get(kTok) || 0);
  if (all >= 3000 || mine >= 150) return { err: 'LIMIT' };
  cache.put(kAll, String(all + 1), 21600); cache.put(kTok, String(mine + 1), 21600);
  const s = rows_(ss, 'Students').filter(function (r) { return r.Token && String(r.Token) === token; })[0];
  return s ? { s: s } : { err: 'LINK' };
}

/** What a student sees on their own page: first name, progress, next lessons, money and licence dates. */
function studentView_(p, cache) {
  const ss = SpreadsheetApp.getActive(), f = studentByToken_(ss, p.Token, cache);
  if (f.err) return { ok: false, error: f.err };
  const s = f.s, settings = readSettings_(ss), td = today_();
  const pk = rows_(ss, 'Packages').filter(function (r) { return String(r.PackageID) === String(s.PackageID); })[0] || {};
  const lessons = rows_(ss, 'Lessons').filter(function (l) { return l.StudentID === s.ID; });
  const paid = rows_(ss, 'Payments').filter(function (x) { return x.StudentID === s.ID; }).reduce(function (a, x) { return a + num_(x.AmountINR); }, 0);
  const next = rows_(ss, 'Bookings').filter(function (b) { return b.StudentID === s.ID && b.Type === 'Booked' && b.Date >= td; })
    .sort(function (a, b) { return (a.Date + a.Slot).localeCompare(b.Date + b.Slot); }).slice(0, 5)
    .map(function (b) { return { date: b.Date, slot: b.Slot, car: b.Car }; });
  const req = rows_(ss, 'Requests').filter(function (r) { return r.StudentID === s.ID && r.Status === 'Open'; })
    .map(function (r) { return { date: r.Date, want: r.Want }; });
  return { ok: true, student: {
    name: String(s.Name || '').split(' ')[0], status: s.Status, car: pk.Car || '', transmission: pk.Transmission || '',
    done: lessons.length, total: num_(pk.Lessons), last: lessons.reduce(function (a, l) { return l.Date > a ? l.Date : a; }, ''),
    skills: rows_(ss, 'Skills').filter(function (k) { return k.StudentID === s.ID; }).map(function (k) { return k.Skill; }),
    price: num_(s.Price), paid: paid, licence: s.Licence, llDate: s.LLDate || '', testDate: s.TestDate || '', testResult: s.TestResult || '',
    docs: String(s.Docs || '').split(',').filter(String), next: next, requests: req, instructor: s.Instructor || '',
    ref: String(s.Token).slice(0, 8) },
    school: publicInfo_(settings), today: td,
    slots: { start: settings.SlotStart || '06:30', end: settings.SlotEnd || '20:00', minutes: num_(settings.SlotMinutes) || 30 } };
}

/** A student asks for a lesson time from their page. Staff see it on the app's home screen and book it. */
const WANT = ['morning', 'afternoon', 'evening'];
function studentRequest_(p, cache) {
  const ss = SpreadsheetApp.getActive(), f = studentByToken_(ss, p.Token, cache);
  if (f.err) return { ok: false, error: f.err };
  const s = f.s, d = date_(p.Date), td = today_();
  if (s.Status !== 'Active') return { ok: false, error: 'NOT_ACTIVE' };
  if (!d || d < td || d > addDays_(td, 30)) return { ok: false, error: 'DATE' };
  const want = WANT.indexOf(p.Want) >= 0 ? p.Want : (/^\d{2}:\d{2}$/.test(String(p.Want || '')) ? p.Want : '');
  if (!want) return { ok: false, error: 'WANT' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const open = rows_(ss, 'Requests').filter(function (r) { return r.StudentID === s.ID && r.Status === 'Open'; });
    if (open.length >= 3) return { ok: false, error: 'LIMIT' };
    const now = new Date().toISOString();
    const r = { ID: newId_('R'), Date: d, StudentID: s.ID, Want: want, Note: clean_(p.Note).replace(/[<>]/g, '').slice(0, 120), Status: 'Open', ClosedBy: '', Timestamp: now };
    append_(ss, 'Requests', r);
    append_(ss, 'Activity', { Timestamp: now, Name: 'Student page', Action: 'request', Ref: r.ID });
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Weekly quiz numbers for the app's Report: last 8 weeks, plus where people came from in the last 4. */
function quizSummary_(ss) {
  const rows = rows_(ss, 'QuizStats'); if (!rows.length) return null;
  const monday = function (iso) { const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
  const w0 = monday(today_()), weeks = {}, src = {};
  for (let i = 0; i < 8; i++) weeks[addDays_(w0, -7 * i)] = { devices: {}, opens: 0, tests: 0, ready: 0, book: 0, share: 0, form: 0 };
  const from4 = addDays_(w0, -21);
  rows.forEach(function (r) {
    const day = String(r.Timestamp).slice(0, 10), w = weeks[monday(day)];
    if (w) { w.devices[r.Device] = 1; if (r.Event === 'open') w.opens++; if (r.Event === 'test') { w.tests++; if (r.Ready === 'yes') w.ready++; } if (r.Event === 'book') w.book++; if (r.Event === 'share') w.share++; if (r.Event === 'form') w.form++; }
    if (r.Event === 'open' && day >= from4) { const k = r.Source || 'direct'; src[k] = (src[k] || 0) + 1; }
  });
  return { weeks: Object.keys(weeks).sort().map(function (k) { const w = weeks[k]; return { week: k, people: Object.keys(w.devices).length, tests: w.tests, ready: w.ready, book: w.book, share: w.share, form: w.form }; }), sources: src };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Single entry point for the app. Returns { db, result, who }.
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
      if (!(result && result.dup)) append_(ss, 'Activity', { Timestamp: now, Name: who, Action: action, Ref: clean_((result && result.ID) || p.ID || p.StudentID || '') });
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
  const db = loadDb_(ss, settings);
  db.me = user.personal ? who : '';
  return { db: db, result: result, who: who };
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

/* New rows may carry an ID made on the phone (NewID). A phone that saved something without signal
   sends it again later; if a row with that ID is already there, the second send changes nothing. */
function idFor_(p, prefix) {
  const id = String(p.NewID || '');
  return ID_RE.test(id) && id[0] === prefix ? id : newId_(prefix);
}
function already_(ss, tab, id) {
  const hit = rows_(ss, tab).filter(function (r) { return r.ID === id; })[0];
  if (hit) hit.dup = true;
  return hit || null;
}

function write_(ss, action, p, who, now) {
  switch (action) {
    case 'addEnquiry': {
      const id = idFor_(p, 'E'), dup = already_(ss, 'Enquiries', id); if (dup) return dup;
      const r = { ID: id, Date: today_(), Name: clean_(p.Name), Phone: phone_(p.Phone), Source: clean_(p.Source), CarInterest: clean_(p.CarInterest),
        Note: clean_(p.Note), Status: 'New', FollowUp: date_(p.FollowUp), LoggedBy: who, Timestamp: now, LL: '', ReferredBy: ID_RE.test(String(p.ReferredBy || '')) ? p.ReferredBy : '' };
      append_(ss, 'Enquiries', r); return r;
    }
    case 'updateEnquiry':
      update_(ss, 'Enquiries', p.ID, pick_(p, ['Status', 'FollowUp', 'Note', 'CarInterest'])); return null;

    case 'addStudent': {
      const id = idFor_(p, 'S'), dup = already_(ss, 'Students', id); if (dup) return dup;
      const r = { ID: id, JoinDate: today_(), Name: clean_(p.Name), Phone: phone_(p.Phone), PackageID: clean_(p.PackageID), Price: num_(p.Price),
        Instructor: clean_(p.Instructor), Licence: clean_(p.Licence) || 'None', Status: 'Active', CompletedDate: '', ReviewAsked: '', ReviewDone: '',
        EnquiryID: clean_(p.EnquiryID), Notes: '', LoggedBy: who, Timestamp: now, LLDate: date_(p.LLDate), TestDate: '', TestResult: '', Docs: '', Token: '' };
      append_(ss, 'Students', r);
      if (r.EnquiryID) update_(ss, 'Enquiries', r.EnquiryID, { Status: 'Joined' });
      if (num_(p.PayAmount) > 0) append_(ss, 'Payments', { ID: newId_('P'), Date: today_(), StudentID: r.ID, AmountINR: num_(p.PayAmount), Mode: clean_(p.PayMode) || 'Cash', LoggedBy: who, Timestamp: now });
      return r;
    }
    case 'updateStudent':
      update_(ss, 'Students', p.ID, pick_(p, ['Status', 'CompletedDate', 'ReviewAsked', 'ReviewDone', 'Licence', 'Notes', 'Instructor', 'Price', 'LLDate', 'TestDate', 'TestResult', 'Docs'])); return null;

    case 'studentLink': {
      /* p: { ID, Renew } — the student's private page link; Renew makes a new one and the old link stops working */
      const s = rows_(ss, 'Students').filter(function (r) { return r.ID === p.ID; })[0];
      if (!s) throw new Error('Not found: ' + p.ID);
      if (s.Token && !p.Renew) return { ID: s.ID, Token: s.Token };
      const token = token_();
      update_(ss, 'Students', s.ID, { Token: token });
      return { ID: s.ID, Token: token };
    }

    case 'logLesson': {
      const id = idFor_(p, 'L'), all = rows_(ss, 'Lessons');
      const dup = all.filter(function (l) { return l.ID === id; })[0]; if (dup) { dup.dup = true; return dup; }
      const n = all.filter(function (l) { return l.StudentID === p.StudentID; }).length + 1;
      const r = { ID: id, Date: date_(p.Date) || today_(), StudentID: clean_(p.StudentID), LessonNo: n, Instructor: clean_(p.Instructor), LoggedBy: who, Timestamp: now };
      append_(ss, 'Lessons', r); return r;
    }
    case 'undoLesson':
      remove_(ss, 'Lessons', function (r) { return r.ID === p.ID; }); return null;

    case 'addPayment': {
      const amt = num_(p.AmountINR); if (!(amt > 0)) throw new Error('Amount');
      const id = idFor_(p, 'P'), dup = already_(ss, 'Payments', id); if (dup) return dup;
      const r = { ID: id, Date: date_(p.Date) || today_(), StudentID: clean_(p.StudentID), AmountINR: amt, Mode: clean_(p.Mode) || 'Cash', LoggedBy: who, Timestamp: now };
      append_(ss, 'Payments', r); return r;
    }
    case 'setSkill': {
      /* p: { StudentID, Skill, On } — ticks or unticks one item on the progress card */
      remove_(ss, 'Skills', function (r) { return r.StudentID === p.StudentID && r.Skill === p.Skill; });
      if (p.On) append_(ss, 'Skills', { StudentID: clean_(p.StudentID), Skill: clean_(p.Skill), Date: today_(), LoggedBy: who, Timestamp: now });
      return null;
    }
    case 'setSlots': {
      /* p: { Date, Car, Slots: ['06:30', …], Type: 'Booked' | 'Blocked', StudentID, Note, Days, RequestID }
         Days > 1 repeats a block on the following days. A slot that is already taken is refused with TAKEN,
         unless p.Replace is set (the person tapped that exact slot and chose to change it).
         RequestID closes the student's request that this booking answers. */
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
      if (p.RequestID) closeRequest_(ss, p.RequestID, 'Booked', who);
      return { ID: out.length ? out[0].ID : '', count: out.length };
    }
    case 'clearSlots': {
      const car = clean_(p.Car), d = date_(p.Date), slots = (p.Slots || []).map(clean_);
      remove_(ss, 'Bookings', function (b) { return b.Car === car && b.Date === d && slots.indexOf(b.Slot) >= 0; });
      return null;
    }
    case 'closeRequest':
      closeRequest_(ss, p.ID, p.Status === 'Booked' ? 'Booked' : 'Declined', who); return null;
    default:
      throw new Error('Unknown action: ' + action);
  }
}

function closeRequest_(ss, id, status, who) { update_(ss, 'Requests', id, { Status: status, ClosedBy: who }); }

/* ================= reading ================= */
function loadDb_(ss, settings) {
  const pub = {};
  Object.keys(settings).forEach(function (k) { if (k !== 'PIN') pub[k] = settings[k]; });
  const td = today_(), cutoff = addDays_(td, -Math.max(30, num_(settings.ArchiveDays) || 180));
  const packages = rows_(ss, 'Packages');
  const allStudents = rows_(ss, 'Students').map(function (r) { r.Price = num_(r.Price); return r; });
  const allLessons = rows_(ss, 'Lessons').map(function (r) { r.LessonNo = num_(r.LessonNo); return r; });
  const allPayments = rows_(ss, 'Payments').map(function (r) { r.AmountINR = num_(r.AmountINR); return r; });
  const paidBy = {}; allPayments.forEach(function (x) { paidBy[x.StudentID] = (paidBy[x.StudentID] || 0) + x.AmountINR; });
  /* Students who finished (or dropped out) before the archive cut-off, and owe nothing, stay in the Sheet but
     are not sent to the phones: it keeps each phone's copy small and fewer old numbers on the phones. */
  const keep = {};
  allStudents.forEach(function (s) {
    const ended = s.Status === 'Completed' || s.Status === 'Dropped';
    const endDate = String(s.CompletedDate || s.JoinDate || '');
    const owes = s.Status === 'Completed' && s.Price - (paidBy[s.ID] || 0) > 0;
    if (!ended || endDate >= cutoff || owes) keep[s.ID] = 1;
  });
  const mine = function (r) { return keep[r.StudentID]; };
  return {
    version: VERSION,
    today: td,
    settings: pub,
    staff: rows_(ss, 'Staff').filter(function (r) { return String(r.Active).toLowerCase() !== 'no'; }).map(function (r) { return r.Name; }).filter(String),
    packages: packages.filter(function (r) { return r.PackageID && String(r.Active).toLowerCase() !== 'no'; })
      .map(function (r) { r.Lessons = num_(r.Lessons); r.MinutesPerLesson = num_(r.MinutesPerLesson); r.PriceINR = num_(r.PriceINR); return r; }),
    enquiries: rows_(ss, 'Enquiries').filter(function (e) { return e.Status === 'New' || e.Status === 'Follow-up' || String(e.Date) >= cutoff; }),
    students: allStudents.filter(function (s) { return keep[s.ID]; }),
    lessons: allLessons.filter(mine),
    payments: allPayments.filter(mine),
    skills: rows_(ss, 'Skills').filter(mine),
    /* timetable: last 14 days to 90 days ahead keeps the phone's copy small */
    bookings: (function () { const from = addDays_(td, -14), to = addDays_(td, 90);
      return rows_(ss, 'Bookings').filter(function (b) { return b.Date >= from && b.Date <= to; }); })(),
    requests: rows_(ss, 'Requests').filter(function (r) { return r.Status === 'Open'; }),
    money: money_(allStudents, allPayments, packages, td),
    archived: allStudents.length - Object.keys(keep).length,
    quiz: quizSummary_(ss)
  };
}

/** Money received per month (last 12 months) and per car (last 6 months), from every payment in the Sheet. */
function money_(students, payments, packages, td) {
  const carOf = {}, pk = {};
  packages.forEach(function (p) { pk[String(p.PackageID)] = p.Car; });
  students.forEach(function (s) { carOf[s.ID] = pk[String(s.PackageID)] || '–'; });
  const months = {}, y = Number(td.slice(0, 4)), m = Number(td.slice(5, 7));
  for (let i = 0; i < 12; i++) months[new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7)] = 0;
  const from6 = addDays_(td, -183), byCar = {};
  payments.forEach(function (x) {
    const k = String(x.Date).slice(0, 7); if (k in months) months[k] += x.AmountINR;
    if (String(x.Date) >= from6) { const c = carOf[x.StudentID] || '–'; byCar[c] = (byCar[c] || 0) + x.AmountINR; }
  });
  return { months: Object.keys(months).sort().map(function (k) { return { month: k, inr: months[k] }; }), byCar: byCar };
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
function addMonths_(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
function today_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }
function newId_(prefix) { return prefix + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function token_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 32); }
function clean_(s) { return String(s == null ? '' : s).trim().slice(0, 300); }
function phone_(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
function num_(x) { const n = Number(String(x == null ? '' : x).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; }
function date_(s) { s = String(s || ''); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
const DATE_KEYS = ['LLDate', 'TestDate'];
function pick_(p, keys) {
  const o = {};
  keys.forEach(function (k) {
    if (p[k] === undefined) return;
    if (k === 'Price') o[k] = num_(p[k]);
    else if (DATE_KEYS.indexOf(k) >= 0) o[k] = date_(p[k]);
    else if (k === 'TestResult') o[k] = ['Pass', 'Fail'].indexOf(p[k]) >= 0 ? p[k] : '';
    else if (k === 'Docs') o[k] = String(p[k] || '').split(',').filter(function (x) { return DOCS.indexOf(x) >= 0; }).join(',');
    else o[k] = clean_(p[k]);
  });
  return o;
}
function inr_(n) { return '₹' + Math.round(n).toString().replace(/\B(?=(\d{2})*(\d{3})(?!\d))/g, ','); }

/* ================= daily jobs (run installTriggers once) ================= */
/** Sets up the morning email (7:00), the Monday report (8:00) and the Sunday-night backup. Safe to run again. */
function installTriggers() {
  const want = { dailyDigest: 1, weeklyReport: 1, weeklyBackup: 1 };
  ScriptApp.getProjectTriggers().forEach(function (t) { if (want[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyDigest').timeBased().atHour(7).everyDays(1).inTimezone('Asia/Kolkata').create();
  ScriptApp.newTrigger('weeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone('Asia/Kolkata').create();
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).inTimezone('Asia/Kolkata').create();
  const s = readSettings_(SpreadsheetApp.getActive());
  Logger.log('Daily jobs set up.' + (s.OwnerEmail ? ' Emails go to ' + s.OwnerEmail + '.' : ' Fill OwnerEmail in Settings to get the emails.'));
}

function mail_(settings, subject, text, html) {
  const to = String(settings.OwnerEmail || '').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return /@/.test(x); }).join(',');
  if (!to) return false;
  MailApp.sendEmail({ to: to, subject: subject, body: text, htmlBody: html || undefined, name: settings.SchoolName || 'Soni Motor' });
  return true;
}

/** What needs doing, worked out from the same data the phones see. Used by the morning email and the app. */
function digest_(db) {
  const td = db.today, tm = addDays_(td, 1), yd = addDays_(td, -1);
  const pk = {}; db.packages.forEach(function (p) { pk[String(p.PackageID)] = p; });
  const done = {}; db.lessons.forEach(function (l) { done[l.StudentID] = (done[l.StudentID] || 0) + 1; });
  const paid = {}; db.payments.forEach(function (x) { paid[x.StudentID] = (paid[x.StudentID] || 0) + x.AmountINR; });
  const name = {}; db.students.forEach(function (s) { name[s.ID] = s.Name; });
  const S = db.students.map(function (s) { const p = pk[String(s.PackageID)] || {}; return { s: s, tot: num_(p.Lessons), done: done[s.ID] || 0, bal: Math.max(0, s.Price - (paid[s.ID] || 0)) }; });
  const booked = function (d) { return db.bookings.filter(function (b) { return b.Date === d && b.Type === 'Booked'; }).sort(function (a, b) { return (a.Car + a.Slot).localeCompare(b.Car + b.Slot); })
    .map(function (b) { return { car: b.Car, slot: b.Slot, name: name[b.StudentID] || b.StudentID }; }); };
  return {
    today: td,
    bookings: booked(td),
    tomorrow: booked(tm),
    follow: db.enquiries.filter(function (e) { return (e.Status === 'New' || e.Status === 'Follow-up') && (!e.FollowUp || e.FollowUp <= td); }).map(function (e) { return e.Name; }),
    dues: S.filter(function (x) { return x.s.Status !== 'Dropped' && x.bal > 0 && x.tot && x.done >= Math.ceil(x.tot / 2); }).map(function (x) { return { name: x.s.Name, inr: x.bal }; }),
    finished: S.filter(function (x) { return x.s.Status === 'Active' && x.tot && x.done >= x.tot; }).map(function (x) { return x.s.Name; }),
    llExpiring: S.filter(function (x) { return x.s.Status === 'Active' && x.s.LLDate && x.s.TestResult !== 'Pass' && addMonths_(x.s.LLDate, LL_VALID_MONTHS) <= addDays_(td, 30); })
      .map(function (x) { return { name: x.s.Name, until: addMonths_(x.s.LLDate, LL_VALID_MONTHS) }; }),
    tests: S.filter(function (x) { return x.s.TestDate && x.s.TestDate >= td && x.s.TestDate <= addDays_(td, 7) && !x.s.TestResult; }).map(function (x) { return { name: x.s.Name, date: x.s.TestDate }; }),
    requests: db.requests.map(function (r) { return { name: name[r.StudentID] || r.StudentID, date: r.Date, want: r.Want }; }),
    yLessons: db.lessons.filter(function (l) { return l.Date === yd; }).length,
    yMoney: db.payments.filter(function (x) { return x.Date === yd; }).reduce(function (a, x) { return a + x.AmountINR; }, 0)
  };
}

/** Morning email to the owner: today's timetable and what needs doing. */
function dailyDigest() {
  const ss = SpreadsheetApp.getActive(), settings = readSettings_(ss), db = loadDb_(ss, settings), d = digest_(db);
  const L = [], H = [];
  const sec = function (title, items) { if (!items.length) return; L.push('', title); items.forEach(function (x) { L.push('  ' + x); });
    H.push('<h3 style="margin:16px 0 4px;font-size:15px">' + esc_(title) + '</h3><ul style="margin:0;padding-left:18px">' + items.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>'); };
  sec('Today\'s lessons (' + d.bookings.length + ')', d.bookings.map(function (b) { return b.slot + '  ' + b.car + '  ' + b.name; }));
  sec('Slot requests from students', d.requests.map(function (r) { return r.name + ': ' + r.date + ', ' + r.want; }));
  sec('Follow up today', d.follow);
  sec('Driving tests this week', d.tests.map(function (x) { return x.date + '  ' + x.name; }));
  sec('Learner licence runs out soon', d.llExpiring.map(function (x) { return x.name + ' (until ' + x.until + ')'; }));
  sec('Fees to collect', d.dues.map(function (x) { return x.name + '  ' + inr_(x.inr); }));
  sec('All lessons done, mark complete', d.finished);
  const head = 'Yesterday: ' + d.yLessons + ' lessons, ' + inr_(d.yMoney) + ' received. Tomorrow: ' + d.tomorrow.length + ' lessons booked.';
  const sent = mail_(settings, (settings.SchoolName || 'Soni Motor') + ' · ' + d.today, head + '\n' + L.join('\n'),
    '<div style="font-family:sans-serif;font-size:14px;color:#16181D"><p>' + esc_(head) + '</p>' + H.join('') + '</div>');
  Logger.log(sent ? 'Morning email sent.' : 'OwnerEmail is empty in Settings; nothing sent.\n' + head + '\n' + L.join('\n'));
}

/** Monday email: last week's numbers. */
function weeklyReport() {
  const ss = SpreadsheetApp.getActive(), settings = readSettings_(ss), db = loadDb_(ss, settings), r = weekNumbers_(db, addDays_(mondayOf_(db.today), -7));
  const lines = [
    'Week of ' + r.week,
    'Enquiries: ' + r.enquiries + ' (joined from the last 4 weeks: ' + r.joined4 + ' of ' + r.enq4 + ')',
    'New students: ' + r.students,
    'Lessons: ' + r.lessons + Object.keys(r.byTrainer).map(function (k) { return '\n  ' + k + ': ' + r.byTrainer[k]; }).join(''),
    'Money received: ' + inr_(r.money),
    'Money still to collect: ' + inr_(r.owed),
    'Timetable used: ' + Object.keys(r.cars).map(function (c) { return c + ' ' + r.cars[c] + '%'; }).join(', ')
  ];
  if (r.quiz) lines.push('Practice app: ' + r.quiz.people + ' people, ' + r.quiz.tests + ' tests, ' + r.quiz.form + ' lesson forms');
  const sent = mail_(settings, (settings.SchoolName || 'Soni Motor') + ' · week of ' + r.week, lines.join('\n'));
  Logger.log((sent ? 'Weekly report sent.\n' : 'OwnerEmail is empty; not sent.\n') + lines.join('\n'));
}

function mondayOf_(s) { const d = new Date(s + 'T00:00:00Z'); return addDays_(s, -((d.getUTCDay() + 6) % 7)); }
function weekNumbers_(db, w) {
  const end = addDays_(w, 7), inW = function (d) { return d && String(d) >= w && String(d) < end; };
  const lessons = db.lessons.filter(function (l) { return inW(l.Date); }), byTrainer = {};
  lessons.forEach(function (l) { const k = l.Instructor || '–'; byTrainer[k] = (byTrainer[k] || 0) + 1; });
  const from4 = addDays_(w, -21), e4 = db.enquiries.filter(function (e) { return e.Date >= from4 && e.Date < end; });
  const paid = {}; db.payments.forEach(function (x) { paid[x.StudentID] = (paid[x.StudentID] || 0) + x.AmountINR; });
  const slotsPerDay = Math.max(1, Math.floor((toMin_(db.settings.SlotEnd, 1200) - toMin_(db.settings.SlotStart, 390)) / Math.max(10, num_(db.settings.SlotMinutes) || 30)));
  const cars = {};
  carList_(db).forEach(function (c) { const n = db.bookings.filter(function (b) { return b.Car === c && b.Type === 'Booked' && inW(b.Date); }).length; cars[c] = Math.round(n / (slotsPerDay * 7) * 100); });
  const q = db.quiz && db.quiz.weeks.filter(function (x) { return x.week === w; })[0];
  return { week: w, enquiries: db.enquiries.filter(function (e) { return inW(e.Date); }).length, enq4: e4.length, joined4: e4.filter(function (e) { return e.Status === 'Joined'; }).length,
    students: db.students.filter(function (s) { return inW(s.JoinDate); }).length, lessons: lessons.length, byTrainer: byTrainer,
    money: db.payments.filter(function (x) { return inW(x.Date); }).reduce(function (a, x) { return a + x.AmountINR; }, 0),
    owed: db.students.filter(function (s) { return s.Status !== 'Dropped'; }).reduce(function (a, s) { return a + Math.max(0, s.Price - (paid[s.ID] || 0)); }, 0),
    cars: cars, quiz: q || null };
}
function toMin_(x, d) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(x || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : d; }
function carList_(db) {
  const set = db.settings.Cars;
  const list = set ? String(set).split(',').map(function (x) { return x.trim(); }) : db.packages.map(function (p) { return String(p.Car || '').trim(); });
  return list.filter(function (c, i) { return c && !/EDIT/i.test(c) && list.indexOf(c) === i; });
}
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/** A copy of the whole Sheet into the Drive folder "Soni Motor backups"; the newest 8 copies are kept. */
function weeklyBackup() {
  const ss = SpreadsheetApp.getActive(), name = 'Soni Motor backups';
  const it = DriveApp.getFoldersByName(name), folder = it.hasNext() ? it.next() : DriveApp.createFolder(name);
  DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + ' · backup ' + today_(), folder);
  const files = []; const fi = folder.getFiles(); while (fi.hasNext()) files.push(fi.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); }).slice(8).forEach(function (f) { f.setTrashed(true); });
  Logger.log('Backup saved in Drive → ' + name + '. Copies kept: ' + Math.min(8, files.length));
}

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

/** Every active person without a PIN gets a random 6-digit one that nobody else has. */
function givePins_(ss) {
  const sh = ss.getSheetByName('Staff');
  const v = sh.getDataRange().getValues(), h = v[0].map(String);
  const cN = h.indexOf('Name'), cP = h.indexOf('PIN'), cA = h.indexOf('Active');
  const used = {};
  for (let i = 1; i < v.length; i++) if (String(v[i][cP]).trim()) used[String(v[i][cP]).trim()] = 1;
  for (let i = 1; i < v.length; i++) {
    const name = String(v[i][cN]).trim();
    if (!name || String(v[i][cP]).trim()) continue;
    const pin = newPin_(used);
    sh.getRange(i + 1, cP + 1).setValue(pin);
    if (cA >= 0 && !String(v[i][cA]).trim()) sh.getRange(i + 1, cA + 1).setValue('Yes');
    Logger.log('PIN for ' + name + ': ' + pin + '  (Staff tab)');
  }
}
function newPin_(used) {
  const lo = Math.pow(10, PIN_DIGITS - 1);
  let pin; do { pin = String(lo + Math.floor(Math.random() * 9 * lo)); } while (used[pin]);
  used[pin] = 1;
  return pin;
}

/** Gives everyone whose PIN is shorter than 6 digits a new 6-digit PIN. Run from the editor, then tell each person their new PIN. */
function upgradeShortPins() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Staff');
  const v = sh.getDataRange().getValues(), h = v[0].map(String), cN = h.indexOf('Name'), cP = h.indexOf('PIN');
  const used = {}; for (let i = 1; i < v.length; i++) used[String(v[i][cP]).trim()] = 1;
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    const old = String(v[i][cP]).trim();
    if (!String(v[i][cN]).trim() || old.length >= PIN_DIGITS) continue;
    const pin = newPin_(used); sh.getRange(i + 1, cP + 1).setValue(pin); n++;
    Logger.log('New PIN for ' + String(v[i][cN]).trim() + ': ' + pin);
  }
  Logger.log(n ? n + ' PINs changed. The old PINs stop working now.' : 'All PINs already have ' + PIN_DIGITS + ' digits or more.');
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
  if (!s.OwnerEmail) issues.push('Settings: OwnerEmail is empty (no morning email, Monday report or wrong-PIN alert)');
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
    else if (!/^\d{4,8}$/.test(pin)) issues.push('Staff: ' + r.Name + "'s PIN should be 6 to 8 digits");
    else if (pin.length < PIN_DIGITS) issues.push('Staff: ' + r.Name + "'s PIN has only " + pin.length + ' digits (run upgradeShortPins for a 6-digit one)');
    else if (seen[pin]) issues.push('Staff: ' + r.Name + ' and ' + seen[pin] + ' have the same PIN');
    if (pin && !seen[pin]) seen[pin] = r.Name;
  });
  const triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (triggers.indexOf('dailyDigest') < 0) issues.push('Daily jobs: run installTriggers once (morning email, Monday report, weekly backup)');
  Logger.log(issues.length ? 'Still to do:\n- ' + issues.join('\n- ') : 'Setup complete. Ready for go-live.');
  return issues;
}
