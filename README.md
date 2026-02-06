# Polomolok Water District Survey

Static survey site for collecting customer satisfaction feedback for
Polomolok Water District.

## Project structure

- `index.html` - Page shell, loading screen, Firebase and React script imports.
- `app.js` - React survey app (JSX via Babel); submits via Firebase Callable Function.
- `styles.css` - Site styling, animations, and accessibility/focus styles.
- `BG animation/` - Background images used by the animated hero.
- `pwd-logo.jpg` - Brand logo used in the header and loader.
- `firebase.json` - Firebase config (functions, Firestore rules).
- `firestore.rules` - Firestore security (no client read/write; only Cloud Functions).
- `functions/` - Cloud Functions (Node): `submitSurvey` for race-safe, hash-only dedupe.

## Features

- Multi-step survey with progress indicator
- Ratings and recommendation score inputs
- Validation for account number; hash-only dedupe (privacy-safe)
- One submission per account (enforced in Firestore with transaction)
- Accessibility improvements (fieldset/legend, aria labels, focus-visible)
- Reduced motion support for animations

## Firebase setup

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/).
2. **Enable Firestore** (Create database; start in production mode).
3. **Deploy rules and function:**
   - Install CLI: `npm install -g firebase-tools` and `firebase login`.
   - From project root: `firebase init` (choose Firestore and Functions if prompted), then:
   - `firebase deploy --only firestore:rules`
   - `cd functions && npm install && cd .. && firebase deploy --only functions`
4. **Get web config:** Project settings → Your apps → Add app (Web) → copy the `firebaseConfig` object.
5. **Configure the survey:** In `app.js`, set `FIREBASE_CONFIG` to your config (replace `YOUR_PROJECT_ID`, `YOUR_API_KEY`, etc.).

Responses are stored in the `responses` collection (document ID = hashed account number). Duplicate attempts are logged in `duplicateAttempts`. No CORS or proxy needed; callable functions handle CORS.

## GitHub Pages

If you enable Pages in repo settings (deploy from `main` and `/`), the
site will be available at:

`https://juan45-dev.github.io/polomolok-water-survey/`

Ensure `FIREBASE_CONFIG` in `app.js` uses your production Firebase project.
