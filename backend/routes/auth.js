const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function isRateLimited(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now - entry.startedAt > WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clearAttempts(key) {
  loginAttempts.delete(key);
}

router.post('/login', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const key = `${req.ip}:${username}`;

  if (isRateLimited(key)) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again in 10 minutes.' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);

  if (!account || account.status !== 'Active' || !bcrypt.compareSync(password, account.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  clearAttempts(key);

  const user = {
    id: account.id,
    name: account.name,
    username: account.username,
    role: account.role
  };

  const token = jwt.sign(user, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '8h',
    issuer: 'ndia-tvc-communication-portal'
  });

  res.json({ token, user });
});

router.get('/me', authenticate, (req, res) => {
  const account = db.prepare('SELECT id, name, username, role, status FROM accounts WHERE id = ?').get(req.user.id);
  if (!account || account.status !== 'Active') return res.status(401).json({ error: 'Account is unavailable.' });
  res.json({ user: account });
});

module.exports = router;
