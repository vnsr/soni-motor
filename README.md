# Soni Motor

Phone app for Soni Motor Training School, Karelibaug, Vadodara: enquiries, students, one-tap lesson log, payments, progress cards, Google review requests and a weekly report. Gujarati and English.

- **App:** <https://vnsr.github.io/soni-motor/> (installable PWA, Android and iPhone). Add `?demo` to try it with made-up data.
- **Learner's licence practice quiz (public):** <https://vnsr.github.io/soni-motor/quiz/>

## Where the data lives

Nowhere in this repo. All records are in the school's Google Sheet, reached through the Apps Script in [`apps-script/Code.gs`](apps-script/Code.gs). Every request needs the school PIN, which is stored only in the Sheet.

## Files

| Path | What it is |
|---|---|
| `index.html` | The app (single file) |
| `config.js` | `API_URL` of the Sheet's Apps Script web app; empty = demo mode |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA install and offline shell |
| `lib/qrcode.js` | QR generator for the review QR (MIT, Kazuhiko Arase) |
| `quiz/index.html` | Public learner's licence practice quiz |
| `apps-script/Code.gs` | Sheet API: tabs, PIN check, reads and writes |
| `docs/SETUP.md` | Connecting the Sheet, deploying, installing on phones |

## Releasing a change

1. Edit, then bump `APP_VERSION` in `index.html` and `CACHE` in `sw.js` so phones fetch the new version.
2. If `Code.gs` changed: paste it into the Sheet's Apps Script and deploy a **new version** of the existing deployment.
