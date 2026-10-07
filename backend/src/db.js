const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const COUNTER_ID = 1;
const INIT_SQL_PATH = process.env.INIT_SQL_PATH || path.join(__dirname, '..', 'database', 'init.sql');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 等待数据库可连接后执行建表与初始化脚本（幂等，不覆盖已有计数）。
async function initDatabase({ retries = 30, delayMs = 2000 } = {}) {
  const sql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(sql);
      console.log('[db] schema ready');
      return;
    } catch (err) {
      console.warn(`[db] not ready (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

async function getValue() {
  const { rows } = await pool.query('SELECT value FROM counter WHERE id = $1', [COUNTER_ID]);
  if (rows.length === 0) throw new Error('counter record missing');
  return rows[0].value;
}

// 单条 UPDATE ... RETURNING 由数据库原子完成加减，并发请求不会互相覆盖。
async function addValue(delta) {
  const { rows } = await pool.query(
    'UPDATE counter SET value = value + $1 WHERE id = $2 RETURNING value',
    [delta, COUNTER_ID],
  );
  if (rows.length === 0) throw new Error('counter record missing');
  return rows[0].value;
}

module.exports = { pool, initDatabase, getValue, addValue };
