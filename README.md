# Polomolok Water District Survey

Static survey site for collecting customer satisfaction feedback for Polomolok Water District.

## Project structure

- `index.html` - Page shell, loading screen, Firebase and React script imports.
- `app.js` - React survey app (JSX via Babel); survey form, landing page, admin panel; submits via Firebase Callable Function (optional).
- `styles.css` - Site styling, animations, accessibility/focus styles, and admin panel layout.
- `BG animation/` - Background images used by the animated hero.
- `pwd-logo.jpg` - Brand logo used in the header and loader.
- `firebase.json` - Firebase config (functions, Firestore rules).
- `firestore.rules` - Firestore security (no client read/write; only Cloud Functions).
- `functions/` - Cloud Functions (Node): `submitSurvey` for race-safe, hash-only dedupe.

## Features

- **Landing page** - Welcome screen with “Start survey” before Step 1 (account number). Back button from Step 1 returns to the landing page.
- **Multi-step survey** - Progress indicator, account number, experience rating, topic ratings, NPS, feedback options, optional custom questions (short answer, multiple choice, checkboxes, dropdown), review step with contact permission, then submit.
- **Admin panel** - Configure survey via `#/admin`: title, intro, year, experience choices, topic ratings, feedback options, and additional custom questions with types and options. Config is saved to **localStorage** by default; no backend required for configuration.
- **Firebase (optional)** - Set `USE_FIREBASE` in `app.js` to enable submission to Firestore via the `submitSurvey` callable function. When disabled, responses are not persisted (save confirmation still appears for testing).
- **Validation** - Account number (min 5 chars); hash-only dedupe (privacy-safe); one submission per account when using Firebase.
- **Accessibility** - Fieldset/legend, aria labels, focus-visible, reduced motion support for animations.
- **Responsive layout** - Survey and admin work on mobile and desktop.

## Running locally

Open `index.html` in a browser or serve the folder with any static server (e.g. `npx serve .`). The survey and admin work without Firebase; config is stored in the browser’s localStorage.

## Admin panel

- URL: `#/admin` (e.g. `http://localhost:8080/#/admin`).
- Edit survey title and intro, year (2015–2040), experience choices, topic labels, feedback question and options.
- Add **Additional questions** with types: Short answer, Multiple choice, Checkboxes, Dropdown (each with add/remove options).
- **Save to device** stores the config in localStorage; **Load saved** restores it. The survey reads this config when opened.

## Firebase setup (optional)

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/).
2. **Enable Firestore** (Create database; start in production mode).
3. **Deploy rules and function:**
   - Install CLI: `npm install -g firebase-tools` and `firebase login`.
   - From project root: `firebase init` (choose Firestore and Functions if prompted), then:
   - `firebase deploy --only firestore:rules`
   - `cd functions && npm install && cd .. && firebase deploy --only functions`
4. **Get web config:** Project settings → Your apps → Add app (Web) → copy the `firebaseConfig` object.
5. **Configure the survey:** In `app.js`, set `FIREBASE_CONFIG` to your config and `USE_FIREBASE = true`.

Responses are stored in the `responses` collection (document ID = hashed account number). Duplicate attempts are logged in `duplicateAttempts`. No CORS or proxy needed; callable functions handle CORS.

## GitHub Pages

If you enable Pages in the repo (deploy from `main`, root `/`), the site will be available at:

- `https://juan45-dev.github.io/PolWD-survey/` (for repo `PolWD-survey`)
- or `https://juan45-dev.github.io/polomolok-water-survey/` (for repo `polomolok-water-survey`)

Use the URL that matches your repository name. Ensure `FIREBASE_CONFIG` in `app.js` uses your production Firebase project if you rely on cloud submission.

## About

Version 2 – Landing page, admin-driven config, and optional Firebase submission.
