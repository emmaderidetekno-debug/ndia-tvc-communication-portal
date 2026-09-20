const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username.trim());

  if (!account || account.status !== 'Active' || !bcrypt.compareSync(password, account.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const user = { id: account.id, name: account.name, username: account.username, role: account.role };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user });
});

router.get('/me', authenticate, (req, res) => {
  const account = db.prepare('SELECT id, name, username, role, status FROM accounts WHERE id = ?').get(req.user.id);
  if (!account || account.status !== 'Active') return res.status(401).json({ error: 'Account is unavailable.' });
  res.json({ user: account });
});

module.exports = router;
