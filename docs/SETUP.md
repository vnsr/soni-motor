# Soni Motor app v1.2 — connect the Google Sheet and go live

For the app admin. About 30 minutes remotely, plus 10 minutes on each phone at the school.

**How it fits together**

```
Phone app (PWA, GitHub Pages)  ──POST {pin, action}──▶  Apps Script web app  ──▶  Google Sheet
vnsr.github.io/soni-motor                                 (bound to the Sheet)        (all data lives here)
```

- The repo holds **code only**. Student names, numbers, payments and the PIN live only in the Sheet.
- Every request is checked against the PIN in the Sheet's *Settings* tab. After 8 wrong PINs the API locks for 15 minutes.
- The app keeps the last loaded data on the phone, so it still opens without signal (read-only until the internet is back).

---

## 1. Connect the Sheet (10 min)

1. Open the school's Google Sheet with the Google account that should own the data (the school's account if possible).
2. **Extensions → Apps Script.** A script editor opens, bound to this Sheet.
3. Delete everything in `Code.gs` and paste [`apps-script/Code.gs`](../apps-script/Code.gs). Press **Save** (disk icon).
4. In the function menu at the top, choose **`setup`** and press **Run**.
5. Google asks for permission. For your own script it shows *"Google hasn't verified this app"*: **Advanced → Go to (project name) (unsafe) → Allow**. It only gets access to this one Sheet.
6. Open **Execution log** at the bottom. It shows the new **PIN** and a *Still to do* list.

`setup` creates the tabs Settings, Staff, Packages, Enquiries, Students, Lessons, Payments and Skills. It removes an empty default tab (Sheet1 / Tabellenblatt1) and never deletes data, so you can run it again at any time.

## 2. Fill in the Sheet (10 min)

| Tab | What to enter |
|---|---|
| **Settings** | `SchoolPhone` (10 digits). `ReviewLink` is already filled with `g.page/r/CWKtBfMYEdoAEBM/review`. Check the `PIN`. The WhatsApp message texts can be edited here. |
| **Staff** | One name per row, as they should appear in the app (replace `Trainer` / `Office`). |
| **Packages** | One row per car: `PackageID` P1, P2 … · `Car` · `Transmission` Manual or Automatic · `Lessons` · `MinutesPerLesson` · `PriceINR` · `Active` Yes/No. |

Back in Apps Script, run **`checkSetup`** until the log says **Setup complete**. Until then the app shows an orange "Setup not finished" box on its home screen.

## 3. Deploy the API (5 min)

1. **Deploy → New deployment → ⚙ Select type → Web app.**
2. Description: `Soni Motor API`. Execute as: **Me**. Who has access: **Anyone**.
3. **Deploy**, then copy the **Web app URL**. It ends in `/exec`.
4. Check it: open the URL in a browser. You should see `{"ok":true,"app":"soni-motor","version":"1.2"}`.

"Anyone" is needed because the phones aren't signed in to Google. The PIN is what protects the data.

**Later code changes:** paste the new `Code.gs`, then **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. The `/exec` URL stays the same.

## 4. Point the app at the API (2 min)

In the repo, edit [`config.js`](../config.js) and paste the URL:

```js
window.SONI_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/…/exec'
};
```

Commit. GitHub Pages republishes in about a minute. To see the demo with made-up data at any time, open the app with `?demo` at the end of the address.

**GitHub Pages (once):** repo **Settings → Pages → Source: Deploy from a branch → `main` / root → Save.** The app is then at <https://vnsr.github.io/soni-motor/> and the quiz at <https://vnsr.github.io/soni-motor/quiz/>.

## 5. Test it yourself (10 min)

- [ ] Wrong PIN is refused; the right PIN opens the app
- [ ] New enquiry with your own number → *Make student* → price fills in from Packages
- [ ] +1 lesson → *Undo* removes it again
- [ ] Tick 3 skills → *Send progress card* opens WhatsApp with the card
- [ ] Payment → balance drops
- [ ] Mark complete → *Show review QR* → scan it with another phone, it opens the Google review form
- [ ] Each step appears as a row in the Sheet
- [ ] Delete your test rows in the Sheet (Enquiries, Students, Lessons, Payments, Skills)

## 6. Install on the phones (10 min each)

Send `https://vnsr.github.io/soni-motor/` on WhatsApp, then go through page 1 of the Gujarati checklist.

- **Android:** open in **Chrome** → ⋮ → *Install app* (or *Add to Home screen*).
- **iPhone:** open in **Safari** (not inside WhatsApp's browser) → Share ⬆ → *Add to Home Screen*.

Then: enter the PIN once, choose the name. The app opens full screen from its red L icon.

## 7. Two-week trial

- The paper diary runs alongside for 14 days. On day 14, compare the diary with the *Lessons* tab.
- **GO** if fewer than about 1 in 20 lessons is missing and the school staff use it without calling the admin. **NO-GO:** find where it hurts (usually the lesson log) and fix that first.
- Once a week: a 10-minute call over the Report tab.

## Known limits

- Saving needs internet. Without it the app shows the last loaded data and says so; nothing is queued.
- The Apps Script ↔ app connection has been tested against a local stand-in for Google, not yet against your live Sheet. Step 5 is that first live test.
- Each save takes 1–3 seconds because it goes through Google. A driving school's few hundred requests a day sit well inside the free Apps Script limits.
- Keep the Sheet shared only with family accounts: it holds students' names and phone numbers.
