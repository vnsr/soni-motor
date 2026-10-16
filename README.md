# Soni Motor

Phone app for Soni Motor Training School, Karelibaug, Vadodara: enquiries, students, one-tap lesson log, payments, progress cards, a timetable grid with one column per car (book, block, print), Google review requests and a weekly report. Gujarati and English.

- **App:** <https://vnsr.github.io/soni-motor/> (installable PWA, Android and iPhone). Add `?demo` to try it with made-up data.
- **Learner's licence practice (public, free):** <https://vnsr.github.io/soni-motor/quiz/>. 197 questions written by the school (not the official RTO bank), Gujarati and English. Practice mode by topic, 15-question timed tests, and a *Ready / Needs more practice* verdict (3 passed tests in a row and 70% of the questions seen). A *Start driving lessons* form sends name, number, car type, preferred time and licence status to the Enquiries tab (Source: Practice app form); the person then visits the office. Installable on its own. Visits are counted anonymously in the Sheet's QuizStats tab: no names, numbers or answers.

## Where the data lives

Nowhere in this repo. All records are in the school's Google Sheet, reached through the Apps Script in [`apps-script/Code.gs`](apps-script/Code.gs). Every request needs a personal PIN; PINs are stored only in the Sheet, and each entry is stamped with the PIN owner's name.

## Files

| Path | What it is |
|---|---|
| `index.html` | The app (single file) |
| `config.js` | `API_URL` of the Sheet's Apps Script web app; empty = demo mode |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA install and offline shell |
| `lib/qrcode.js` | QR generator for the review QR (MIT, Kazuhiko Arase) |
| `quiz/index.html` | Public learner's licence practice (practice, test, readiness, share) |
| `quiz/bank.js` | The question bank and the road-sign drawings |
| `quiz/sw.js`, `quiz/manifest.webmanifest` | The practice app installs and works offline on its own |
| `apps-script/Code.gs` | Sheet API: tabs, PIN check, reads and writes |
| `docs/SETUP.md` | Connecting the Sheet, deploying, installing on phones |

## Releasing a change

1. Edit, then bump `APP_VERSION` in `index.html` and `CACHE` in `sw.js` (and `CACHE` in `quiz/sw.js` if the quiz changed) so phones fetch the new version.
2. If `Code.gs` changed: paste it into the Sheet's Apps Script and deploy a **new version** of the existing deployment.
