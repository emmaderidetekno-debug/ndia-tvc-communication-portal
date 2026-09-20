const express = require('express');
const bcrypt = require('bcryptjs');
const { db, now } = require('../database/database');
const { authenticate, allowRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const managerRoles = ['Administrator', 'Communication Officer'];

router.get('/students', (req, res) => {
  res.json(db.prepare('SELECT * FROM students ORDER BY id DESC').all());
});

router.post('/students', allowRoles(...managerRoles), (req, res) => {
  const { name, admission, department, email, status = 'Active' } = req.body;
  try {
    const info = db.prepare(`INSERT INTO students (name, admission, department, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(name, admission, department, email, status, now());
    res.status(201).json(db.prepare('SELECT * FROM students WHERE id = ?').get(info.lastInsertRowid));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Admission number or email already exists.' : 'Unable to add student.' });
  }
});

router.put('/students/:id', allowRoles(...managerRoles), (req, res) => {
  const { name, admission, department, email, status = 'Active' } = req.body;
  try {
    db.prepare(`UPDATE students SET name=?, admission=?, department=?, email=?, status=? WHERE id=?`)
      .run(name, admission, department, email, status, req.params.id);
    res.json(db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Admission number or email already exists.' : 'Unable to update student.' });
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
  const { name, position, department, email, status = 'Active' } = req.body;
  try {
    const info = db.prepare(`INSERT INTO staff (name, position, department, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(name, position, department, email, status, now());
    res.status(201).json(db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Staff email already exists.' : 'Unable to add staff member.' });
  }
});

router.put('/staff/:id', allowRoles(...managerRoles), (req, res) => {
  const { name, position, department, email, status = 'Active' } = req.body;
  try {
    db.prepare(`UPDATE staff SET name=?, position=?, department=?, email=?, status=? WHERE id=?`)
      .run(name, position, department, email, status, req.params.id);
    res.json(db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Staff email already exists.' : 'Unable to update staff member.' });
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
  const { name, username, password, role } = req.body;
  try {
    const info = db.prepare(`INSERT INTO accounts (name, username, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, 'Active', ?)`)
      .run(name, username, bcrypt.hashSync(password, 10), role, now());
    res.status(201).json(db.prepare('SELECT id, name, username, role, status FROM accounts WHERE id = ?').get(info.lastInsertRowid));
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Username already exists.' : 'Unable to create account.' });
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
