# Soni Motor

Phone app for Soni Motor Training School, Karelibaug, Vadodara: enquiries, students, one-tap lesson log, payments, progress cards, licence dates (LL → driving test), a timetable grid with one column per car (book, block, print), Google review requests, WhatsApp reminders and a report on money, cars and trainers. Gujarati and English. Lessons, payments and enquiries can be saved without signal and are sent when the internet is back.

- **App:** <https://vnsr.github.io/soni-motor/> (installable PWA, Android and iPhone). Add `?demo` to try it with made-up data, `?demo&offline` to try saving without signal.
- **Student page:** each student can get a private link (sent from the app on WhatsApp) showing their lessons, next bookings, skills, fees, licence dates and documents. They can ask for a lesson time there, and share the practice app with their own referral code. Demo: <https://vnsr.github.io/soni-motor/student/?demo>.
- **Learner's licence practice (public, free):** <https://vnsr.github.io/soni-motor/quiz/>. 197 questions written by the school (not the official RTO bank), Gujarati and English. Practice mode by topic, 15-question timed tests, a *Ready / Needs more practice* verdict, and a picture of the result to share. A *Start driving lessons* form sends name, number, car type, preferred time and licence status to the Enquiries tab; if the link came from a student, the enquiry says who referred them. Every question with its answer is also on plain pages per topic (`quiz/topics/`) so search engines can find them. Visits are counted anonymously in the Sheet's QuizStats tab.
- **Emails to the owner:** a 7:00 summary (today's lessons, follow-ups, fees due, licences running out, slot requests), a Monday report and a weekly backup copy of the Sheet in Drive.

## Where the data lives

Nowhere in this repo. All records are in the school's Google Sheet, reached through the Apps Script in [`apps-script/Code.gs`](apps-script/Code.gs). Every staff request needs a personal 6-digit PIN; PINs are stored only in the Sheet, and each entry is stamped with the PIN owner's name. A phone that guesses wrong 5 times is locked for 15 minutes; if many wrong PINs arrive from anywhere, only phones that have never logged in are locked, so staff phones keep working, and the owner gets an email.

## Files

| Path | What it is |
|---|---|
| `index.html` | The app's page; loads the files in `app/` |
| `app/style.css` | Look of the app |
| `app/i18n.js` | All text in English and Gujarati, fixed lists, `APP_VERSION` |
| `app/core.js` | Storage, talking to the Sheet, the queue for changes saved without signal, the shared reducer |
| `app/screens.js` | Today, Students, Timetable, Enquiries, Report, and their sheets |
| `app/demo.js` | Made-up data for `?demo` |
| `config.js` | `API_URL` of the Sheet's Apps Script web app; empty = demo mode |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA install and offline shell |
| `lib/qrcode.js` | QR generator for the review QR (MIT, Kazuhiko Arase) |
| `student/index.html` | The student's private page |
| `quiz/index.html` | Public learner's licence practice (practice, test, readiness, share, lessons form) |
| `quiz/bank.js` | The question bank and the road-sign drawings |
| `quiz/topics/`, `sitemap.xml` | Question pages for search engines, made by `tools/build-topics.js` |
| `quiz/sw.js`, `quiz/manifest.webmanifest` | The practice app installs and works offline on its own |
| `apps-script/Code.gs` | Sheet API: tabs, PIN check, reads and writes, student page, daily emails, backup |
| `tests/` | Checks run by `npm test` and on every push (GitHub Actions) |
| `docs/SETUP.md` | Connecting the Sheet, deploying, installing on phones |

## Releasing a change

1. Edit. If `quiz/bank.js` or the topic names changed, run `npm run topics`.
2. Bump `APP_VERSION` in `app/i18n.js`, `VERSION` in `apps-script/Code.gs` and `CACHE` in `sw.js` together (and `CACHE` in `quiz/sw.js` if the quiz changed) so phones fetch the new version.
3. Run `npm test` (Node 22, no install needed). It runs the Sheet API against an in-memory Sheet, the offline queue, and checks that the versions agree and every cached file exists.
4. If `Code.gs` changed: paste it into the Sheet's Apps Script, run `setup` once (it adds new tabs and columns, never deletes), and deploy a **new version** of the existing deployment.
