/* Soni Motor app: the screens (Today, Students, Timetable, Enquiries, Report) and their sheets. */
/* ================= shell ================= */
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  students: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.1 4.6 1.8 5.4 4.9"/>',
  enquiries: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  report: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  timetable: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'
};
const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;

function render() {
  document.documentElement.lang = st.lang === 'gu' ? 'gu' : 'en';
  const app = $('#app');
  app.classList.remove('shell');
  if (!st.pin) return renderPin(app);
  if (!st.db) { app.innerHTML = '<div class="gate"><div class="lplate">L</div></div>'; load(); return; }
  if (!st.me) return renderWho(app);
  const t = T();
  const keepY = st.keepScroll && $('#scroller') ? $('#scroller').scrollTop : 0;
  app.classList.add('shell');
  app.innerHTML = `
    <header class="hdr">
      <div class="lplate" aria-hidden="true">L</div>
      <div class="nm">${t.school}<span>${t.schoolSub}</span></div>
      <div class="sp"></div>
      <div class="lang" role="group" aria-label="Language"><button type="button" data-lang="gu" aria-pressed="${st.lang === 'gu'}">ગુ</button><button type="button" data-lang="en" aria-pressed="${st.lang === 'en'}">EN</button></div>
      <button type="button" class="iconbtn" id="gear" aria-label="${t.settings}">${ico('gear')}</button>
    </header>
    ${IS_LIVE ? (st.offline ? `<div class="demo">${t.offlineBanner}</div>` : '') : `<div class="demo">${t.demo}</div>`}
    ${queue().length ? `<div class="demo queued" role="status">${t.queued(queue().length)}</div>` : ''}
    <div class="scroller" id="scroller"><main id="main"></main></div>
    <nav class="tabs">${['home', 'students', 'timetable', 'enquiries', 'report'].map(k => `<button type="button" data-tab="${k}" ${st.tab === k ? 'aria-current="page"' : ''}>${ico(k)}${t[k]}</button>`).join('')}</nav>`;
  app.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { st.lang = b.dataset.lang; ls.set('lang', st.lang); render(); });
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; st.q = ''; st.keepScroll = false; render(); });
  $('#gear').onclick = openSettings;
  ({ home: renderHome, students: renderStudents, timetable: renderTimetable, enquiries: renderEnquiries, report: renderReport })[st.tab]($('#main'));
  $('#scroller').scrollTop = keepY;
  st.keepScroll = true;
}

async function load() {
  try { const r = await call('load'); adopt(r.db); render(); }
  catch (e) {
    const m = String(e && e.message || e), cached = ls.get('db', null);
    if (m === 'PIN') { ls.del('pin'); st.pin = ''; st.pinBad = true; render(); return; }
    if (m === 'LOCKED') { st.pin = ''; st.locked = true; render(); return; }
    if (e.net && cached) { adopt(cached); st.offline = true; render(); return; }
    $('#app').innerHTML = `<div class="gate"><div class="lplate">L</div><p class="err">${T().offline}</p><button class="btn primary big" onclick="load()">↻</button></div>`;
  }
}

function renderPin(app) {
  const t = T();
  app.innerHTML = `<form class="gate" id="pinf"><div class="lplate">L</div><h1>${t.pinTitle}</h1><p class="sub">${t.pinHint}</p>
    <div class="f"><input id="pin" aria-label="PIN" class="pin" inputmode="numeric" autocomplete="off" maxlength="8" required></div>
    ${st.pinBad ? `<p class="err">${t.pinBad}</p>` : ''}${st.locked ? `<p class="err">${t.locked}</p>` : ''}
    <button class="btn primary big" type="submit">${t.pinGo}</button>
    <div class="lang" style="align-self:center"><button type="button" data-lang="gu" aria-pressed="${st.lang === 'gu'}">ગુજરાતી</button><button type="button" data-lang="en" aria-pressed="${st.lang === 'en'}">English</button></div></form>`;
  app.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { st.lang = b.dataset.lang; ls.set('lang', st.lang); render(); });
  $('#pinf').onsubmit = e => { e.preventDefault(); st.pin = $('#pin').value.trim(); st.pinBad = false; st.locked = false; ls.set('pin', st.pin); ls.del('me'); st.me = ''; st.db = null; render(); };
  setTimeout(() => $('#pin') && $('#pin').focus(), 50);
}
function renderWho(app) {
  const t = T();
  app.innerHTML = `<div class="gate"><div class="lplate">L</div><h1>${t.whoTitle}</h1><p class="sub">${t.whoHint}</p>
    <div class="names">${st.db.staff.map(n => `<button type="button" class="btn big" data-me="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <form id="whof" class="f"><label for="whoIn">${t.other}</label><div class="sw"><input id="whoIn" maxlength="30"><button class="btn primary">${t.save}</button></div></form></div>`;
  const setMe = n => { if (!n) return; st.me = n; ls.set('me', n); if (!st.trainer) { st.trainer = st.db.staff[0] || n; ls.set('trainer', st.trainer); } render(); };
  app.querySelectorAll('[data-me]').forEach(b => b.onclick = () => setMe(b.dataset.me));
  $('#whof').onsubmit = e => { e.preventDefault(); setMe($('#whoIn').value.trim()); };
}

/* ================= home ================= */
function renderHome(m) {
  const t = T(), S = studentsX(), td = today();
  const todays = st.db.lessons.filter(l => l.Date === td).sort((a, b) => String(b.Timestamp).localeCompare(String(a.Timestamp)));
  const byId = Object.fromEntries(S.map(s => [s.ID, s]));
  const follow = st.db.enquiries.filter(e => (e.Status === 'New' || e.Status === 'Follow-up') && (!e.FollowUp || e.FollowUp <= td));
  const finished = S.filter(s => s.Status === 'Active' && s.tot && s.done >= s.tot);
  const review = S.filter(s => s.Status === 'Completed' && !s.ReviewAsked);
  const pay = S.filter(s => s.Status !== 'Dropped' && s.bal > 0 && s.tot && s.done >= Math.ceil(s.tot / 2));
  const llSoon = S.filter(s => s.Status === 'Active' && s.TestResult !== 'Pass' && llInfo(s) && llInfo(s).until <= addDays(td, 30));
  const tests = S.filter(s => s.TestDate && !s.TestResult && s.TestDate >= td && s.TestDate <= addDays(td, 7));
  const reqs = (st.db.requests || []).map(r => Object.assign({ s: byId[r.StudentID] }, r)).filter(r => r.s);
  const todo = [
    ...reqs.map(r => `<div class="row"><div class="main"><div class="t">${esc(r.s.Name)}</div><div class="m">${t.reqT} · ${fd(r.Date, true)} · ${esc(t.want[r.Want] || r.Want)}${r.Note ? ' · ' + esc(r.Note) : ''}</div></div>
      <div class="btns"><button class="btn primary" data-reqbook="${r.ID}">${t.bookIt}</button><button class="btn ghost" data-reqno="${r.ID}" aria-label="${t.decline}">✕</button></div></div>`),
    ...tests.map(s => `<div class="row tap" data-stu="${s.ID}"><div class="main"><div class="t">${esc(s.Name)}</div><div class="m">${t.testSoon(fd(s.TestDate, true))}</div></div><span class="badge ok">RTO</span></div>`),
    ...llSoon.map(s => `<div class="row tap" data-stu="${s.ID}"><div class="main"><div class="t">${esc(s.Name)}</div><div class="m">${llInfo(s).until < td ? t.llExpired : t.llSoon(fd(llInfo(s).until))}</div></div><span class="badge red">LL</span></div>`),
    ...follow.map(e => `<div class="row"><div class="main"><div class="t">${esc(e.Name)}</div><div class="m">${t.followDue} · ${esc(t.src[e.Source] || e.Source)}${e.LL ? ' · ' + esc(t.llS[e.LL] || e.LL) : ''} · ${rel(e.Date)}</div></div>
      <div class="btns"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(e.Phone, msg('Follow', e.Name))}">${t.whatsapp}</a><button class="btn ghost" data-enq="${e.ID}">›</button></div></div>`),
    ...finished.map(s => `<div class="row"><div class="main"><div class="t">${esc(s.Name)}</div><div class="m">${t.finished}</div></div><button class="btn" data-complete="${s.ID}">${t.markDone}</button></div>`),
    ...review.map(s => `<div class="row"><div class="main"><div class="t">${esc(s.Name)}</div><div class="m">${t.askReview}</div></div><a class="btn wa" target="_blank" rel="noopener" data-review="${s.ID}" href="${waLink(s.Phone, msg('Review', s.Name))}">${t.whatsapp}</a></div>`),
    ...pay.map(s => `<div class="row tap" data-stu="${s.ID}"><div class="main"><div class="t">${esc(s.Name)}</div><div class="m">${t.payDue} · ${n2(s.done)}/${n2(s.tot)} ${t.lessons}</div></div><span class="badge due">${inr(s.bal)}</span>
      <a class="btn wa" target="_blank" rel="noopener" href="${waLink(s.Phone, msg('Due', s.Name, { amount: s.bal }))}">${t.dueRemind}</a></div>`)
  ];
  const tmr = (st.db.bookings || []).filter(b => b.Date === addDays(td, 1) && b.Type === 'Booked').sort((a, b) => a.Slot.localeCompare(b.Slot));
  const issues = setupIssues();
  m.innerHTML = `
    <div><h1>${fd(td, true)}</h1><p class="sub">${t.you}: ${esc(st.me)}</p></div>
    ${issues.length ? `<div class="warn" role="status"><b>${t.setupTitle}</b>${t.setupHint}<ul>${issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="actions">
      <button class="act primary" id="aLesson"><span class="plus">+</span><span><b>${t.logLesson}</b><br><small>${t.logLessonSub}</small></span></button>
      <button class="act" id="aEnq"><b>${t.newEnquiry}</b><small>${t.newEnquirySub}</small></button>
      <button class="act" id="aStu"><b>${t.newStudent}</b><small>${t.newStudentSub}</small></button>
      <button class="act" id="aPay" style="grid-column:1/-1"><b>${t.payment}</b><small>${t.paymentSub}</small></button>
    </div>
    ${(() => { const tb = (st.db.bookings || []).filter(b => b.Date === td && b.Type === 'Booked').sort((a, b) => a.Slot.localeCompare(b.Slot));
      return tb.length ? `<section><h2>${t.todayBookings} <span class="count">${n2(tb.length)}</span></h2><div class="card">${tb.map(b => { const s = stuById(b.StudentID); return `<div class="row tap" data-tt="${esc(b.Car)}"><span class="tm" style="font-weight:700;font-variant-numeric:tabular-nums;width:50px">${b.Slot}</span><div class="main"><div class="t">${esc(s ? s.Name : b.StudentID)}</div><div class="m">${esc(b.Car)}${b.Note ? ' · ' + esc(b.Note) : ''}</div></div></div>`; }).join('')}</div></section>` : ''; })()}
    <section><h2>${t.lessonsToday} <span class="count">${n2(todays.length)}</span></h2>
      <div class="card">${todays.length ? todays.map(l => { const s = byId[l.StudentID] || {}; return `<div class="row tap" data-stu="${l.StudentID}"><div class="main"><div class="t">${esc(s.Name || l.StudentID)}</div><div class="m">${t.lesson} ${n2(l.LessonNo)}${s.tot ? '/' + n2(s.tot) : ''} · ${esc(l.Instructor || '')}${l.LoggedBy && l.LoggedBy !== l.Instructor ? ' · ' + esc(l.LoggedBy) : ''}</div></div></div>`; }).join('') : `<div class="empty">${t.none}</div>`}</div></section>
    <section><h2>${t.todo} <span class="count">${n2(todo.length)}</span></h2><div class="card">${todo.join('') || `<div class="empty">${t.none}</div>`}</div></section>
    ${tmr.length ? `<section><h2>${t.tomorrowT} <span class="count">${n2(tmr.length)}</span></h2><div class="card">${tmr.map(b => { const s = stuById(b.StudentID); return `<div class="row"><span class="tm" style="font-weight:700;font-variant-numeric:tabular-nums;width:50px">${b.Slot}</span><div class="main"><div class="t">${esc(s ? s.Name : b.StudentID)}</div><div class="m">${esc(b.Car)}</div></div>
      ${s && s.Phone ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(s.Phone, t.remindMsg(firstName(s.Name), fd(b.Date, true), b.Slot, b.Car))}">${t.remind}</a>` : ''}</div>`; }).join('')}</div></section>` : ''}`;
  m.querySelectorAll('[data-tt]').forEach(r => r.onclick = () => { st.tab = 'timetable'; st.ttCar = r.dataset.tt; st.ttDate = td; st.keepScroll = false; render(); });
  $('#aLesson').onclick = openLessonPicker; $('#aEnq').onclick = () => openEnquiryForm(); $('#aStu').onclick = () => openStudentForm(); $('#aPay').onclick = () => openPaymentForm();
  wireCommon(m);
}
function setupIssues() {
  const t = T(), out = [];
  (st.db.packages || []).forEach(p => {
    if (!p.Car || /EDIT/i.test(p.Car)) out.push(t.setupCar(p.PackageID));
    else if (!(Number(p.PriceINR) > 0)) out.push(t.setupPrice(p.Car));
  });
  if (!(st.db.settings || {}).ReviewLink) out.push(t.setupReview);
  return out;
}
function wireCommon(m) {
  m.querySelectorAll('[data-stu]').forEach(r => r.onclick = e => { if (e.target.closest('button,a')) return; openStudent(r.dataset.stu); });
  m.querySelectorAll('[data-enq]').forEach(b => b.onclick = () => openEnquiry(b.dataset.enq));
  m.querySelectorAll('[data-complete]').forEach(b => b.onclick = () => act('updateStudent', { ID: b.dataset.complete, Status: 'Completed', CompletedDate: today() }, T().saved));
  m.querySelectorAll('[data-review]').forEach(a => a.addEventListener('click', () => setTimeout(() => act('updateStudent', { ID: a.dataset.review, ReviewAsked: today() }), 300)));
  m.querySelectorAll('[data-plus]').forEach(b => b.onclick = e => { e.stopPropagation(); logLesson(b.dataset.plus); });
  m.querySelectorAll('[data-reqbook]').forEach(b => b.onclick = () => { const r = (st.db.requests || []).find(x => x.ID === b.dataset.reqbook); if (!r) return; closeSheet(); st.ttReq = r; st.ttDate = r.Date; st.ttSel = null; st.tab = 'timetable'; st.keepScroll = false; render(); });
  m.querySelectorAll('[data-reqno]').forEach(b => b.onclick = () => act('closeRequest', { ID: b.dataset.reqno }, T().saved).catch(() => { }));
}

/* ================= lessons ================= */
async function logLesson(id, date, trainer) {
  const s = studentsX().find(x => x.ID === id); if (!s) return;
  const r = await act('logLesson', { StudentID: id, Date: date || today(), Instructor: trainer || st.trainer || st.me });
  if (r) toast(T().lessonSaved(s.Name, n2(r.LessonNo), s.tot ? n2(s.tot) : ''), () => act('undoLesson', { ID: r.ID }, T().saved));
}
function openLessonPicker() {
  const t = T();
  sheet(t.logLesson, `
    <div class="two"><div class="f"><label for="lDate">${t.lessonOn}</label><input type="date" id="lDate" value="${today()}" max="${today()}"></div>
    <div class="f"><label for="lTr">${t.instructor}</label><select id="lTr">${trainerOpts(st.trainer)}</select></div></div>
    <input class="search" id="lQ" placeholder="${t.search}" autocomplete="off">
    <div class="card" id="lList"></div>`, b => {
    const draw = () => {
      const q = $('#lQ').value.trim().toLowerCase();
      const L = studentsX().filter(s => s.Status === 'Active' && (!q || s.Name.toLowerCase().includes(q) || s.Phone.includes(q))).sort((a, c) => (c.last || c.JoinDate).localeCompare(a.last || a.JoinDate));
      $('#lList').innerHTML = L.map(s => stuRow(s, true)).join('') || `<div class="empty">${t.none}</div>`;
      wireCommon($('#lList'));
      $('#lList').querySelectorAll('[data-plus]').forEach(x => x.onclick = async () => { const tr = $('#lTr').value, dt = $('#lDate').value || today(); st.trainer = tr; ls.set('trainer', tr); closeSheet(); await logLesson(x.dataset.plus, dt, tr); });
    };
    $('#lQ').oninput = draw; draw();
  });
}
function trainerOpts(sel) { const L = [...new Set([...(st.db.staff || []), st.me].filter(Boolean))]; return L.map(n => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join(''); }
function stuRow(s, plus) {
  const t = T(), pct = s.tot ? Math.min(100, s.done / s.tot * 100) : 0;
  return `<div class="row tap" data-stu="${s.ID}"><div class="main"><div class="t">${esc(s.Name)}</div>
    <div class="m">${s.pk ? esc(pkgLabel(s.pk)) + ' · ' : ''}${n2(s.done)}/${n2(s.tot || '–')} ${t.lessons}${s.last ? ' · ' + rel(s.last) : ''}</div>
    ${s.tot ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}</div>
    ${s.bal > 0 ? `<span class="badge due">${inr(s.bal)}</span>` : ''}
    ${plus && s.Status === 'Active' ? `<button class="btn plus1" data-plus="${s.ID}" aria-label="${t.addLesson} ${esc(s.Name)}">${t.plus1}</button>` : ''}</div>`;
}

/* ================= students ================= */
function renderStudents(m) {
  const t = T();
  m.innerHTML = `<div class="sw"><input class="search" id="sQ" placeholder="${t.search}" value="${esc(st.q)}" autocomplete="off"><button class="btn primary" id="sNew" aria-label="${t.newStudent}">+</button></div>
    <div class="chips">${[['Active', t.active], ['Completed', t.completed], ['All', t.all]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${st.sFilter === k}">${l}</button>`).join('')}</div>
    <div class="card" id="sList"></div>`;
  const draw = () => {
    const q = st.q.toLowerCase();
    const L = studentsX().filter(s => (st.sFilter === 'All' || s.Status === st.sFilter) && (!q || s.Name.toLowerCase().includes(q) || s.Phone.includes(q)))
      .sort((a, b) => (b.last || b.JoinDate).localeCompare(a.last || a.JoinDate));
    $('#sList').innerHTML = L.map(s => stuRow(s, true)).join('') || `<div class="empty">${t.none}</div>`;
    wireCommon($('#sList'));
  };
  $('#sQ').oninput = e => { st.q = e.target.value; draw(); };
  $('#sNew').onclick = () => openStudentForm();
  m.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.sFilter = b.dataset.f; renderStudents(m); });
  draw();
}
function openStudent(id) {
  const t = T(), s = studentsX().find(x => x.ID === id); if (!s) return;
  const L = st.db.lessons.filter(l => l.StudentID === id).sort((a, b) => b.LessonNo - a.LessonNo);
  const P = st.db.payments.filter(p => p.StudentID === id).sort((a, b) => b.Date.localeCompare(a.Date));
  sheet(s.Name, `
    <div class="btns"><a class="btn" href="tel:+91${esc(s.Phone)}">${t.call} ${esc(s.Phone)}</a><a class="btn wa" target="_blank" rel="noopener" href="${waLink(s.Phone, '')}">${t.whatsapp}</a></div>
    <dl class="kv">
      <dt>${t.pkg}</dt><dd>${esc(pkgLabel(s.pk) || '–')}</dd>
      <dt>${t.lessons}</dt><dd>${n2(s.done)} / ${n2(s.tot || '–')}</dd>
      <dt>${t.paid}</dt><dd>${inr(s.paid)} / ${inr(s.Price || 0)}</dd>
      <dt>${t.balance}</dt><dd>${s.bal > 0 ? `<span class="badge due">${inr(s.bal)}</span>` : `<span class="badge ok">${t.clear}</span>`}</dd>
      <dt>${t.instructor}</dt><dd>${esc(s.Instructor || '–')}</dd>
      ${(() => { const nb = (st.db.bookings || []).filter(b => b.StudentID === s.ID && b.Type === 'Booked' && b.Date >= today()).sort((a, b) => (a.Date + a.Slot).localeCompare(b.Date + b.Slot))[0]; return nb ? `<dt>${t.nextBooking}</dt><dd>${fd(nb.Date, true)} · ${nb.Slot} · ${esc(nb.Car)}</dd>` : ''; })()}
      <dt>${t.joinedOn}</dt><dd>${fd(s.JoinDate)}</dd>
      <dt>${t.status}</dt><dd>${esc(t.sst[s.Status] || s.Status)}</dd>
    </dl>
    <div class="two">
      ${s.Status === 'Active' ? `<button class="btn primary big" id="dPlus">${t.addLesson}</button>` : ''}
      <button class="btn big" id="dPay">${t.addPay}</button>
    </div>
    <div class="btns">
      ${s.Status === 'Active' ? `<button class="btn" id="dDone">${t.markDone}</button>` : ''}
      ${s.Status === 'Completed' ? `<a class="btn wa" id="dRev" target="_blank" rel="noopener" href="${waLink(s.Phone, msg('Review', s.Name))}">${s.ReviewAsked ? t.reviewAsked + ' ' + fd(s.ReviewAsked) : t.reviewAsk}</a>` : ''}
      ${s.Status === 'Completed' && !s.ReviewDone ? `<button class="btn" id="dGot">${t.reviewGot}</button>` : ''}
      ${s.Status === 'Completed' && !s.ReviewDone ? `<button class="btn" id="dQR">${t.showQR}</button>` : ''}
      ${s.ReviewDone ? `<span class="badge ok">${t.reviewGot}</span>` : ''}
      ${quizOn() && s.Licence !== 'Permanent' ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(s.Phone, msg('Quiz', s.Name))}">${t.sendQuiz}</a>` : ''}
    </div>
    ${licSection(s)}
    <section><div class="skhead"><h2>${t.progress}</h2><span class="badge mute" id="skCount"></span></div>
      <p class="sub" style="margin:-4px 0 8px">${t.tapToTick}</p>
      <div class="card" id="skList" role="group" aria-label="${t.progress}"></div>
      <a class="btn wa big" id="skSend" target="_blank" rel="noopener" style="margin-top:10px">${t.sendCard}</a></section>
    <section><h2>${t.history} <span class="count">${n2(L.length)}</span></h2><div class="card">${L.map(l => `<div class="row"><div class="main"><div class="t">${t.lesson} ${n2(l.LessonNo)}</div><div class="m">${fd(l.Date, true)} · ${esc(l.Instructor || '')}</div></div></div>`).join('') || `<div class="empty">${t.none}</div>`}</div></section>
    <section><h2>${t.payments} <span class="count">${n2(P.length)}</span></h2><div class="card">${P.map(p => `<div class="row"><div class="main"><div class="t">${inr(p.AmountINR)}</div><div class="m">${fd(p.Date)} · ${esc(t.mode[p.Mode] || p.Mode)}</div></div></div>`).join('') || `<div class="empty">${t.none}</div>`}</div></section>
    <section><h2>${t.studentPage}</h2><p class="sub" style="margin:-4px 0 8px">${t.linkHint}</p>
      ${s.Token ? `<div class="btns"><a class="btn wa big" style="flex:1" target="_blank" rel="noopener" href="${waLink(s.Phone, msg('Student', s.Name, { link: studentUrl(s) }))}">${t.sendLink}</a></div>
        <button class="btn ghost" id="dRenew" style="margin-top:8px">${t.newLink}</button>` : `<button class="btn big" id="dLink">${t.makeLink}</button>`}</section>`, () => {
    const pl = $('#dPlus'); if (pl) pl.onclick = async () => { closeSheet(); await logLesson(id); };
    $('#dPay').onclick = () => { closeSheet(); openPaymentForm(id); };
    const dn = $('#dDone'); if (dn) dn.onclick = async () => { await act('updateStudent', { ID: id, Status: 'Completed', CompletedDate: today() }, t.saved); openStudent(id); };
    const rv = $('#dRev'); if (rv) rv.addEventListener('click', () => { if (!s.ReviewAsked) setTimeout(() => act('updateStudent', { ID: id, ReviewAsked: today() }), 300); });
    const gt = $('#dGot'); if (gt) gt.onclick = async () => { await act('updateStudent', { ID: id, ReviewDone: 'Yes', ReviewAsked: s.ReviewAsked || today() }, t.saved); openStudent(id); };
    wireLic(s);
    const mk = $('#dLink') || $('#dRenew'); if (mk) mk.onclick = async () => { try { await act('studentLink', { ID: id, Renew: mk.id === 'dRenew' }); openStudent(id); } catch (e) { } };
    const qr = $('#dQR'); if (qr) qr.onclick = () => openReviewQR(id);
    drawSkills(id);
  });
}

/* ================= licence journey: LL date → wait 30 days → driving test, before the LL runs out ================= */
function licSection(s) {
  const t = T(), L = llInfo(s), td = today(), docs = new Set(String(s.Docs || '').split(',').filter(Boolean));
  const hints = L ? [L.until < td && s.TestResult !== 'Pass' ? `<p class="warn">${t.llExpired}</p>` : '',
    s.TestResult !== 'Pass' ? `<p class="sub">${t.testFrom(fd(L.from, true))} · ${t.llUntil(fd(L.until))}</p>` : ''].join('') : '';
  return `<section><h2>${t.licJourney}</h2><div class="card" style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="f"><label for="sLic">${t.licence}</label><select id="sLic">${LICS.map(k => `<option value="${k}" ${s.Licence === k ? 'selected' : ''}>${t.lic[k]}</option>`).join('')}</select></div>
    <div class="two"><div class="f"><label for="sLL">${t.llDate}</label><input type="date" id="sLL" value="${esc(s.LLDate || '')}" max="${td}"></div>
      <div class="f"><label for="sTD">${t.testDate}</label><input type="date" id="sTD" value="${esc(s.TestDate || '')}" ${L ? `min="${L.from}"` : ''}></div></div>
    ${hints}
    <div class="f"><span class="lbl">${t.testResult}</span><div class="chips" id="sTR">${['', 'Pass', 'Fail'].map(k => `<button type="button" class="chip" data-tr="${k}" aria-pressed="${(s.TestResult || '') === k}">${t.res[k]}</button>`).join('')}</div></div>
    <div class="f"><span class="lbl">${t.docsT} <span class="count">${n2(docs.size)}/${n2(DOCS.length)}</span></span><div class="chips" id="sDocs">${DOCS.map(k => `<button type="button" class="chip" data-doc="${k}" aria-pressed="${docs.has(k)}">${docs.has(k) ? '✓ ' : ''}${t.doc[k]}</button>`).join('')}</div></div>
  </div></section>`;
}
function wireLic(s) {
  const id = s.ID, t = T(), save = async f => { try { await act('updateStudent', Object.assign({ ID: id }, f), t.saved); openStudent(id); } catch (e) { } };
  $('#sLic').onchange = e => save({ Licence: e.target.value });
  $('#sLL').onchange = e => save(Object.assign({ LLDate: e.target.value }, e.target.value && s.Licence === 'None' ? { Licence: 'Learner' } : {}));
  $('#sTD').onchange = e => save({ TestDate: e.target.value });
  $('#sTR').querySelectorAll('[data-tr]').forEach(b => b.onclick = () => save(Object.assign({ TestResult: b.dataset.tr }, b.dataset.tr === 'Pass' ? { Licence: 'Permanent' } : {})));
  $('#sDocs').querySelectorAll('[data-doc]').forEach(b => b.onclick = () => {
    const d = new Set(String(s.Docs || '').split(',').filter(Boolean)); d.has(b.dataset.doc) ? d.delete(b.dataset.doc) : d.add(b.dataset.doc);
    save({ Docs: DOCS.filter(k => d.has(k)).join(',') });
  });
}

/* ================= progress card ================= */
function skillsFor(s) { return SKILLS.filter(k => !(k === 'clutch' && s.pk && s.pk.Transmission === 'Automatic')); }
function skillsDone(id) { return new Set((st.db.skills || []).filter(x => x.StudentID === id).map(x => x.Skill)); }
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function drawSkills(id) {
  const box = $('#skList'); if (!box) return;
  const t = T(), s = studentsX().find(x => x.ID === id), list = skillsFor(s), have = skillsDone(id);
  const n = list.filter(k => have.has(k)).length;
  $('#skCount').textContent = t.skillsOf(n2(n), n2(list.length));
  box.innerHTML = list.map(k => `<button type="button" class="sk" role="checkbox" data-sk="${k}" aria-checked="${have.has(k)}"><span class="box">${TICK}</span><span class="lb">${esc(t.skill[k])}</span></button>`).join('');
  box.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => toggleSkill(id, b.dataset.sk, b.getAttribute('aria-checked') !== 'true'));
  $('#skSend').href = waLink(s.Phone, progressMsg(s));
}
async function toggleSkill(id, key, on) {
  const db = st.db; db.skills = db.skills || []; const before = db.skills.slice();
  db.skills = db.skills.filter(x => !(x.StudentID === id && x.Skill === key));
  if (on) db.skills.push({ StudentID: id, Skill: key, Date: today(), LoggedBy: st.me });
  drawSkills(id);
  try { await act('setSkill', { StudentID: id, Skill: key, On: on }); drawSkills(id); }
  catch (e) { st.db.skills = before; drawSkills(id); }
}
function progressMsg(s) {
  const t = T(), list = skillsFor(s), have = skillsDone(s.ID), set = st.db.settings || {};
  const first = String(s.Name || '').split(' ')[0];
  const rows = list.map(k => (have.has(k) ? '✅ ' : '⬜ ') + t.skill[k]).join('\n');
  const todo = list.filter(k => !have.has(k));
  const head = st.lang === 'gu'
    ? `🚗 ${t.school} · ${t.cardTitle}\n${first} · ${s.tot ? n2(s.done) + '/' + n2(s.tot) + ' લેસન' : n2(s.done) + ' લેસન'}`
    : `🚗 ${set.SchoolName || 'Soni Motor Training School'} · ${t.cardTitle}\n${first} · ${s.done}${s.tot ? '/' + s.tot : ''} lessons`;
  const tail = todo.length ? `${t.next}: ${t.skill[todo[0]]}` : t.allSkills;
  return `${head}\n\n${rows}\n\n${tail}${s.Instructor ? '\n— ' + s.Instructor : ''}`;
}

/* ================= review QR (shown on the trainer's phone, scanned by the student) ================= */
let qrLib = null;
function loadQR() {
  if (window.qrcode) return Promise.resolve();
  if (qrLib) return qrLib;
  qrLib = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'lib/qrcode.js'; sc.onload = res; sc.onerror = () => { qrLib = null; rej(); }; document.head.appendChild(sc); });
  return qrLib;
}
function openReviewQR(id) {
  const t = T(), s = studentsX().find(x => x.ID === id), link = (st.db.settings || {}).ReviewLink;
  sheet(t.qrTitle, link
    ? `<p class="sub center">${esc(s.Name)}</p><div class="qrbox" id="qrBox" aria-label="QR"></div><p class="center">${t.qrHint}</p>
       <button class="btn primary big" id="qrAsked">${t.askedInPerson}</button>`
    : `<p class="warn">${t.noReviewLink}</p>`, async () => {
    if (!link) return;
    $('#qrAsked').onclick = async () => { closeSheet(); await act('updateStudent', { ID: id, ReviewAsked: s.ReviewAsked || today() }, t.saved); };
    try {
      await loadQR();
      const q = qrcode(0, 'M'); q.addData(link); q.make();
      $('#qrBox').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) { $('#qrBox').outerHTML = `<p class="err center">${t.offline}</p>`; }
  });
}
function quizOn() { return !!(st.db.settings || {}).QuizLink; }
function openStudentForm(enq) {
  const t = T(), P = st.db.packages;
  sheet(t.newStudent, `<form id="fS" class="sheet-form" style="display:flex;flex-direction:column;gap:14px">
    <div class="f"><label for="sN">${t.name}</label><input id="sN" required value="${esc(enq ? enq.Name : '')}" autocomplete="off"></div>
    <div class="f"><label for="sP">${t.phone}</label><input id="sP" inputmode="tel" required value="${esc(enq ? enq.Phone : '')}" placeholder="98xxxxxxxx" autocomplete="off"></div>
    <div class="f"><label for="sK">${t.pkg}</label><select id="sK">${P.map(p => `<option value="${esc(p.PackageID)}" ${enq && enq.CarInterest === p.Car ? 'selected' : ''}>${esc(pkgLabel(p))} · ${n2(p.Lessons)} ${t.lessons} · ${inr(p.PriceINR)}</option>`).join('')}</select></div>
    <div class="f"><label for="sPr">${t.price}</label><input id="sPr" inputmode="numeric"><span class="hint">${t.priceHint}</span></div>
    <div class="two"><div class="f"><label for="sT">${t.instructor}</label><select id="sT">${trainerOpts(st.trainer)}</select></div>
      <div class="f"><label for="sL">${t.licence}</label><select id="sL">${LICS.map(k => `<option value="${k}">${t.lic[k]}</option>`).join('')}</select></div></div>
    <div class="two"><div class="f"><label for="sA">${t.firstPay}</label><input id="sA" inputmode="numeric" placeholder="0"></div>
      <div class="f"><label for="sM">${t.modeL}</label><select id="sM">${MODES.map(k => `<option value="${k}">${t.mode[k]}</option>`).join('')}</select></div></div>
    <p class="err" id="sErr" hidden>${t.required}</p>
    <button class="btn primary big" type="submit">${t.save}</button></form>`, () => {
    const setPrice = () => { const p = pkgOf($('#sK').value); $('#sPr').value = p ? p.PriceINR : ''; };
    $('#sK').onchange = setPrice; setPrice();
    $('#fS').onsubmit = async e => {
      e.preventDefault();
      const ph = $('#sP').value.replace(/\D/g, '').slice(-10);
      if (!$('#sN').value.trim() || ph.length !== 10) { $('#sErr').hidden = false; return; }
      e.submitter && (e.submitter.disabled = true);
      try {
        await act('addStudent', { Name: $('#sN').value.trim(), Phone: ph, PackageID: $('#sK').value, Price: +$('#sPr').value || 0, Instructor: $('#sT').value, Licence: $('#sL').value, PayAmount: +$('#sA').value || 0, PayMode: $('#sM').value, EnquiryID: enq ? enq.ID : '' }, t.saved);
        closeSheet();
      } catch (x) { e.submitter && (e.submitter.disabled = false); }
    };
  });
}
function openPaymentForm(id) {
  const t = T(), S = studentsX().filter(s => s.Status !== 'Dropped').sort((a, b) => b.bal - a.bal || a.Name.localeCompare(b.Name));
  sheet(t.payment, `<form id="fP" style="display:flex;flex-direction:column;gap:14px">
    <div class="f"><label for="pS">${t.student}</label><select id="pS">${S.map(s => `<option value="${s.ID}" ${s.ID === id ? 'selected' : ''}>${esc(s.Name)}${s.bal > 0 ? ' · ' + t.due + ' ' + inr(s.bal) : ''}</option>`).join('')}</select></div>
    <div class="two"><div class="f"><label for="pA">${t.amount}</label><input id="pA" inputmode="numeric" required></div>
      <div class="f"><label for="pD">${t.date}</label><input type="date" id="pD" value="${today()}" max="${today()}"></div></div>
    <div class="f"><span class="lbl">${t.modeL}</span><div class="chips" id="pM">${MODES.map((k, i) => `<button type="button" class="chip" data-m="${k}" aria-pressed="${i === 0}">${t.mode[k]}</button>`).join('')}</div></div>
    <button class="btn primary big" type="submit">${t.save}</button></form>`, () => {
    let mode = 'Cash';
    const fill = () => { const s = S.find(x => x.ID === $('#pS').value); $('#pA').value = s && s.bal > 0 ? s.bal : ''; };
    $('#pS').onchange = fill; fill();
    $('#pM').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; $('#pM').querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#fP').onsubmit = async e => {
      e.preventDefault(); const a = +$('#pA').value; if (!(a > 0)) return;
      try { await act('addPayment', { StudentID: $('#pS').value, AmountINR: a, Mode: mode, Date: $('#pD').value || today() }, t.saved); closeSheet(); } catch (x) { }
    };
  });
}

/* ================= enquiries ================= */
function renderEnquiries(m) {
  const t = T(), td = today();
  m.innerHTML = `<button class="btn primary big" id="eNew">+ ${t.newEnquiry}</button>
    <div class="chips">${[['open', t.open], ['all', t.all]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${st.eFilter === k}">${l}</button>`).join('')}</div>
    <div class="card" id="eList"></div>`;
  const open = e => e.Status === 'New' || e.Status === 'Follow-up';
  const L = st.db.enquiries.filter(e => st.eFilter === 'all' || open(e))
    .sort((a, b) => (open(b) - open(a)) || (a.FollowUp || a.Date).localeCompare(b.FollowUp || b.Date) * (open(a) ? 1 : -1));
  $('#eList').innerHTML = L.map(e => {
    const dueTxt = open(e) && e.FollowUp ? (e.FollowUp <= td ? `<span class="badge red">${t.followDue} ${rel(e.FollowUp)}</span>` : `<span class="badge mute">${fd(e.FollowUp)}</span>`) : `<span class="badge ${e.Status === 'Joined' ? 'ok' : 'mute'}">${t.est[e.Status] || e.Status}</span>`;
    return `<div class="row tap" data-enqrow="${e.ID}"><div class="main"><div class="t">${esc(e.Name)}</div><div class="m">${esc(t.src[e.Source] || e.Source)}${e.CarInterest ? ' · ' + esc(e.CarInterest) : ''} · ${fd(e.Date)}</div></div>${dueTxt}</div>`;
  }).join('') || `<div class="empty">${t.none}</div>`;
  $('#eNew').onclick = () => openEnquiryForm();
  m.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.eFilter = b.dataset.f; renderEnquiries(m); });
  m.querySelectorAll('[data-enqrow]').forEach(r => r.onclick = () => openEnquiry(r.dataset.enqrow));
}
function openEnquiry(id) {
  const t = T(), e = st.db.enquiries.find(x => x.ID === id); if (!e) return;
  const isOpen = e.Status === 'New' || e.Status === 'Follow-up';
  sheet(e.Name, `
    <div class="btns"><a class="btn" href="tel:+91${esc(e.Phone)}">${t.call} ${esc(e.Phone)}</a><a class="btn wa" target="_blank" rel="noopener" href="${waLink(e.Phone, msg('Follow', e.Name))}">${t.whatsapp}</a>${quizOn() ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(e.Phone, msg('Quiz', e.Name))}">${t.sendQuiz}</a>` : ''}</div>
    <dl class="kv"><dt>${t.source}</dt><dd>${esc(t.src[e.Source] || e.Source)}</dd><dt>${t.car}</dt><dd>${esc(e.CarInterest || '–')}</dd><dt>${t.date}</dt><dd>${fd(e.Date)}</dd><dt>${t.status}</dt><dd>${esc(t.est[e.Status] || e.Status)}</dd>${e.FollowUp ? `<dt>${t.followUp}</dt><dd>${fd(e.FollowUp)}</dd>` : ''}${e.LL ? `<dt>${t.licence}</dt><dd>${esc(t.llS[e.LL] || e.LL)}</dd>` : ''}${e.ReferredBy && stuById(e.ReferredBy) ? `<dt>${t.referredBy}</dt><dd>${esc(stuById(e.ReferredBy).Name)}</dd>` : ''}${e.Note ? `<dt>${t.note}</dt><dd>${esc(e.Note)}</dd>` : ''}</dl>
    ${isOpen && (e.LL === 'applied' || e.LL === 'no') ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(e.Phone, msg('LL', e.Name))}">${t.llTips}</a>` : ''}
    ${isOpen ? `<button class="btn primary big" id="eJoin">${t.makeStudent}</button>
    <div class="two"><button class="btn big" id="eLater">${t.followDue} ${t.later}</button><button class="btn big" id="eLost">${t.lost}</button></div>` : ''}`, () => {
    if (!isOpen) return;
    $('#eJoin').onclick = () => { closeSheet(); openStudentForm(e); };
    $('#eLater').onclick = async () => { await act('updateEnquiry', { ID: id, Status: 'Follow-up', FollowUp: addDays(today(), 2) }, t.saved); closeSheet(); };
    $('#eLost').onclick = async () => { await act('updateEnquiry', { ID: id, Status: 'Lost' }, t.saved); closeSheet(); };
  });
}
function openEnquiryForm() {
  const t = T(), cars = [...new Set(st.db.packages.map(p => p.Car))];
  sheet(t.newEnquiry, `<form id="fE" style="display:flex;flex-direction:column;gap:14px">
    <div class="f"><label for="eN">${t.name}</label><input id="eN" required autocomplete="off"></div>
    <div class="f"><label for="eP">${t.phone}</label><input id="eP" inputmode="tel" required placeholder="98xxxxxxxx" autocomplete="off"></div>
    <div class="f"><span class="lbl">${t.source}</span><div class="chips" id="eS">${SOURCES.map((k, i) => `<button type="button" class="chip" data-s="${k}" aria-pressed="${i === 0}">${t.src[k]}</button>`).join('')}</div></div>
    <div class="two"><div class="f"><label for="eC">${t.car}</label><select id="eC"><option value="">${t.notSure}</option>${cars.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="f"><label for="eF">${t.followUp}</label><input type="date" id="eF" value="${addDays(today(), 1)}"></div></div>
    <div class="f"><label for="eNo">${t.note}</label><textarea id="eNo" rows="2"></textarea></div>
    <p class="err" id="eErr" hidden>${t.required}</p>
    <button class="btn primary big" type="submit">${t.save}</button></form>`, () => {
    let src = 'Walk-in';
    $('#eS').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { src = b.dataset.s; $('#eS').querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#fE').onsubmit = async e => {
      e.preventDefault();
      const ph = $('#eP').value.replace(/\D/g, '').slice(-10);
      if (!$('#eN').value.trim() || ph.length !== 10) { $('#eErr').hidden = false; return; }
      try { await act('addEnquiry', { Name: $('#eN').value.trim(), Phone: ph, Source: src, CarInterest: $('#eC').value, FollowUp: $('#eF').value, Note: $('#eNo').value.trim() }, t.saved); closeSheet(); } catch (x) { }
    };
  });
}

/* ================= report ================= */
function renderReport(m) {
  const t = T(), db = st.db, td = today(), w0 = weekStart(td), wPrev = addDays(w0, -7);
  const inW = (d, w) => d && d >= w && d < addDays(w, 7);
  const cnt = (arr, key, w) => arr.filter(x => inW(x[key], w)).length;
  const sum = (w) => db.payments.filter(p => inW(p.Date, w)).reduce((a, p) => a + Number(p.AmountINR || 0), 0);
  const K = [
    [t.enquiries, cnt(db.enquiries, 'Date', w0), cnt(db.enquiries, 'Date', wPrev), false],
    [t.newStudents, cnt(db.students, 'JoinDate', w0), cnt(db.students, 'JoinDate', wPrev), false],
    [t.lessonsK, cnt(db.lessons, 'Date', w0), cnt(db.lessons, 'Date', wPrev), false],
    [t.paymentsIn, sum(w0), sum(wPrev), true]
  ];
  const from4 = addDays(w0, -21), e4 = db.enquiries.filter(e => e.Date >= from4), j4 = e4.filter(e => e.Status === 'Joined').length;
  const S = studentsX(), actN = S.filter(s => s.Status === 'Active').length, owed = S.filter(s => s.Status !== 'Dropped').reduce((a, s) => a + s.bal, 0);
  const asked = S.filter(s => s.ReviewAsked).length, got = S.filter(s => s.ReviewDone).length;
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(w0, -7 * (7 - i)));
  const lw = weeks.map(w => cnt(db.lessons, 'Date', w));
  const src = SOURCES.map(k => [k, db.enquiries.filter(e => e.Source === k && e.Date >= weeks[0]).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  const smx = Math.max(1, ...src.map(x => x[1]));
  const M = moneyStats(), MON = st.lang === 'gu' ? MON_GU : MON_EN;
  const dues = S.filter(s => s.Status !== 'Dropped' && s.bal > 0).sort((a, b) => b.bal - a.bal);
  const trainers = {}; db.lessons.filter(l => l.Date >= from4).forEach(l => { const k = l.Instructor || '–'; trainers[k] = (trainers[k] || 0) + 1; });
  const TR = Object.entries(trainers).sort((a, b) => b[1] - a[1]), trmx = Math.max(1, ...TR.map(x => x[1]));
  const cars = carList(), nSlots = slotList().length * 7;
  const use = cars.map(c => [c, (db.bookings || []).filter(b => b.Car === c && b.Type === 'Booked' && inW(b.Date, w0)).length]);
  const byCar = Object.entries(M.byCar).filter(x => x[1]).sort((a, b) => b[1] - a[1]), cmx = Math.max(1, ...byCar.map(x => x[1]));
  const conv = [...SOURCES, 'Practice'].map(k => { const E = db.enquiries.filter(e => e.Source === k && e.Date >= weeks[0]); return [k, E.length, E.filter(e => e.Status === 'Joined').length]; }).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  const refs = {}; db.enquiries.filter(e => e.ReferredBy && e.Date >= addDays(td, -90)).forEach(e => { const r = refs[e.ReferredBy] || (refs[e.ReferredBy] = [0, 0]); r[0]++; if (e.Status === 'Joined') r[1]++; });
  const REF = Object.entries(refs).map(([id, v]) => [stuById(id), ...v]).filter(x => x[0]).sort((a, b) => b[1] - a[1]);
  const meter = (label, v, mx, right) => `<div class="row"><div class="main"><div class="t">${label}</div><div class="prog"><i style="width:${Math.min(100, v / mx * 100)}%"></i></div></div><b>${right}</b></div>`;
  m.innerHTML = `
    <div><h1>${t.thisWeek}</h1><p class="sub">${t.weekOf(fd(w0))}</p></div>
    <div class="stats">${K.map(([k, a, b, money]) => { const d = a - b; return `<div class="stat"><div class="k">${k}</div><div class="v">${money ? inr(a) : n2(a)}</div><div class="d ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ ' : d < 0 ? '▼ ' : ''}${money ? inr(Math.abs(d)) : n2(Math.abs(d))} ${t.lastWeek}</div></div>`; }).join('')}</div>
    <div class="card" style="padding:14px"><dl class="kv">
      <dt>${t.conv} (${t.conv4})</dt><dd>${n2(j4)} / ${n2(e4.length)}${e4.length ? ' · ' + n2(Math.round(j4 / e4.length * 100)) + '%' : ''}</dd>
      <dt>${t.activeNow}</dt><dd>${n2(actN)}</dd>
      <dt>${t.outstanding}</dt><dd>${inr(owed)}</dd>
      <dt>${t.reviews}</dt><dd>${t.reviewsTxt(n2(asked), n2(got))}</dd></dl></div>
    <section><h2>${t.incomeMonths}</h2><div class="card" style="padding:10px">${bars(M.months.map(x => x.inr), M.months.map(x => MON[+x.month.slice(5) - 1]), t.incomeMonths, v => v >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : n2(v))}</div></section>
    <section><h2>${t.duesT} <span class="count">${inr(owed)}</span></h2><div class="card">${dues.map(s => `<div class="row tap" data-stu="${s.ID}"><div class="main"><div class="t">${esc(s.Name)}</div><div class="m">${n2(s.done)}/${n2(s.tot || '–')} ${t.lessons} · ${esc(t.sst[s.Status] || s.Status)}</div></div><span class="badge due">${inr(s.bal)}</span>
      <a class="btn wa" target="_blank" rel="noopener" href="${waLink(s.Phone, msg('Due', s.Name, { amount: s.bal }))}">${t.dueRemind}</a></div>`).join('') || `<div class="empty">${t.none}</div>`}</div></section>
    <section><h2>${t.lessons8}</h2><div class="card" style="padding:10px">${bars(lw, weeks.map(w => `${+w.slice(8)}/${+w.slice(5, 7)}`), t.lessons8)}</div></section>
    <section><h2>${t.perTrainer}</h2><div class="card">${TR.map(([k, v]) => meter(esc(k), v, trmx, n2(v))).join('') || `<div class="empty">${t.none}</div>`}</div></section>
    ${cars.length ? `<section><h2>${t.carUse}</h2><div class="card">${use.map(([c, v]) => meter(esc(c), v, nSlots || 1, n2(Math.round(v / (nSlots || 1) * 100)) + '%')).join('')}</div></section>` : ''}
    ${byCar.length ? `<section><h2>${t.incomeCar}</h2><div class="card">${byCar.map(([c, v]) => meter(esc(c), v, cmx, inr(v))).join('')}</div></section>` : ''}
    <section><h2>${t.sources8}</h2><div class="card">${src.map(([k, v]) => meter(t.src[k], v, smx, n2(v))).join('') || `<div class="empty">${t.none}</div>`}</div></section>
    ${conv.length ? `<section><h2>${t.convSrc}</h2><div class="card">${conv.map(([k, n, j]) => meter(t.src[k] || esc(k), j, n, `${n2(j)} / ${n2(n)}`)).join('')}</div></section>` : ''}
    ${REF.length ? `<section><h2>${t.referrers}</h2><div class="card">${REF.map(([s, n, j]) => `<div class="row tap" data-stu="${s.ID}"><div class="main"><div class="t">${esc(s.Name)}</div></div><b>${n2(j)} / ${n2(n)}</b></div>`).join('')}</div></section>` : ''}
    ${(() => { const Q = st.db.quiz; if (!Q) return `<section><h2>${t.quizT}</h2><div class="card"><div class="empty">${t.quizNone}</div></div></section>`;
      const W = Q.weeks.slice().reverse().slice(0, 6), S = Object.entries(Q.sources || {}).sort((a, b) => b[1] - a[1]), smx = Math.max(1, ...S.map(x => x[1]));
      return `<section><h2>${t.quizT}</h2><div class="card qtab"><table><thead><tr>${t.quizCols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
        ${W.map(w => `<tr><td>${fd(w.week)}</td><td>${n2(w.people)}</td><td>${n2(w.tests)}</td><td>${n2(w.ready)}</td><td>${n2(w.form || 0)}</td><td>${n2(w.share)}</td></tr>`).join('')}</tbody></table></div></section>
        ${S.length ? `<section><h2>${t.quizSources}</h2><div class="card">${S.map(([k, v]) => meter(esc(t.srcName[k] || k), v, smx, n2(v))).join('')}</div></section>` : ''}`; })()}
    ${db.archived ? `<p class="ver">${t.archivedN(n2(db.archived))}</p>` : ''}`;
  wireCommon(m);
}
/* bar chart: the last bar (this week / this month) is drawn darker */
function bars(vals, labels, title, fmt) {
  fmt = fmt || n2;
  const n = vals.length, mx = Math.max(1, ...vals), W = 340, H = 150, bw = (W - 20) / n;
  let g = `<line x1="0" x2="${W}" y1="${H - 22}" y2="${H - 22}" class="g"/>`;
  vals.forEach((v, i) => { const h = v / mx * (H - 44), x = 10 + i * bw; g += `<rect x="${x + 3}" y="${H - 22 - h}" width="${bw - 6}" height="${h}" rx="3" class="b ${i === n - 1 ? 'cur' : ''}"/><text x="${x + bw / 2}" y="${H - 26 - h}" text-anchor="middle">${v ? fmt(v) : ''}</text><text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(labels[i])}</text>`; });
  return `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${g}</svg>`;
}
/* money per month and per car: worked out by the Sheet from every payment; the demo works it out here */
function moneyStats() {
  if (st.db.money) return st.db.money;
  const td = today(), y = +td.slice(0, 4), mo = +td.slice(5, 7), months = [];
  for (let i = 11; i >= 0; i--) months.push({ month: new Date(Date.UTC(y, mo - 1 - i, 1)).toISOString().slice(0, 7), inr: 0 });
  const S = Object.fromEntries(studentsX().map(s => [s.ID, s])), byCar = {}, from6 = addDays(td, -183);
  st.db.payments.forEach(p => { const k = months.find(x => x.month === String(p.Date).slice(0, 7)); if (k) k.inr += Number(p.AmountINR || 0);
    if (p.Date >= from6) { const c = (S[p.StudentID] && S[p.StudentID].pk && S[p.StudentID].pk.Car) || '–'; byCar[c] = (byCar[c] || 0) + Number(p.AmountINR || 0); } });
  return { months, byCar };
}

/* ================= timetable ================= */
function carList() {
  const set = (st.db.settings || {}).Cars;
  const list = set ? String(set).split(',').map(x => x.trim()) : (st.db.packages || []).map(p => String(p.Car || '').trim());
  return [...new Set(list.filter(c => c && !/EDIT/i.test(c)))];
}
function hm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function toMin(x, d) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(x || '').trim()); return m ? +m[1] * 60 + +m[2] : d; }
function slotList() {
  const s = st.db.settings || {}, a = toMin(s.SlotStart, 390), b = toMin(s.SlotEnd, 1200), step = Math.max(10, Number(s.SlotMinutes) || 30), out = [];
  for (let m = a; m + step <= b; m += step) out.push(hm(m));
  return out;
}
function slotEnd(sl) { return hm(toMin(sl, 0) + Math.max(10, Number((st.db.settings || {}).SlotMinutes) || 30)); }
function bookingsOn(date, car) {
  const o = {}; (st.db.bookings || []).forEach(b => { if (b.Date === date && (!car || b.Car === car)) o[car ? b.Slot : b.Car + '|' + b.Slot] = b; });
  return o;
}
function stuById(id) { return studentsX().find(s => s.ID === id); }
function firstName(n) { return String(n || '').split(' ')[0]; }

function renderTimetable(m) {
  const t = T(), cars = carList();
  if (!cars.length) { m.innerHTML = `<h1>${t.timetable}</h1><div class="card"><div class="empty">${t.noCars}</div></div>`; return; }
  st.ttDate = st.ttDate || today();
  const d = st.ttDate, slots = slotList(), sel = st.ttSel, B = cars.map(c => bookingsOn(d, c));
  const nowMin = d === today() ? toMin(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(11, 16), 0) : (d < today() ? 1e9 : -1);
  let nB = 0, nK = 0; B.forEach(o => Object.values(o).forEach(b => b.Type === 'Blocked' ? nK++ : nB++));
  const cols = `--cols:${cars.length}`;
  m.innerHTML = `
    <div class="ttbar">
      <button class="iconbtn" id="ttPrev" aria-label="‹">‹</button>
      <label class="ttdate"><span><b>${fd(d, true)}</b><small>${rel(d)}</small></span><input type="date" id="ttD" value="${d}" aria-label="${t.date}"></label>
      <button class="iconbtn" id="ttNext" aria-label="›">›</button>
    </div>
    ${st.ttReq && stuById(st.ttReq.StudentID) ? `<div class="selbar"><b>${esc(t.bookFor(stuById(st.ttReq.StudentID).Name))}</b><span class="sub">${fd(st.ttReq.Date, true)} · ${esc(t.want[st.ttReq.Want] || st.ttReq.Want)}</span><span class="sp"></span><button class="btn" id="reqX">${t.cancel}</button></div>` : ''}
    ${sel ? `<div class="selbar"><b>${t.selN(n2(sel.size))}</b><span class="sp"></span>
        <button class="btn" id="selBlock" ${sel.size ? '' : 'disabled'}>${t.blockSel}</button>
        <button class="btn" id="selFree" ${sel.size ? '' : 'disabled'}>${t.freeSel}</button>
        <button class="btn primary" id="selDone">${t.selDone}</button></div>`
      : `<div class="btns"><button class="btn" id="ttSel">${t.select}</button><span class="sp"></span><button class="btn" id="ttPD">${t.printDay}</button><button class="btn" id="ttPW">${t.printWeek}</button></div>`}
    <p class="sub">${t.slotsSummary(n2(nB), n2(nK), n2(slots.length * cars.length - nB - nK))}</p>
    <div class="grid" style="${cols}" role="grid" aria-label="${t.timetable}">
      <div class="gh gt" role="columnheader">${t.time}</div>${cars.map(c => `<div class="gh" role="columnheader">${esc(c)}</div>`).join('')}
      ${slots.map(x => {
        const past = toMin(x, 0) + 30 <= nowMin, now = !past && toMin(x, 0) <= nowMin;
        return `<div class="gtm${now ? ' now' : ''}${past ? ' past' : ''}" role="rowheader">${x}</div>` + cars.map((c, i) => {
          const b = B[i][x], k = c + '|' + x, s = b && b.Type === 'Booked' ? stuById(b.StudentID) : null;
          const cls = (b ? (b.Type === 'Blocked' ? 'blk' : 'bkd') : 'free') + (past ? ' past' : '') + (sel && sel.has(k) ? ' sel' : '');
          const body = !b ? '' : b.Type === 'Blocked' ? `<span class="nm">${esc(b.Note || t.blocked)}</span>`
            : `<span class="nm">${esc(s ? s.Name : b.StudentID)}</span>${s && s.tot ? `<small>${n2(Math.min(s.done + 1, s.tot))}/${n2(s.tot)}</small>` : ''}`;
          const label = `${c} ${x}: ${!b ? t.free : b.Type === 'Blocked' ? t.blocked : (s ? s.Name : '')}`;
          return `<button type="button" class="gc ${cls}" data-cell="${esc(k)}" aria-label="${esc(label)}" ${sel ? `aria-pressed="${sel.has(k)}"` : ''}>${body}</button>`;
        }).join('');
      }).join('')}
    </div>`;
  const go = n => { st.ttDate = addDays(d, n); st.keepScroll = false; render(); };
  if ($('#reqX')) $('#reqX').onclick = () => { st.ttReq = null; render(); };
  $('#ttPrev').onclick = () => go(-1); $('#ttNext').onclick = () => go(1);
  $('#ttD').onchange = e => { if (e.target.value) { st.ttDate = e.target.value; st.keepScroll = false; render(); } };
  m.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => {
    const k = b.dataset.cell, [car, x] = [k.slice(0, k.lastIndexOf('|')), k.slice(k.lastIndexOf('|') + 1)];
    if (st.ttSel) { st.ttSel.has(k) ? st.ttSel.delete(k) : st.ttSel.add(k); render(); }
    else openSlot(car, d, x);
  });
  if (sel) {
    $('#selDone').onclick = () => { st.ttSel = null; render(); };
    $('#selBlock').onclick = () => openBlock(d, [...sel]);
    $('#selFree').onclick = async () => {
      const g = byCar([...sel]); st.ttSel = null;
      for (const car of Object.keys(g)) { try { await act('clearSlots', { Car: car, Date: d, Slots: g[car] }); } catch (e) { break; } }
      toast(t.saved);
    };
  } else {
    $('#ttSel').onclick = () => { st.ttSel = new Set(); render(); };
    $('#ttPD').onclick = () => printTT('day'); $('#ttPW').onclick = () => printTT('week');
  }
}
function byCar(keys) { const g = {}; keys.forEach(k => { const i = k.lastIndexOf('|'); (g[k.slice(0, i)] = g[k.slice(0, i)] || []).push(k.slice(i + 1)); }); Object.values(g).forEach(a => a.sort()); return g; }

function openSlot(car, d, x) {
  const t = T(), b = bookingsOn(d, car)[x], title = `${car} · ${x}–${slotEnd(x)} · ${fd(d)}`;
  if (!b) {
    const S = studentsX().filter(s => s.Status === 'Active').sort((a, c) => a.Name.localeCompare(c.Name));
    sheet(title, `<form id="fB" style="display:flex;flex-direction:column;gap:12px">
        <div class="f"><label for="bS">${t.bookStudent}</label><select id="bS" required><option value="">${t.chooseStudent}</option>${S.map(s => `<option value="${s.ID}" ${st.ttReq && st.ttReq.StudentID === s.ID ? 'selected' : ''}>${esc(s.Name)}${s.tot ? ' · ' + n2(s.done) + '/' + n2(s.tot) : ''}</option>`).join('')}</select></div>
        <div class="f"><label for="bN">${t.note}</label><input id="bN" maxlength="80" autocomplete="off"></div>
        <button class="btn primary big" type="submit">${t.bookStudent}</button></form>
      <button class="btn big" id="bBlk">${t.blockSlot}</button>`, () => {
      $('#fB').onsubmit = async e => {
        e.preventDefault(); const sid = $('#bS').value; if (!sid) return;
        const req = st.ttReq && st.ttReq.StudentID === sid ? st.ttReq : null;
        try { await act('setSlots', Object.assign({ Car: car, Date: d, Slots: [x], Type: 'Booked', StudentID: sid, Note: $('#bN').value.trim() }, req ? { RequestID: req.ID } : {}), t.saved); if (req) { st.ttReq = null; render(); } closeSheet(); } catch (z) { closeSheet(); }
      };
      $('#bBlk').onclick = () => openBlock(d, [car + '|' + x]);
    });
    return;
  }
  if (b.Type === 'Blocked') {
    sheet(title, `<p><b>${t.blocked}</b>${b.Note ? ' · ' + esc(b.Note) : ''}</p><p class="sub">${esc(b.LoggedBy || '')}</p>
      <button class="btn primary big" id="bFree">${t.makeFree}</button>`, () => {
      $('#bFree').onclick = async () => { await act('clearSlots', { Car: car, Date: d, Slots: [x] }, t.saved); closeSheet(); };
    });
    return;
  }
  const s = stuById(b.StudentID) || { Name: b.StudentID, Phone: '' };
  sheet(title, `<dl class="kv"><dt>${t.student}</dt><dd>${esc(s.Name)}</dd>${s.tot ? `<dt>${t.lessons}</dt><dd>${n2(s.done)} / ${n2(s.tot)}</dd>` : ''}${b.Note ? `<dt>${t.note}</dt><dd>${esc(b.Note)}</dd>` : ''}<dt>${t.bookedBy || '✎'}</dt><dd>${esc(b.LoggedBy || '')}</dd></dl>
    <div class="btns">${s.Phone ? `<a class="btn" href="tel:+91${esc(s.Phone)}">${t.call}</a><a class="btn wa" target="_blank" rel="noopener" href="${waLink(s.Phone, t.remindMsg(firstName(s.Name), fd(d, true), x, car))}">${t.remind}</a>` : ''}</div>
    ${s.ID && s.Status === 'Active' ? `<button class="btn primary big" id="bDone">${t.lessonDone}</button>` : ''}
    <button class="btn big" id="bCancel">${t.cancelBooking}</button>`, () => {
    const dn = $('#bDone'); if (dn) dn.onclick = async () => { closeSheet(); await logLesson(s.ID, d, st.trainer || st.me); };
    $('#bCancel').onclick = async () => { await act('clearSlots', { Car: car, Date: d, Slots: [x] }, t.saved); closeSheet(); };
  });
}

function openBlock(d, keys) {
  const t = T(), g = byCar(keys);
  sheet(t.blockSlot, `<p class="sub">${fd(d, true)}<br>${Object.keys(g).map(c => `${esc(c)}: ${g[c].join(', ')}`).join('<br>')}</p>
    <form id="fK" style="display:flex;flex-direction:column;gap:12px">
      <div class="f"><label for="kR">${t.reason}</label><input id="kR" maxlength="60" placeholder="${t.reasonPh}" autocomplete="off"></div>
      <label class="sw"><input type="checkbox" id="kW"> ${t.repeat7}</label>
      <button class="btn primary big" type="submit">${t.blockSel}</button></form>`, () => {
    $('#fK').onsubmit = async e => {
      e.preventDefault(); st.ttSel = null;
      const note = $('#kR').value.trim(), days = $('#kW').checked ? 7 : 1;
      closeSheet();
      for (const car of Object.keys(g)) { try { await act('setSlots', { Car: car, Date: d, Slots: g[car], Type: 'Blocked', Note: note, Days: days }); } catch (z) { return; } }
      toast(t.saved);
    };
  });
}

/* print: builds a plain table into #print and opens the browser's print screen (Save as PDF from there) */
function printTT(kind) {
  const t = T(), car = st.ttCar, slots = slotList(), school = (st.db.settings || {}).SchoolName || 'Soni Motor Training School';
  const cellFor = b => { if (!b) return ''; if (b.Type === 'Blocked') return `<i>${t.blocked}${b.Note ? ': ' + esc(b.Note) : ''}</i>`; const s = stuById(b.StudentID); return esc(s ? s.Name : b.StudentID); };
  let html, orient;
  if (kind === 'day') {
    const d = st.ttDate, cars = carList(), Bs = cars.map(c => bookingsOn(d, c)); orient = cars.length > 3 ? 'landscape' : 'portrait';
    html = `<h1>${esc(school)}</h1><h2>${t.timetable} · ${fd(d, true)} ${d.slice(0, 4)}</h2>
      <table class="pday"><thead><tr><th>${t.time}</th>${cars.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
      ${slots.map(x => `<tr><td>${x}–${slotEnd(x)}</td>${Bs.map(B => { const b = B[x], s = b && b.Type === 'Booked' ? stuById(b.StudentID) : null;
        return `<td class="${b && b.Type === 'Blocked' ? 'k' : ''}">${cellFor(b)}${s && s.Phone ? `<span class="ph">${esc(s.Phone)}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table>`;
  } else {
    const w0 = weekStart(st.ttDate), days = Array.from({ length: 7 }, (_, i) => addDays(w0, i)); orient = 'landscape';
    html = carList().map((car, ci) => { const Bs = days.map(d => bookingsOn(d, car));
      return `<section class="${ci ? 'pb' : ''}"><h1>${esc(school)} · ${esc(car)}</h1><h2>${fd(days[0])} – ${fd(days[6])} ${days[6].slice(0, 4)}</h2>
      <table class="pweek"><thead><tr><th>${t.time}</th>${days.map(d => `<th>${fd(d, true)}</th>`).join('')}</tr></thead><tbody>
      ${slots.map(x => `<tr><td class="tm">${x}</td>${Bs.map(B => `<td class="${B[x] && B[x].Type === 'Blocked' ? 'k' : ''}">${B[x] && B[x].Type === 'Booked' ? esc((stuById(B[x].StudentID) || {}).Name || '') : cellFor(B[x])}</td>`).join('')}</tr>`).join('')}
      </tbody></table></section>`; }).join('');
  }
  $('#print').innerHTML = `<style>@page{size:A4 ${orient};margin:9mm}</style>${html}<p class="pfoot">${t.printedOn} ${fd(today())} · ${esc(st.me || '')}</p>`;
  toast(t.printHint);
  setTimeout(() => { try { window.print(); } catch (e) { } }, 350);
}

/* ================= settings ================= */
function openSettings() {
  const t = T();
  sheet(t.settings, `
    ${st.db.me ? `<div class="f"><span class="lbl">${t.you}</span><div class="who">${esc(st.me)}</div></div>` : `<div class="f"><label for="xMe">${t.you}</label><select id="xMe">${trainerOpts(st.me)}</select></div>`}
    <div class="f"><label for="xTr">${t.defaultTrainer}</label><select id="xTr">${trainerOpts(st.trainer)}</select></div>
    <div class="f"><span class="lbl">${t.language}</span><div class="chips"><button class="chip" data-l="gu" aria-pressed="${st.lang === 'gu'}">ગુજરાતી</button><button class="chip" data-l="en" aria-pressed="${st.lang === 'en'}">English</button></div></div>
    <button class="btn big" id="xOut">${t.logout}</button>
    <p class="ver">${t.version} ${APP_VERSION}${st.db.version && st.db.version !== APP_VERSION ? ' · sheet ' + esc(st.db.version) : ''}</p>`, () => {
    if ($('#xMe')) $('#xMe').onchange = e => { st.me = e.target.value; ls.set('me', st.me); };
    $('#xTr').onchange = e => { st.trainer = e.target.value; ls.set('trainer', st.trainer); };
    document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { st.lang = b.dataset.l; ls.set('lang', st.lang); closeSheet(); render(); openSettings(); });
    $('#xOut').onclick = () => { ls.del('pin'); ls.del('me'); ls.del('db'); st.tab = 'home'; st.pin = ''; st.me = ''; st.db = null; closeSheet(); render(); };
  });
}

/* ================= whatsapp ================= */
function msg(kind, name, x) {
  const s = st.db.settings || {};
  const tpl = s[kind + 'Msg' + (st.lang === 'gu' ? 'GU' : 'EN')] || DEFAULT_MSG[kind + (st.lang === 'gu' ? 'GU' : 'EN')] || '';
  return tpl.replace(/\{name\}/g, String(name || '').split(' ')[0]).replace(/\{link\}/g, s.ReviewLink || '').replace(/\{quiz\}/g, s.QuizLink || '')
    .replace(/\{amount\}/g, x && x.amount ? inr(x.amount) : '').replace(/\{student\}/g, x && x.link || '');
}
/* used until the admin runs setup, which copies these into the Settings tab where they can be edited */
const DEFAULT_MSG = {
  DueEN: 'Hello {name}, this is Soni Motor Training School. {amount} of your fee is still due. You can pay at your next lesson or by UPI. Thank you!',
  DueGU: 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલ તરફથી. તમારી ફીના {amount} બાકી છે. આવતા લેસન વખતે અથવા UPIથી ચૂકવી શકો છો. આભાર!',
  LLEN: 'Hello {name}, this is Soni Motor Training School. When is your learner licence test? Free practice: {quiz} If you start lessons once you have the LL, you will be ready for the driving test after the 30-day wait.',
  LLGU: 'નમસ્તે {name}, સોની મોટર ટ્રેનિંગ સ્કૂલ તરફથી. લર્નિંગ લાઇસન્સની પરીક્ષા ક્યારે છે? તૈયારી માટે મફત પ્રેક્ટિસ: {quiz} LL મળે પછી 30 દિવસમાં ગાડી શીખવાનું શરૂ કરો તો પાકા લાઇસન્સની ટેસ્ટ સમયસર આપી શકશો.',
  StudentEN: 'Hello {name}, see your driving progress, next lessons and licence dates here (this link is just for you): {student}',
  StudentGU: 'નમસ્તે {name}, તમારી ડ્રાઇવિંગ પ્રગતિ, આગળના લેસન અને લાઇસન્સની તારીખો અહીં જુઓ (ફક્ત તમારા માટે): {student}'
};
function waLink(phone, text) { const p = String(phone || '').replace(/\D/g, '').slice(-10); return `https://wa.me/91${p}${text ? '?text=' + encodeURIComponent(text) : ''}`; }

/* ================= sheet & toast ================= */
let sheetEl = null;
function sheet(title, body, mount) {
  closeSheet();
  sheetEl = document.createElement('div');
  sheetEl.className = 'scrim';
  sheetEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><h3>${esc(title)}</h3><button class="btn ghost" id="shX">${T().cancel}</button></div><div class="sheet-b">${body}</div></div>`;
  document.body.appendChild(sheetEl);
  sheetEl.addEventListener('click', e => { if (e.target === sheetEl) closeSheet(); });
  $('#shX').onclick = closeSheet;
  document.body.style.overflow = 'hidden';
  wireCommon(sheetEl.querySelector('.sheet-b'));
  mount && mount(sheetEl);
}
function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; document.body.style.overflow = ''; } }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
let toastTm;
function toast(text, undo) {
  const el = $('#toast'); clearTimeout(toastTm);
  el.innerHTML = `<span>${esc(text)}</span>${undo ? `<button type="button" id="tUndo">${T().undo}</button>` : ''}`;
  el.hidden = false;
  if (undo) $('#tUndo').onclick = () => { el.hidden = true; undo(); };
  toastTm = setTimeout(() => el.hidden = true, undo ? 8000 : 2500);
}
