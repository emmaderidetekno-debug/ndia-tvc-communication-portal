const express = require('express');
const { db, now } = require('../database/database');
const { authenticate, allowRoles } = require('../middleware/auth');
const { sendPortalEmail } = require('../services/emailService');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT m.*, a.name AS author_name
    FROM messages m
    LEFT JOIN accounts a ON a.id = m.created_by
    ORDER BY m.id DESC
  `).all());
});

function resolveRecipients(recipient) {
  if (recipient === 'All Students') {
    return db.prepare(`SELECT name, email, 'Student' AS recipient_type FROM students WHERE status='Active'`).all();
  }
  if (recipient === 'All Staff') {
    return db.prepare(`SELECT name, email, 'Staff' AS recipient_type FROM staff WHERE status='Active'`).all();
  }
  if (recipient === 'Heads of Department') {
    return db.prepare(`SELECT name, email, 'Staff' AS recipient_type FROM staff WHERE status='Active' AND position LIKE '%Head%'`).all();
  }
  if (recipient === 'Principal' || recipient === 'Registrar' || recipient === 'Dean') {
    return db.prepare(`SELECT name, email, 'Staff' AS recipient_type FROM staff WHERE status='Active' AND position LIKE ?`).all(`%${recipient}%`);
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return [{ name: recipient, email: recipient, recipient_type: 'Direct' }];
  }
  return [];
}

router.post('/', allowRoles('Administrator', 'Communication Officer'), async (req, res) => {
  const { recipient, subject, body } = req.body;
  if (!recipient || !subject || !body) return res.status(400).json({ error: 'Recipient, subject and message are required.' });

  const info = db.prepare(`INSERT INTO messages (recipient, subject, body, created_by, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(recipient, subject.trim(), body.trim(), req.user.id, now());
  const messageId = Number(info.lastInsertRowid);
  const recipients = resolveRecipients(recipient);
  const insertDelivery = db.prepare(`
    INSERT INTO deliveries (type, reference_id, recipient_name, recipient_email, recipient_type, status, provider_message_id, error_message, created_at)
    VALUES ('message', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const target of recipients) {
    try {
      const result = await sendPortalEmail({ to: target.email, subject, text: body });
      insertDelivery.run(messageId, target.name, target.email, target.recipient_type, result.status, result.messageId, null, now());
    } catch (error) {
      insertDelivery.run(messageId, target.name, target.email, target.recipient_type, 'Failed', null, error.message, now());
    }
  }

  res.status(201).json({ message: db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId), recipients: recipients.length });
});

module.exports = router;
