import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { api } from './routes/api.js';
import { features } from './routes/features.js';
import { write } from './routes/write.js';
import { auth, requireAuth } from './auth.js';
import { pool, describeTarget } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

// open endpoints
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true, database: describeTarget() });
  } catch (e) {
    res.status(503).json({ ok: false, database: describeTarget(), error: e.message });
  }
});
app.use('/api', auth);

// everything below requires a valid token
app.use('/api', requireAuth, features);
app.use('/api', requireAuth, write);
app.use('/api', requireAuth, api);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`api on http://localhost:${port}`);
  console.log(`database: ${describeTarget()}`);
});
