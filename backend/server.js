import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const dotenvResult = dotenv.config({ path: new URL('./.env', import.meta.url) });

function normalizeSecret(value) {
  const v = String(value || '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

const PORT = Number(process.env.PORT || 5175);
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'pwd_survey';
const ADMIN_API_KEY = normalizeSecret(process.env.ADMIN_API_KEY);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser requests (no Origin header), and allowlisted origins.
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    credentials: false,
  })
);
app.use(express.json({ limit: '256kb' }));

let client = null;

let db;
let indexesReady = false;

function requireAdminApiKey(req) {
  if (!ADMIN_API_KEY) return { ok: false, status: 500, error: 'ADMIN_API_KEY is not configured' };
  const key = String(req.headers['x-api-key'] || '').trim();
  if (!key) return { ok: false, status: 401, error: 'Missing x-api-key' };
  try {
    const a = Buffer.from(key, 'utf8');
    const b = Buffer.from(ADMIN_API_KEY, 'utf8');
    // timingSafeEqual throws if lengths differ, treat as invalid key.
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, status: 403, error: 'Invalid API key' };
    }
  } catch {
    return { ok: false, status: 403, error: 'Invalid API key' };
  }
  return { ok: true };
}

async function ensureDbConnected() {
  if (db) return db;
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI');
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
  }

  await client.connect();
  db = client.db(MONGODB_DB);

  return db;
}

async function ensureIndexes() {
  if (indexesReady) return;
  const database = await ensureDbConnected();
  const responses = database.collection('responses');
  await responses.createIndex({ submissionId: 1 }, { unique: true, name: 'uniq_submissionId' });
  await responses.createIndex({ submittedAt: 1 }, { name: 'submittedAt' });
  await responses.createIndex({ receivedAt: 1 }, { name: 'receivedAt' });
  indexesReady = true;
}

app.get('/api/health', async (_req, res) => {
  try {
    await ensureDbConnected();
    res.json({
      ok: true,
      env: {
        hasMongoUri: typeof process.env.MONGODB_URI === 'string' && process.env.MONGODB_URI.length > 0,
        hasMongoDb: typeof process.env.MONGODB_DB === 'string' && process.env.MONGODB_DB.length > 0,
        adminApiKeyConfigured: !!ADMIN_API_KEY,
        adminApiKeyLength: ADMIN_API_KEY ? ADMIN_API_KEY.length : 0,
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: String(err?.message || err),
      env: {
        dotenvLoaded: !!dotenvResult?.parsed,
        dotenvError: dotenvResult?.error ? String(dotenvResult.error.message || dotenvResult.error) : null,
        hasMongoUri: typeof process.env.MONGODB_URI === 'string' && process.env.MONGODB_URI.length > 0,
        hasMongoDb: typeof process.env.MONGODB_DB === 'string' && process.env.MONGODB_DB.length > 0,
        adminApiKeyConfigured: !!ADMIN_API_KEY,
        adminApiKeyLength: ADMIN_API_KEY ? ADMIN_API_KEY.length : 0,
      },
    });
  }
});

// Admin: list responses (for reporting / export)
// Query params:
// - from/to: ISO date strings compared against receivedAt
// - limit/skip: pagination
app.get('/api/admin/responses', async (req, res) => {
  const auth = requireAdminApiKey(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    const database = await ensureDbConnected();
    await ensureIndexes();
    const responses = database.collection('responses');

    const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit.trim() : '';
    const skipRaw = typeof req.query.skip === 'string' ? req.query.skip.trim() : '';

    const limit = Math.min(Math.max(parseInt(limitRaw || '100', 10) || 100, 1), 1000);
    const skip = Math.max(parseInt(skipRaw || '0', 10) || 0, 0);

    const filter = {};
    if (from || to) {
      filter.receivedAt = {};
      if (from) filter.receivedAt.$gte = from;
      if (to) filter.receivedAt.$lte = to;
    }

    const cursor = responses.find(filter).sort({ receivedAt: -1 }).skip(skip).limit(limit);
    const items = await cursor.toArray();
    const total = await responses.countDocuments(filter);

    return res.json({ ok: true, total, limit, skip, items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.get('/api/admin/responses/:submissionId', async (req, res) => {
  const auth = requireAdminApiKey(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    const submissionId = String(req.params.submissionId || '').trim();
    if (!submissionId) return res.status(400).json({ ok: false, error: 'submissionId is required' });

    const database = await ensureDbConnected();
    await ensureIndexes();
    const responses = database.collection('responses');
    const doc = await responses.findOne({ submissionId });
    if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true, doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.post('/api/responses', async (req, res) => {
  try {
    const database = await ensureDbConnected();
    await ensureIndexes();
    const doc = req.body;

    if (!doc || typeof doc !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
    }
    if (!doc.submissionId || typeof doc.submissionId !== 'string') {
      return res.status(400).json({ ok: false, error: 'submissionId is required' });
    }

    const responses = database.collection('responses');
    const result = await responses.insertOne({
      ...doc,
      receivedAt: new Date().toISOString(),
    });

    return res.status(201).json({ ok: true, insertedId: String(result.insertedId) });
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 11000) {
      return res.status(409).json({ ok: false, error: 'Duplicate submissionId' });
    }
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pwd-survey-backend] listening on http://localhost:${PORT}`);
});

