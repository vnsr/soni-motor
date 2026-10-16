# Soni Motor app v1.5 — connect the Google Sheet and go live

For the app admin. About 30 minutes remotely, plus 10 minutes on each phone at the school.

**How it fits together**

```
Phone app (PWA, GitHub Pages)  ──POST {pin, action}──▶  Apps Script web app  ──▶  Google Sheet
vnsr.github.io/soni-motor                                 (bound to the Sheet)        (all data lives here)
```

- The repo holds **code only**. Student names, numbers, payments and the PIN live only in the Sheet.
- **Everyone has their own PIN** (Staff tab). The Sheet works out who is using the app from the PIN and stamps every entry with that name; the phone can't claim to be someone else. After 8 wrong PINs the API locks for 15 minutes.
- The **Activity** tab lists who logged in and who changed what, with time.
- The app keeps the last loaded data on the phone, so it still opens without signal (read-only until the internet is back).

---

## 1. Connect the Sheet (10 min)

1. Open the school's Google Sheet with the Google account that should own the data (the school's account if possible).
2. **Extensions → Apps Script.** A script editor opens, bound to this Sheet.
3. Delete everything in `Code.gs` and paste [`apps-script/Code.gs`](../apps-script/Code.gs). Press **Save** (disk icon).
4. In the function menu at the top, choose **`setup`** and press **Run**.
5. Google asks for permission. For your own script it shows *"Google hasn't verified this app"*: **Advanced → Go to (project name) (unsafe) → Allow**. It only gets access to this one Sheet.
6. Open **Execution log** at the bottom. It shows each person's new **PIN** and a *Still to do* list. The PINs are also in the Staff tab.

`setup` creates the tabs Settings, Staff, Packages, Enquiries, Students, Lessons, Payments, Skills, Bookings, Activity and QuizStats, and gives every person in Staff a PIN. It removes an empty default tab (Sheet1 / Tabellenblatt1) and never deletes data, so you can run it again at any time.

## 2. Fill in the Sheet (10 min)

| Tab | What to enter |
|---|---|
| **Settings** | `SchoolPhone` (10 digits). The practice app shows the WhatsApp button and number only once this is filled. Also fill `OfficeAddress` and `OfficeHours` (shown to people after they send the lessons form) and, if you like, `MapLink` (the Google Maps link of the office). `ReviewLink` is already filled with `g.page/r/CWKtBfMYEdoAEBM/review`. Check the `PIN`. The WhatsApp message texts can be edited here. |
| **Staff** | One row per person: `Name` as it should appear in the app, `PIN` (4–8 digits, different for each person; run `setup` and it fills in random ones), `Active` Yes/No. Set **No** when someone leaves: their PIN stops working at once. |
| **Packages** | One row per car: `PackageID` P1, P2 … · `Car` · `Transmission` Manual or Automatic · `Lessons` · `MinutesPerLesson` · `PriceINR` · `Active` Yes/No. |

**Timetable:** `SlotStart` (06:30), `SlotEnd` (20:00) and `SlotMinutes` (30) in Settings set the day's slots. The cars are the car names in Packages; to list them yourself, fill `Cars` in Settings, comma-separated.

Back in Apps Script, run **`checkSetup`** until the log says **Setup complete**. Until then the app shows an orange "Setup not finished" box on its home screen.

## 3. Deploy the API (5 min)

1. **Deploy → New deployment → ⚙ Select type → Web app.**
2. Description: `Soni Motor API`. Execute as: **Me**. Who has access: **Anyone**.
3. **Deploy**, then copy the **Web app URL**. It ends in `/exec`.
4. Check it: open the URL in a browser. You should see `{"ok":true,"app":"soni-motor","version":"1.5.0"}`.

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

## Practice quiz and anonymous counts

The public practice at <https://vnsr.github.io/soni-motor/quiz/> needs no PIN. It sends the Sheet only anonymous events, which land in the **QuizStats** tab: a random device code, the event (`open`, `test`, `book`, `share`), the test score, language, whether the person counts as ready, and where they came from. No names, phone numbers or answers. The app's Report tab sums them per week.

**Lessons form.** *Start driving lessons* in the practice app asks for name, mobile number, manual/automatic, preferred time and learner's licence status. It adds a row to **Enquiries** with Source *Practice app form*, status New and follow-up today, so it shows up in the app's Enquiries and follow-ups. The person sees a reference number and the office address and is asked to visit the office. Protection: only valid Indian mobile numbers, at most 3 forms per phone and 100 a day, a hidden field that catches bots, and the same number within 30 days doesn't create a second row. This is the one place the practice app sends personal data, and only when the person fills in the form.

Where people came from is read from `?src=` in the link. Use one per channel so the Report shows what works:

| Link | Use it on |
|---|---|
| `…/quiz/?src=flyer` | Printed flyer / QR at the office |
| `…/quiz/?src=gbp` | Google Business Profile posts |
| `…/quiz/?src=card` | Review card and WhatsApp messages to students |
| `…/quiz/?src=share` | Added automatically when someone shares their result |

Limits built in: at most 40 events per phone and 3,000 per day, and one *open* per phone per day, so a spammer can't fill the Sheet.

## 5. Test it yourself (10 min)

- [ ] A wrong PIN is refused; each person's PIN opens the app as that person (Settings shows the name)
- [ ] New enquiry with your own number → *Make student* → price fills in from Packages
- [ ] +1 lesson → *Undo* removes it again
- [ ] Tick 3 skills → *Send progress card* opens WhatsApp with the card
- [ ] Payment → balance drops
- [ ] Mark complete → *Show review QR* → scan it with another phone, it opens the Google review form
- [ ] Timetable: book a slot, block two slots, print a day (Save as PDF)
- [ ] Each step appears as a row in the Sheet, and in the Activity tab with your name
- [ ] Open the quiz with `?src=flyer`, finish one test → two rows in QuizStats; the Report tab shows them
- [ ] Send the lessons form with your own number → a new enquiry appears in the app; delete it afterwards
- [ ] Delete your test rows in the Sheet (Enquiries, Students, Lessons, Payments, Skills)

## 6. Install on the phones (10 min each)

Send `https://vnsr.github.io/soni-motor/` on WhatsApp, then go through page 1 of the Gujarati checklist.

- **Android:** open in **Chrome** → ⋮ → *Install app* (or *Add to Home screen*).
- **iPhone:** open in **Safari** (not inside WhatsApp's browser) → Share ⬆ → *Add to Home Screen*.

Then: each person enters **their own** PIN once. The app opens full screen from its red L icon.

## 7. Two-week trial

- The paper diary runs alongside for 14 days. On day 14, compare the diary with the *Lessons* tab.
- **GO** if fewer than about 1 in 20 lessons is missing and the school staff use it without calling the admin. **NO-GO:** find where it hurts (usually the lesson log) and fix that first.
- Once a week: a 10-minute call over the Report tab.

## Known limits

- Saving needs internet. Without it the app shows the last loaded data and says so; nothing is queued.
- The Apps Script ↔ app connection has been tested against a local stand-in for Google, not yet against your live Sheet. Step 5 is that first live test.
- Each save takes 1–3 seconds because it goes through Google. A driving school's few hundred requests a day sit well inside the free Apps Script limits.
- Keep the Sheet shared only with family accounts: it holds students' names and phone numbers.
