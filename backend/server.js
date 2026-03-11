import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const dotenvResult = dotenv.config({ path: new URL('./.env', import.meta.url) });

const PORT = Number(process.env.PORT || 5175);
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'pwd_survey';
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
      },
    });
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

