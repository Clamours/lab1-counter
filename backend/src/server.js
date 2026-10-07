const express = require('express');
const { pool, initDatabase, getValue, addValue } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

app.get('/api/counter', async (req, res, next) => {
  try {
    res.json({ value: await getValue() });
  } catch (err) {
    next(err);
  }
});

app.post('/api/counter/increment', async (req, res, next) => {
  try {
    res.json({ value: await addValue(1) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/counter/decrement', async (req, res, next) => {
  try {
    res.json({ value: await addValue(-1) });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'database operation failed' });
});

async function main() {
  await initDatabase();
  const server = app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));

  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
