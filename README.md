# Polomolok Water District Survey

A static, single-page survey for **ARTA-style Client Satisfaction** (government office feedback). It runs in the browser (no build step required). Responses can be saved **locally** (default) and the repo also includes an optional **Node/Express + MongoDB backend**.

## Technology Stack

### Frontend
- **React 18** (UMD build, no build step required)
- **Vanilla CSS** with responsive design
- **Google Fonts** (Plus Jakarta Sans)

### Data Storage
- **Browser localStorage** for configurations
- **Browser localStorage** for survey responses (default)
- **Optional backend** (Node/Express + MongoDB) for saving responses
- **URL query parameters** for prefilling some fields (optional)

### Architecture
- Single-page application (SPA)
- Hash-based routing (#/ for survey, #/admin for admin)
- 5-step ARTA-compliant survey flow
- Offline-capable with local storage backup

## What’s in the repo

| File / folder   | Purpose |
|-----------------|--------|
| `index.html`    | Page shell, loading screen, script and style links. |
| `app.js`        | Survey logic: landing → 5-step form → thank-you. Config + submissions, URL prefill, admin panel. |
| `styles.css`    | Layout, form styles, admin panel, animations, responsive rules. |
| `BG animation/`| Images used for the background carousel. |
| `pwd-logo.jpg`  | Logo in header and loader. |
| `backend/`      | **Node/Express API + MongoDB** for saving responses (optional). |

## Survey flow (5 steps)

1. **Client information** – Type (Citizen/Business/Government), date, sex, age, region, service availed.
2. **Citizen’s Charter (CC)** – CC1 (awareness), CC2 (visibility), CC3 (helpfulness); CC2/CC3 can be N/A.
3. **Service Quality (SQD)** – SQD0–SQD8 with Likert scale (Strongly Disagree … Strongly Agree, N/A).
4. **Suggestions** – Free text and optional email.
5. **Review** – Summary of answers, then Submit.

Config (survey title, intro, step labels, year) is stored in **localStorage** on the device. There is no account number; each submission uses a generated `submissionId`.

## Admin panel

- **How to open:** Click the **header logo 5 times** quickly (within about 1.5 seconds). The app then switches to `#/admin`.
- **What you can edit:** Survey year, title, intro text, step labels, and question text. Buttons: **Load saved** (from localStorage), **Save to device** (write config to localStorage). **Back to survey** returns to the main survey.

No server is required for config; it’s all local.

## Running locally

Open `index.html` in a browser, or run a static server (e.g. `npx serve .`). The survey and admin work fully offline (localStorage).

## Backend (Node/Express + MongoDB) (optional)

This repo includes a small API server that can store submissions in MongoDB.

### Setup

1. Create a `.env` file at `backend/.env` (copy `backend/.env.example`).
2. Set:
   - `MONGODB_URI` (example: `mongodb://127.0.0.1:27017`)
   - `MONGODB_DB` (example: `pwd_survey`)
   - `PORT` (optional; defaults to `5175`)
   - `CORS_ORIGINS` (comma-separated origins allowed to call the API; defaults to `http://localhost:8080,http://127.0.0.1:8080`)
3. Install and run the backend:
   - `cd backend`
   - `npm install`
   - `npm run dev`

Responses are stored in MongoDB collection `responses` (one document per submission, keyed by `submissionId` inside the document).

### MongoDB Atlas quick setup (cloud)

1. Create a cluster in MongoDB Atlas.
2. Create a database user (e.g. `pwd_app`) with **readWrite** access.
3. Add your current IP address to **Network Access**.
4. Copy the Node.js driver connection string and put it into `MONGODB_URI` in `backend/.env` (it starts with `mongodb+srv://...`).

### Enable backend saving in the frontend

By default, the frontend saves responses to **localStorage**. To send responses to the backend, set `USE_BACKEND = true` near the top of `app.js`.

By default, the frontend posts to `http://127.0.0.1:5175`. If you later proxy the API behind the same origin as the frontend, set `window.__PWD_BACKEND_BASE_URL` before loading `app.js`.

### API routes

- `GET /api/health` – verifies DB connectivity and returns basic status
- `POST /api/responses` – inserts the posted JSON document into the `responses` collection (requires `submissionId`)

## URL query prefill (optional)

You can prefill a few Step 1 fields by opening the survey with query parameters:

- `date` (YYYY-MM-DD)
- `sex` (`male` or `female`)
- `age` (any string/number; kept as entered)
- `region`
- `service` (maps to “Service availed”)

Example:

- `index.html?date=2026-03-11&sex=male&age=25&region=Region%2012&service=New%20connection`

## GitHub Pages

Enable Pages for the repo (e.g. deploy from branch `main`, root `/`).

## Customization

- **Survey text and options** – Edit the constants at the top of `app.js` (e.g. `STEP_LABELS`, `CLIENT_TYPES`, `SQD_QUESTIONS`, `DEFAULT_CONFIG`).
- **Timing and keys** – Constants like `ADMIN_LOGO_CLICKS`, `LOGO_CLICK_RESET_MS`, `CONFIG_STORAGE_KEY`, `LOCAL_SUBMISSIONS_KEY` are at the top of `app.js`.
- **Styling** – Adjust `styles.css`; the file has a short header describing its sections.

## Accessibility and tech

- Form uses fieldsets, legends, and ARIA where appropriate; focus styles and keyboard navigation are supported.
- Layout is responsive for mobile and desktop.
- Built with React (UMD) and Babel (in-browser JSX). No build step required.
