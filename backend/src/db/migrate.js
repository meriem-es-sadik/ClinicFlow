'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

/**
 * Apply schema.sql. The script is idempotent and non-destructive: re-running it
 * preserves existing rows. Use `npm run db:reset` for an explicit clean slate.
 * Run `npm run db:seed` afterwards to load demo data.
 */
async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await db.getClient();
  try {
    console.log('[migrate] applying schema.sql ...');
    await client.query(sql);
    console.log('[migrate] schema applied successfully');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => db.closePool())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[migrate] failed:', err.message);
      await db.closePool().catch(() => {});
      process.exit(1);
    });
}

module.exports = migrate;
