"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const RESPONSES = "responses";
const DUPLICATE_ATTEMPTS = "duplicateAttempts";
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
      title: "Customer Satisfaction Survey",
      intro:
        "Help us improve by answering a few quick questions. This survey is for all ages and takes about 1–2 minutes.",
    },
    experienceChoices: [
      { id: "excellent", label: "Excellent" },
      { id: "good", label: "Good" },
      { id: "ok", label: "Okay" },
      { id: "poor", label: "Needs work" },
    ],
    topics: [
      { id: "pressure", label: "Water pressure" },
      { id: "quality", label: "Water quality" },
      { id: "billing", label: "Billing clarity" },
      { id: "support", label: "Customer support" },
    ],
    feedback: {
      label: "What could we improve this year?",
      helpText: "Choose at least one option.",
      options: [
        "Improve water pressure",
        "Improve water quality",
        "Faster response to issues",
        "Clearer billing",
        "Better communication",
        "More consistent schedule",
      ],
    },
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

  if (Array.isArray(input.experienceChoices)) {
    next.experienceChoices = input.experienceChoices
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: isNonEmptyString(item.id) ? String(item.id).trim() : "",
        label: isNonEmptyString(item.label) ? String(item.label).trim() : "",
      }))
      .filter((item) => item.id && item.label);
    if (next.experienceChoices.length === 0) next.experienceChoices = base.experienceChoices;
  }

  if (Array.isArray(input.topics)) {
    next.topics = input.topics
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: isNonEmptyString(item.id) ? String(item.id).trim() : "",
        label: isNonEmptyString(item.label) ? String(item.label).trim() : "",
      }))
      .filter((item) => item.id && item.label);
    if (next.topics.length === 0) next.topics = base.topics;
  }

  next.feedback = { ...base.feedback, ...(input.feedback || {}) };
  next.feedback.label = isNonEmptyString(next.feedback.label) ? next.feedback.label.trim() : base.feedback.label;
  next.feedback.helpText = isNonEmptyString(next.feedback.helpText)
    ? next.feedback.helpText.trim()
    : base.feedback.helpText;
  if (Array.isArray(input.feedback && input.feedback.options)) {
    next.feedback.options = input.feedback.options
      .map((item) => (isNonEmptyString(item) ? item.trim() : ""))
      .filter(Boolean);
    if (next.feedback.options.length === 0) next.feedback.options = base.feedback.options;
  }

  return next;
}

/**
 * Submit survey. Uses hash-only dedupe (dedupeKey) and a Firestore
 * transaction so duplicate check + write are race-condition safe.
 * No CORS config needed; callable functions handle CORS.
 *
 * Request: { dedupeKey, accountNumber, experience, nps, topics, feedback, followUp, overallScore, submittedAt }
 * Response: { success: true } or { duplicate: true } or throws.
 */
exports.submitSurvey = functions.https.onCall(async (data, context) => {
  const dedupeKey = data && typeof data.dedupeKey === "string" ? data.dedupeKey.trim() : "";
  if (!dedupeKey || dedupeKey.length > 64) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid dedupeKey");
  }

  const db = admin.firestore();

  return db.runTransaction(async (tx) => {
    const configRef = db.collection(SURVEY_CONFIG_COLLECTION).doc(SURVEY_CONFIG_DOC);
    const configSnap = await tx.get(configRef);
    const config = configSnap.exists ? sanitizeSurveyConfig(configSnap.data()) : buildDefaultSurveyConfig();

    const ref = db.collection(RESPONSES).doc(dedupeKey);
    const snap = await tx.get(ref);

    if (snap.exists) {
      await tx.set(db.collection(DUPLICATE_ATTEMPTS).doc(), {
        dedupeKey,
        submittedAt: data.submittedAt || admin.firestore.FieldValue.serverTimestamp(),
        activeYear: config.activeYear,
        configVersion: config.version,
      });
      return { duplicate: true };
    }

    const payload = {
      accountNumber: data.accountNumber || dedupeKey,
      dedupeKey,
      experience: data.experience || "",
      nps: data.nps,
      topics: data.topics || {},
      feedback: data.feedback || "",
      followUp: Boolean(data.followUp),
      overallScore: data.overallScore,
      submittedAt: data.submittedAt || new Date().toISOString(),
      activeYear: config.activeYear,
      configVersion: config.version,
    };

    tx.set(ref, payload);
    return { success: true };
  });
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
