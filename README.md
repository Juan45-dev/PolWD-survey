# Polomolok Water District Survey

A static, single-page survey for **ARTA-style Client Satisfaction** (government office feedback). It runs in the browser with no backend required; optional Firebase can store responses in the cloud.

## What’s in the repo

| File / folder   | Purpose |
|-----------------|--------|
| `index.html`    | Page shell, loading screen, script and style links. |
| `app.js`        | Survey logic: landing → 5-step form → thank-you. Config and (optional) Firebase. |
| `styles.css`    | Layout, form styles, admin panel, animations, responsive rules. |
| `BG animation/`| Images used for the background carousel. |
| `pwd-logo.jpg`  | Logo in header and loader. |
| `functions/`    | Optional Firebase Cloud Functions: `submitSurvey`, `getSurveyConfig`, admin helpers. |
| `firebase.json`, `firestore.rules` | Firebase project config and Firestore security. |

## Survey flow (5 steps)

1. **Client information** – Type (Citizen/Business/Government), date, sex, age, region, service availed.
2. **Citizen’s Charter (CC)** – CC1 (awareness), CC2 (visibility), CC3 (helpfulness); CC2/CC3 can be N/A.
3. **Service Quality (SQD)** – SQD0–SQD8 with Likert scale (Strongly Disagree … Strongly Agree, N/A).
4. **Suggestions** – Free text and optional email.
5. **Review** – Summary of answers, then Submit.

Config (survey title, intro, step labels, year) is stored in **localStorage** on the device. There is no account number; each submission uses a generated `submissionId`.

## Admin panel

- **How to open:** Click the **header logo 5 times** quickly (within about 1.5 seconds). The app then switches to `#/admin`.
- **What you can edit:** Survey year, title, intro text, and the five step labels. Buttons: **Load saved** (from localStorage), **Save to device** (write config to localStorage). **Back to survey** returns to the main survey.

No server is required for config; it’s all local.

## Running locally

Open `index.html` in a browser, or run a static server (e.g. `npx serve .`). The survey and admin work without Firebase.

## Firebase (optional)

To save responses to Firestore:

1. Create a project in [Firebase Console](https://console.firebase.google.com/), enable **Firestore**.
2. Deploy rules and functions:  
   `firebase deploy --only firestore:rules`  
   then `cd functions && npm install && cd .. && firebase deploy --only functions`
3. In the Console, add a **Web app** and copy the `firebaseConfig` object.
4. In `app.js`, set `FIREBASE_CONFIG` to that object and `USE_FIREBASE = true`.

Responses are stored in the `responses` collection (one document per submission, ID = `submissionId`). Callable functions handle CORS; no extra proxy is needed.

## GitHub Pages

Enable Pages for the repo (e.g. deploy from branch `main`, root `/`). The site will be at:

- `https://<your-username>.github.io/<repo-name>/`

Use the same `FIREBASE_CONFIG` in `app.js` if you want cloud submission in production.

## Customization

- **Survey text and options** – Edit the constants at the top of `app.js` (e.g. `STEP_LABELS`, `CLIENT_TYPES`, `SQD_QUESTIONS`, `DEFAULT_CONFIG`).
- **Timing and keys** – Constants like `ADMIN_LOGO_CLICKS`, `LOGO_CLICK_RESET_MS`, `CONFIG_STORAGE_KEY`, `LOCAL_SUBMISSIONS_KEY` are at the top of `app.js`.
- **Styling** – Adjust `styles.css`; the file has a short header describing its sections.

## Accessibility and tech

- Form uses fieldsets, legends, and ARIA where appropriate; focus styles and keyboard navigation are supported.
- Layout is responsive for mobile and desktop.
- Built with React (UMD) and Babel (in-browser JSX). No build step required.
