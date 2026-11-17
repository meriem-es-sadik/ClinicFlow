'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginSchema } = require('../validators/auth.validator');

const router = express.Router();

// Throttle login attempts to slow down brute-force attacks.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' },
  },
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
