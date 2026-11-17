'use strict';

const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');

async function start() {
  try {
    await db.checkConnection();
    console.log(
      `[db] connected to postgres://${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}`,
    );
  } catch (err) {
    console.error('[db] unable to connect to PostgreSQL:', err.message);
    console.error('     Check your .env configuration and that PostgreSQL is running.');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`[api] ClinicFlow API listening on http://localhost:${env.port}`);
    console.log(`[api] environment: ${env.nodeEnv}`);
  });

  const shutdown = (signal) => async () => {
    console.log(`\n[api] received ${signal}, shutting down...`);
    server.close(async () => {
      await db.closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

start();
