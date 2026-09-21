const express = require('express');
const bcrypt = require('bcryptjs');
const { db, now } = require('../database/database');
const { authenticate, allowRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const managerRoles = ['Administrator', 'Communication Officer'];
const accountRoles = ['Administrator', 'Communication Officer', 'Student'];
const statuses = ['Active', 'Inactive'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredText(value, field, max = 120) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${field} is required.`);
  if (text.length > max) throw new Error(`${field} is too long.`);
  return text;
}

function validEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!emailPattern.test(email) || email.length > 254) throw new Error('A valid email address is required.');
  return email;
}

router.get('/students', (req, res) => {
  res.json(db.prepare('SELECT * FROM students ORDER BY id DESC').all());
});

router.post('/students', allowRoles(...managerRoles), (req, res) => {
  try {
    const name = requiredText(req.body.name, 'Name');
    const admission = requiredText(req.body.admission, 'Admission number', 50);
    const department = requiredText(req.body.department, 'Department');
    const email = validEmail(req.body.email);
    const status = statuses.includes(req.body.status) ? req.body.status : 'Active';

    const info = db.prepare(`INSERT INTO students (name, admission, department, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(name, admission, department, email, status, now());

    res.status(201).json(db.prepare('SELECT * FROM students WHERE id = ?').get(info.lastInsertRowid));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Admission number or email already exists.' : error.message });
  }
});

router.put('/students/:id', allowRoles(...managerRoles), (req, res) => {
  try {
    const name = requiredText(req.body.name, 'Name');
    const admission = requiredText(req.body.admission, 'Admission number', 50);
    const department = requiredText(req.body.department, 'Department');
    const email = validEmail(req.body.email);
    const status = statuses.includes(req.body.status) ? req.body.status : 'Active';

    db.prepare(`UPDATE students SET name=?, admission=?, department=?, email=?, status=? WHERE id=?`)
      .run(name, admission, department, email, status, req.params.id);

    res.json(db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Admission number or email already exists.' : error.message });
  }
});

router.delete('/students/:id', allowRoles(...managerRoles), (req, res) => {
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/staff', (req, res) => {
  res.json(db.prepare('SELECT * FROM staff ORDER BY id DESC').all());
});

router.post('/staff', allowRoles(...managerRoles), (req, res) => {
  try {
    const name = requiredText(req.body.name, 'Name');
    const position = requiredText(req.body.position, 'Position');
    const department = requiredText(req.body.department, 'Department');
    const email = validEmail(req.body.email);
    const status = statuses.includes(req.body.status) ? req.body.status : 'Active';

    const info = db.prepare(`INSERT INTO staff (name, position, department, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(name, position, department, email, status, now());

    res.status(201).json(db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Staff email already exists.' : error.message });
  }
});

router.put('/staff/:id', allowRoles(...managerRoles), (req, res) => {
  try {
    const name = requiredText(req.body.name, 'Name');
    const position = requiredText(req.body.position, 'Position');
    const department = requiredText(req.body.department, 'Department');
    const email = validEmail(req.body.email);
    const status = statuses.includes(req.body.status) ? req.body.status : 'Active';

    db.prepare(`UPDATE staff SET name=?, position=?, department=?, email=?, status=? WHERE id=?`)
      .run(name, position, department, email, status, req.params.id);

    res.json(db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Staff email already exists.' : error.message });
  }
});

router.delete('/staff/:id', allowRoles(...managerRoles), (req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/accounts', allowRoles('Administrator'), (req, res) => {
  res.json(db.prepare('SELECT id, name, username, role, status, created_at FROM accounts ORDER BY id').all());
});

router.post('/accounts', allowRoles('Administrator'), (req, res) => {
  try {
    const name = requiredText(req.body.name, 'Name');
    const username = requiredText(req.body.username, 'Username', 40).toLowerCase();
    const password = String(req.body.password || '');
    const role = String(req.body.role || '');

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      throw new Error('Username must be 3-40 characters and use letters, numbers, dot, underscore or hyphen.');
    }
    if (password.length < 10) throw new Error('Password must contain at least 10 characters.');
    if (!accountRoles.includes(role)) throw new Error('Invalid account role.');

    const info = db.prepare(`INSERT INTO accounts (name, username, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, 'Active', ?)`)
      .run(name, username, bcrypt.hashSync(password, 12), role, now());

    res.status(201).json(db.prepare('SELECT id, name, username, role, status FROM accounts WHERE id = ?').get(info.lastInsertRowid));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Username already exists.' : error.message });
  }
});

router.patch('/accounts/:id/status', allowRoles('Administrator'), (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  if (account.username === 'admin') return res.status(400).json({ error: 'The primary demo administrator cannot be disabled.' });

  const status = account.status === 'Active' ? 'Inactive' : 'Active';
  db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true, status });
});

router.delete('/accounts/:id', allowRoles('Administrator'), (req, res) => {
  const account = db.prepare('SELECT username FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  if (account.username === 'admin') return res.status(400).json({ error: 'The primary demo administrator cannot be deleted.' });

  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
