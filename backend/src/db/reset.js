'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

/**
 * Drop every application object. Destructive - intended for local development
 * and the automated test suite only.
 */
async function reset() {
  const resetPath = path.join(__dirname, 'reset.sql');
  const sql = fs.readFileSync(resetPath, 'utf8');

  const client = await db.getClient();
  try {
    console.log('[reset] dropping application objects ...');
    await client.query(sql);
    console.log('[reset] database objects dropped');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  reset()
    .then(() => db.closePool())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[reset] failed:', err.message);
      await db.closePool().catch(() => {});
      process.exit(1);
    });
}

module.exports = reset;
