"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const RESPONSES = "responses";
const DUPLICATE_ATTEMPTS = "duplicateAttempts";

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
    const ref = db.collection(RESPONSES).doc(dedupeKey);
    const snap = await tx.get(ref);

    if (snap.exists) {
      await tx.set(db.collection(DUPLICATE_ATTEMPTS).doc(), {
        dedupeKey,
        submittedAt: data.submittedAt || admin.firestore.FieldValue.serverTimestamp(),
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
    };

    tx.set(ref, payload);
    return { success: true };
  });
});
