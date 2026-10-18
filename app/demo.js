/* Soni Motor app: made-up data for ?demo, using the same reducer as the Sheet copy. */
/* ================= demo backend (only when not running inside Google) ================= */
const Mock = (() => {
  if (IS_LIVE) return null;
  const td = istToday(), d = n => addDays(td, -n), rid = p => p + Math.random().toString(36).slice(2, 7).toUpperCase();
  const db = {
    today: td,
    version: '1.3.0',
    settings: { SchoolName: 'Soni Motor Training School', SchoolPhone: '1000000001', ReviewLink: 'https://g.page/r/CWKtBfMYEdoAEBM/review', QuizLink: 'https://vnsr.github.io/soni-motor/quiz/',
      ReviewMsgGU: 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલમાં ડ્રાઇવિંગ શીખવા બદલ આભાર! તમારો અનુભવ ગૂગલ પર બે લીટીમાં લખશો તો બીજા લોકોને સ્કૂલ પસંદ કરવામાં મદદ થશે: {link}',
      ReviewMsgEN: 'Hello {name}, thank you for learning to drive with Soni Motor Training School! If you write two lines about your experience on Google, it helps others choose a school: {link}',
      FollowMsgGU: 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલ તરફથી. ડ્રાઇવિંગ શીખવા વિશે પૂછપરછ કરવા બદલ આભાર. તમે ક્યારથી શરૂ કરવા માંગો છો?',
      FollowMsgEN: 'Hello {name}, this is Soni Motor Training School. Thank you for your enquiry about driving lessons. When would you like to start?',
      QuizMsgGU: 'નમસ્તે {name}, લર્નિંગ લાઇસન્સની પરીક્ષાની મફત પ્રેક્ટિસ અહીં કરો (ગુજરાતી અને અંગ્રેજીમાં): {quiz}',
      QuizMsgEN: 'Hello {name}, here is a free practice test for the learner licence exam (Gujarati and English): {quiz}' },
    packages: [
      { PackageID: 'P1', Car: 'Maruti Swift', Transmission: 'Manual', Lessons: 15, MinutesPerLesson: 30, PriceINR: 5000 },
      { PackageID: 'P2', Car: 'Hyundai i20', Transmission: 'Manual', Lessons: 15, MinutesPerLesson: 30, PriceINR: 5500 },
      { PackageID: 'P3', Car: 'Maruti Baleno', Transmission: 'Automatic', Lessons: 12, MinutesPerLesson: 30, PriceINR: 6000 }
    ],
    staff: ['Trainer', 'Office'], students: [], enquiries: [], lessons: [], payments: [], skills: [], bookings: [], requests: []
  };
  const S = [
    ['Riya Patel', '1000000002', 'P1', 34, 15, 5000, 'Completed', '', 'Google'],
    ['Harsh Shah', '1000000003', 'P2', 28, 15, 3000, 'Completed', d(2), 'Referral'],
    ['Meera Desai', '1000000004', 'P3', 20, 12, 3000, 'Active', '', 'Walk-in'],
    ['Kunal Joshi', '1000000005', 'P1', 16, 9, 5000, 'Active', '', 'WhatsApp'],
    ['Nisha Parmar', '1000000006', 'P1', 9, 5, 2000, 'Active', '', 'Google'],
    ['Aarav Trivedi', '1000000007', 'P2', 6, 3, 5500, 'Active', '', 'Referral'],
    ['Pooja Rana', '1000000008', 'P3', 3, 1, 2000, 'Active', '', 'Phone'],
    ['Jay Mehta', '1000000009', 'P1', 18, 15, 3500, 'Active', '', 'Walk-in']
  ];
  S.forEach(([name, ph, pk, ago, nL, paid, status, rev, src], i) => {
    const id = 'S' + (i + 1), p = db.packages.find(x => x.PackageID === pk);
    const done = status === 'Completed' ? d(Math.max(1, ago - 26)) : '';
    db.students.push({ ID: id, JoinDate: d(ago), Name: name, Phone: ph, PackageID: pk, Price: p.PriceINR, Instructor: 'Trainer', Licence: status === 'Completed' ? 'Permanent' : 'Learner', Status: status, CompletedDate: done, ReviewAsked: rev, ReviewDone: '', Notes: '' });
    for (let k = 1; k <= nL; k++) { const dd = d(Math.max(0, ago - Math.round(k * (ago - (status === 'Completed' ? ago - 26 : 0)) / (nL + 0.5)))); db.lessons.push({ ID: rid('L'), Date: k === nL && (i === 3 || i === 2) ? td : dd, StudentID: id, LessonNo: k, Instructor: 'Trainer', LoggedBy: k % 3 ? 'Trainer' : 'Office', Timestamp: new Date(Date.now() - (nL - k) * 1e5).toISOString() }); }
    db.payments.push({ ID: rid('P'), Date: d(ago), StudentID: id, AmountINR: Math.min(paid, 3000), Mode: i % 2 ? 'UPI' : 'Cash', LoggedBy: 'Office' });
    if (paid > 3000) db.payments.push({ ID: rid('P'), Date: d(Math.max(0, ago - 10)), StudentID: id, AmountINR: paid - 3000, Mode: 'UPI', LoggedBy: 'Office' });
    db.enquiries.push({ ID: 'E' + i, Date: d(ago + 2), Name: name, Phone: ph, Source: src, CarInterest: p.Car, Note: '', Status: 'Joined', FollowUp: '' });
    const list = SKILLS.filter(k => !(k === 'clutch' && p.Transmission === 'Automatic'));
    const nSk = status === 'Completed' ? list.length : Math.floor(list.length * nL / p.Lessons * 0.85);
    list.slice(0, nSk).forEach(k => db.skills.push({ StudentID: id, Skill: k, Date: d(Math.max(0, ago - 5)), LoggedBy: 'Trainer' }));
  });
  [['Dev Chauhan', '1000000010', 'Google', 1, 'New', d(0), 'Maruti Swift'], ['Krupa Vyas', '1000000011', 'Walk-in', 3, 'Follow-up', d(1), 'Maruti Baleno'],
   ['Rohan Bhatt', '1000000012', 'Phone', 0, 'New', addDays(td, 1), ''], ['Sneha Solanki', '1000000013', 'Referral', 12, 'Lost', '', 'Hyundai i20'],
   ['Amit Rathod', '1000000014', 'WhatsApp', 6, 'Follow-up', addDays(td, 2), 'Maruti Swift'], ['Tanvi Pandya', '1000000015', 'Google', 20, 'Lost', '', '']]
    .forEach(([n, p, s, ago, stt, fu, car], i) => db.enquiries.push({ ID: 'EQ' + i, Date: d(ago), Name: n, Phone: p, Source: s, CarInterest: car, Note: '', Status: stt, FollowUp: fu }));
  db.enquiries.push({ ID: 'EQ9', Date: d(0), Name: 'Nidhi Parekh', Phone: '1000000016', Source: 'Practice', CarInterest: 'Automatic', Note: 'Evening / સાંજે · LL applied / LL માટે અરજી કરી · Referred by Riya Patel', Status: 'New', FollowUp: d(0), LoggedBy: 'Practice app form', LL: 'applied', ReferredBy: 'S1' });
  db.enquiries.push({ ID: 'EQ10', Date: d(9), Name: 'Raj Soni', Phone: '1000000017', Source: 'Practice', CarInterest: 'Manual', Note: 'Referred by Riya Patel', Status: 'Joined', FollowUp: '', LL: 'have', ReferredBy: 'S1' });
  /* licence journey and a slot request from a student's page */
  Object.assign(db.students[2], { LLDate: d(40), TestDate: addDays(td, 3), Docs: 'id,address,photos,ll' });
  Object.assign(db.students[3], { LLDate: d(160), Docs: 'id,photos' });
  Object.assign(db.students[4], { LLDate: d(12), Docs: 'id' });
  Object.assign(db.students[0], { LLDate: d(80), TestDate: d(30), TestResult: 'Pass', Docs: 'id,address,age,photos,ll', Token: 'demo0000riya0000patel000000000aa' });
  db.requests.push({ ID: 'R1', Date: addDays(td, 1), StudentID: 'S5', Want: 'evening', Note: '', Status: 'Open' });
  /* demo timetable: a few bookings and a lunch block today and tomorrow */
  [[0, 'Maruti Swift', '07:00', 'S4'], [0, 'Maruti Swift', '07:30', 'S5'], [0, 'Maruti Swift', '17:00', 'S8'], [0, 'Maruti Baleno', '08:00', 'S3'], [0, 'Maruti Baleno', '18:30', 'S7'],
   [1, 'Maruti Swift', '06:30', 'S6'], [1, 'Hyundai i20', '09:00', 'S6']]
    .forEach(([dd, car, sl, sid]) => db.bookings.push({ ID: rid('B'), Date: addDays(td, dd), Car: car, Slot: sl, Type: 'Booked', StudentID: sid, Note: '', LoggedBy: 'Office' }));
  [0, 1].forEach(dd => ['13:00', '13:30'].forEach(sl => db.bookings.push({ ID: rid('B'), Date: addDays(td, dd), Car: 'Maruti Swift', Slot: sl, Type: 'Blocked', StudentID: '', Note: 'Lunch', LoggedBy: 'Trainer' })));
  db.quiz = { weeks: Array.from({ length: 8 }, (_, i) => ({ week: addDays(weekStart(td), -7 * (7 - i)), people: [3, 5, 4, 9, 12, 15, 21, 18][i], tests: [4, 7, 6, 14, 19, 25, 33, 27][i], ready: [0, 1, 1, 2, 3, 4, 6, 5][i], book: [0, 0, 1, 1, 2, 2, 4, 3][i], form: [0, 0, 1, 0, 1, 2, 3, 2][i], share: [0, 1, 0, 2, 3, 3, 5, 4][i] })),
    sources: { share: 21, flyer: 14, gbp: 6, direct: 9, app: 4 } };
  const PINS = { '1993': 'Trainer', '2024': 'Office' };
  const copy = () => JSON.parse(JSON.stringify(db));
  function api(pin, action, p) {
    const me = PINS[String(pin)]; if (!me) throw new Error('PIN');
    p.LoggedBy = me;
    const result = reduce(db, action, p, me);
    const out = copy(); out.me = me;
    return { db: out, result: result && JSON.parse(JSON.stringify(result)) };
  }
  /* ?demo&offline pretends there is no signal, to try saving on the phone */
  return { api, offline: /[?&]offline\b/.test(location.search) };
})();
