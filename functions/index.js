"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const RESPONSES = "responses";
const SURVEY_CONFIG_COLLECTION = "surveyConfig";
const SURVEY_CONFIG_DOC = "current";
const ADMINS_COLLECTION = "admins";

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

async function assertIsAdmin(db, context) {
  if (!context || !context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Admin login required");
  }
  const ref = db.collection(ADMINS_COLLECTION).doc(context.auth.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("permission-denied", "Not an admin");
  }
}

function buildDefaultSurveyConfig() {
  return {
    activeYear: new Date().getFullYear(),
    version: 1,
    ui: {
      title: "Client Satisfaction Form",
      intro:
        "This Client Satisfaction Measurement (CSM) tracks the customer experience of government offices. Your feedback on your recently concluded transaction will help this office provide a better service. Personal information shared will be kept confidential and you always have the option not to answer this form.",
    },
    stepLabels: [
      "Client information",
      "Citizen’s Charter",
      "Service Quality (SQD)",
      "Suggestions",
      "Review",
    ],
  };
}

function sanitizeSurveyConfig(input) {
  const base = buildDefaultSurveyConfig();
  if (!input || typeof input !== "object") return base;

  const next = { ...base, ...input };
  next.activeYear =
    typeof input.activeYear === "number" && Number.isFinite(input.activeYear)
      ? input.activeYear
      : base.activeYear;
  next.version =
    typeof input.version === "number" && Number.isFinite(input.version) ? input.version : base.version;

  next.ui = { ...base.ui, ...(input.ui || {}) };
  next.ui.title = isNonEmptyString(next.ui.title) ? next.ui.title.trim() : base.ui.title;
  next.ui.intro = isNonEmptyString(next.ui.intro) ? next.ui.intro.trim() : base.ui.intro;

  if (Array.isArray(input.stepLabels)) {
    const cleaned = input.stepLabels.map((x) => (isNonEmptyString(x) ? x.trim() : "")).filter(Boolean);
    next.stepLabels = cleaned.length ? cleaned : base.stepLabels;
  }

  return next;
}

/**
 * Submit survey response.
 *
 * Request: { submissionId, ...responseFields, submittedAt }
 * Response: { success: true } or throws.
 */
exports.submitSurvey = functions.https.onCall(async (data, context) => {
  const submissionId = data && typeof data.submissionId === "string" ? data.submissionId.trim() : "";
  if (!submissionId || submissionId.length > 200) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid submissionId");
  }

  const db = admin.firestore();

  const configRef = db.collection(SURVEY_CONFIG_COLLECTION).doc(SURVEY_CONFIG_DOC);
  const configSnap = await configRef.get();
  const config = configSnap.exists ? sanitizeSurveyConfig(configSnap.data()) : buildDefaultSurveyConfig();

  const payload = {
    ...(data && typeof data === "object" ? data : {}),
    submissionId,
    submittedAt: data.submittedAt || admin.firestore.FieldValue.serverTimestamp(),
    activeYear: config.activeYear,
    configVersion: config.version,
  };

  await db.collection(RESPONSES).doc(submissionId).set(payload);
  return { success: true };
});

exports.getSurveyConfig = functions.https.onCall(async () => {
  const db = admin.firestore();
  const ref = db.collection(SURVEY_CONFIG_COLLECTION).doc(SURVEY_CONFIG_DOC);
  const snap = await ref.get();
  const config = snap.exists ? sanitizeSurveyConfig(snap.data()) : buildDefaultSurveyConfig();
  return config;
});

exports.isAdmin = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  try {
    await assertIsAdmin(db, context);
    return { isAdmin: true };
  } catch (error) {
    return { isAdmin: false };
  }
});

exports.setSurveyConfig = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  await assertIsAdmin(db, context);

  const input = data && typeof data === "object" ? data : {};
  const next = sanitizeSurveyConfig(input);

  // bump version if not explicitly provided
  if (!input.version) {
    next.version = (Number.isFinite(next.version) ? next.version : 1) + 1;
  }

  const ref = db.collection(SURVEY_CONFIG_COLLECTION).doc(SURVEY_CONFIG_DOC);
  await ref.set(
    {
      ...next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
    },
    { merge: true }
  );
  return { success: true, version: next.version };
});
