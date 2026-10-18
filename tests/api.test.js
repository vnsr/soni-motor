const test = require('node:test');
const assert = require('node:assert/strict');
const { load, ready } = require('./gas');

const RAVI = '482913', OFFICE = '775031';

test('setup makes every tab and 6-digit PINs', () => {
  const env = load();
  env.g.setup();
  for (const t of ['Settings', 'Staff', 'Packages', 'Enquiries', 'Students', 'Lessons', 'Payments', 'Skills', 'Bookings', 'Requests', 'Activity', 'QuizStats']) assert.ok(env.ss.getSheetByName(t), t);
  const pins = env.tab('Staff').map(r => String(r.PIN));
  assert.equal(pins.length, 2);
  pins.forEach(p => assert.match(p, /^\d{6}$/));
});

test('a correct PIN loads the data and names the person', () => {
  const env = ready();
  const r = env.post({ pin: RAVI, dev: 'phoneaaaa1', action: 'load' });
  assert.equal(r.ok, true);
  assert.equal(r.db.me, 'Ravi');
  assert.equal(r.db.settings.PIN, undefined);
});

test('one phone guessing wrong is locked, others are not', () => {
  const env = ready();
  for (let i = 0; i < 4; i++) assert.equal(env.post({ pin: '000000', dev: 'attacker01', action: 'load' }).error, 'PIN');
  assert.equal(env.post({ pin: '000000', dev: 'attacker01', action: 'load' }).error, 'LOCKED');
  assert.equal(env.post({ pin: RAVI, dev: 'attacker01', action: 'load' }).error, 'LOCKED');
  assert.equal(env.post({ pin: RAVI, dev: 'staffphone', action: 'load' }).ok, true);
});

test('many wrong PINs lock new phones, but phones that logged in before keep working', () => {
  const env = ready();
  assert.equal(env.post({ pin: RAVI, dev: 'ravisphone', action: 'load' }).ok, true);
  for (let i = 0; i < 30; i++) env.post({ pin: String(100000 + i), dev: 'rotating' + String(i).padStart(2, '0'), action: 'load' });
  assert.equal(env.post({ pin: OFFICE, dev: 'brandnew01', action: 'load' }).error, 'LOCKED');
  assert.equal(env.post({ pin: RAVI, dev: 'ravisphone', action: 'load' }).ok, true);
  assert.equal(env.mails.length, 1, 'owner is emailed once');
  assert.match(env.mails[0].subject, /wrong PINs/);
});

test('the name always comes from the PIN, not from the phone', () => {
  const env = ready();
  const r = env.post({ pin: OFFICE, dev: 'officephon', action: 'addEnquiry', payload: { Name: 'Asha', Phone: '9800000001', LoggedBy: 'Ravi' } });
  assert.equal(r.result.LoggedBy, 'Office');
});

test('a change sent twice with the same NewID is saved once', () => {
  const env = ready();
  const send = () => env.post({ pin: RAVI, dev: 'ravisphone', action: 'addStudent', payload: { NewID: 'S261018-AB12CD', Name: 'Kiran', Phone: '9800000002', PackageID: 'P1', Price: 5000 } });
  send(); const r2 = send();
  assert.equal(r2.ok, true);
  assert.equal(env.tab('Students').length, 1);
  const lesson = () => env.post({ pin: RAVI, dev: 'ravisphone', action: 'logLesson', payload: { NewID: 'L261018-XY98ZW', StudentID: 'S261018-AB12CD', Date: '2026-10-18', Instructor: 'Ravi' } });
  lesson(); lesson();
  assert.equal(env.tab('Lessons').length, 1);
  const pay = () => env.post({ pin: RAVI, dev: 'ravisphone', action: 'addPayment', payload: { NewID: 'P261018-QQ11WW', StudentID: 'S261018-AB12CD', AmountINR: 2000 } });
  pay(); pay();
  assert.equal(env.tab('Payments').length, 1);
  assert.equal(env.tab('Activity').filter(a => a.Action !== 'login').length, 3, 'repeats are not logged again');
});

test('an ID with the wrong letter or shape is replaced', () => {
  const env = ready();
  const r = env.post({ pin: RAVI, dev: 'ravisphone', action: 'addEnquiry', payload: { NewID: 'S261018-AB12CD', Name: 'X', Phone: '9800000003' } });
  assert.match(r.result.ID, /^E\d{6}-/);
});

test('old finished students are not sent to the phones, but students who owe money are', () => {
  const env = ready({ now: '2026-10-18T06:00:00Z' });
  const st = env.ss.getSheetByName('Students'), h = st.rows[0];
  const row = o => h.map(k => o[k] === undefined ? '' : o[k]);
  st.rows.push(row({ ID: 'S250101-OLD1', JoinDate: '2025-01-01', Name: 'Old Paid', PackageID: 'P1', Price: 5000, Status: 'Completed', CompletedDate: '2025-02-01' }));
  st.rows.push(row({ ID: 'S250101-OLD2', JoinDate: '2025-01-01', Name: 'Old Owes', PackageID: 'P1', Price: 5000, Status: 'Completed', CompletedDate: '2025-02-01' }));
  st.rows.push(row({ ID: 'S261001-NEW1', JoinDate: '2026-10-01', Name: 'New', PackageID: 'P1', Price: 5000, Status: 'Active' }));
  const pay = env.ss.getSheetByName('Payments'), ph = pay.rows[0];
  pay.rows.push(ph.map(k => ({ ID: 'P1', Date: '2025-01-01', StudentID: 'S250101-OLD1', AmountINR: 5000 })[k] || ''));
  const db = env.post({ pin: RAVI, dev: 'ravisphone', action: 'load' }).db;
  assert.deepEqual(db.students.map(s => s.Name).sort(), ['New', 'Old Owes']);
  assert.equal(db.archived, 1);
  assert.equal(db.payments.length, 0);
  assert.equal(db.money.months.length, 12);
  assert.equal(db.money.months[11].month, '2026-10');
});

test('student page: private link, progress, and slot requests', () => {
  const env = ready();
  const P = (action, payload) => env.post({ pin: RAVI, dev: 'ravisphone', action, payload });
  const s = P('addStudent', { Name: 'Meera Shah', Phone: '9800000004', PackageID: 'P2', Price: 6000, PayAmount: 2000 }).result;
  P('logLesson', { StudentID: s.ID, Instructor: 'Ravi' });
  P('setSkill', { StudentID: s.ID, Skill: 'controls', On: true });
  const link = P('studentLink', { ID: s.ID }).result;
  assert.match(link.Token, /^[a-z0-9]{32}$/);
  assert.equal(P('studentLink', { ID: s.ID }).result.Token, link.Token, 'same link until renewed');

  const v = env.post({ action: 'student', payload: { Token: link.Token } });
  assert.equal(v.ok, true);
  assert.equal(v.student.name, 'Meera');
  assert.equal(v.student.done, 1);
  assert.equal(v.student.total, 12);
  assert.equal(v.student.paid, 2000);
  assert.deepEqual(v.student.skills, ['controls']);
  assert.equal(v.student.phone, undefined, 'no phone number on the student page');
  assert.equal(env.post({ action: 'student', payload: { Token: 'x'.repeat(32) } }).error, 'LINK');

  const day = v.today;
  assert.equal(env.post({ action: 'studentRequest', payload: { Token: link.Token, Date: day, Want: 'evening' } }).ok, true);
  assert.equal(env.post({ action: 'studentRequest', payload: { Token: link.Token, Date: '2020-01-01', Want: 'evening' } }).error, 'DATE');
  const db = P('load').db;
  assert.equal(db.requests.length, 1);
  P('setSlots', { Car: 'Baleno', Date: day, Slots: ['18:00'], Type: 'Booked', StudentID: s.ID, RequestID: db.requests[0].ID });
  assert.equal(P('load').db.requests.length, 0, 'booking closes the request');

  const renewed = P('studentLink', { ID: s.ID, Renew: true }).result.Token;
  assert.notEqual(renewed, link.Token);
  assert.equal(env.post({ action: 'student', payload: { Token: link.Token } }).error, 'LINK', 'old link stops working');
});

test('lessons form: referral code from a student link is recorded', () => {
  const env = ready();
  const s = env.post({ pin: RAVI, dev: 'ravisphone', action: 'addStudent', payload: { Name: 'Riya Patel', Phone: '9800000005', PackageID: 'P1', Price: 5000 } }).result;
  const tok = env.post({ pin: RAVI, dev: 'ravisphone', action: 'studentLink', payload: { ID: s.ID } }).result.Token;
  const r = env.post({ action: 'publicEnquiry', payload: { Name: 'Dev', Phone: '9123456780', Licence: 'applied', Device: 'abcdef12', Ref: tok.slice(0, 8) } });
  assert.equal(r.ok, true);
  const e = env.tab('Enquiries')[0];
  assert.equal(e.ReferredBy, s.ID);
  assert.equal(e.LL, 'applied');
  assert.match(e.Note, /Referred by Riya Patel/);
});

test('licence dates are checked and the morning email lists what needs doing', () => {
  const env = ready({ now: '2026-10-18T01:00:00Z' });
  const P = (action, payload) => env.post({ pin: RAVI, dev: 'ravisphone', action, payload });
  const s = P('addStudent', { Name: 'Jay Mehta', Phone: '9800000006', PackageID: 'P1', Price: 5000 }).result;
  P('updateStudent', { ID: s.ID, LLDate: '2026-05-01', TestDate: 'soon', TestResult: 'Maybe', Docs: 'id,photos,bogus' });
  const row = env.tab('Students')[0];
  assert.equal(row.LLDate, '2026-05-01');
  assert.equal(row.TestDate, '');
  assert.equal(row.TestResult, '');
  assert.equal(row.Docs, 'id,photos');
  for (let i = 0; i < 8; i++) P('logLesson', { StudentID: s.ID, Date: '2026-10-17' });
  P('setSlots', { Car: 'Swift', Date: '2026-10-18', Slots: ['07:00'], Type: 'Booked', StudentID: s.ID });
  env.g.dailyDigest();
  assert.equal(env.mails.length, 1);
  const body = env.mails[0].body;
  assert.match(body, /Yesterday: 8 lessons/);
  assert.match(body, /07:00 {2}Swift {2}Jay Mehta/);
  assert.match(body, /Learner licence runs out soon/);
  assert.match(body, /Fees to collect\n {2}Jay Mehta {2}₹5,000/);
});

test('weekly report and checkSetup run', () => {
  const env = ready({ now: '2026-10-19T03:00:00Z' });
  env.g.weeklyReport();
  assert.equal(env.mails.length, 1);
  assert.match(env.mails[0].body, /Week of 2026-10-12/);
  const issues = env.g.checkSetup();
  assert.ok(issues.some(x => /installTriggers/.test(x)));
});

test('upgradeShortPins replaces 4-digit PINs only', () => {
  const env = ready();
  env.ss.getSheetByName('Staff').rows[1][1] = '1234';
  env.g.upgradeShortPins();
  const pins = env.tab('Staff').map(r => String(r.PIN));
  assert.match(pins[0], /^\d{6}$/);
  assert.equal(pins[1], OFFICE);
});

test('health check reports the version', () => {
  const env = load();
  const r = JSON.parse(env.g.doGet({ parameter: {} }).text);
  assert.equal(r.version, env.g.VERSION);
});
