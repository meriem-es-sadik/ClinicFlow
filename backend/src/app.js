'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());

// CORS: allow the configured frontend origin(s) and non-browser clients.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigin.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (!env.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'ClinicFlow API',
      version: '1.0.0',
      docs: '/api/health',
    },
  });
});

app.use('/api', apiRoutes);

// 404 + centralized error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
