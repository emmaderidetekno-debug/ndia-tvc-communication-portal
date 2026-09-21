const express = require('express');
const { db, now } = require('../database/database');
const { authenticate, allowRoles } = require('../middleware/auth');
const { sendPortalEmail } = require('../services/emailService');

const router = express.Router();
router.use(authenticate);

function resolveRecipients(recipient) {
  const value = String(recipient || '').trim();

  if (value === 'All Students') return db.prepare(`SELECT name, email, 'Student' AS recipient_type FROM students WHERE status='Active'`).all();
  if (value === 'All Staff') return db.prepare(`SELECT name, email, 'Staff' AS recipient_type FROM staff WHERE status='Active'`).all();
  if (value === 'Heads of Department') return db.prepare(`SELECT name, email, 'Staff' AS recipient_type FROM staff WHERE status='Active' AND position LIKE '%Head%'`).all();
  if (['Principal', 'Registrar', 'Dean'].includes(value)) {
    return db.prepare(`SELECT name, email, 'Staff' AS recipient_type FROM staff WHERE status='Active' AND position LIKE ?`).all(`%${value}%`);
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return [{ name: value, email: value, recipient_type: 'Direct' }];
  }
  return [];
}

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT m.*, a.name AS author_name
    FROM messages m
    LEFT JOIN accounts a ON a.id = m.created_by
    ORDER BY m.id DESC
  `).all());
});

router.post('/', allowRoles('Administrator', 'Communication Officer'), async (req, res) => {
  const recipient = String(req.body?.recipient || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();

  if (!recipient || !subject || !body) {
    return res.status(400).json({ error: 'Recipient, subject and message are required.' });
  }
  if (subject.length > 200 || body.length > 10000) {
    return res.status(400).json({ error: 'Subject or message is too long.' });
  }

  const recipients = resolveRecipients(recipient);
  if (!recipients.length) return res.status(400).json({ error: 'No valid recipients were found.' });

  const info = db.prepare(`INSERT INTO messages (recipient, subject, body, created_by, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(recipient, subject, body, req.user.id, now());

  const messageId = Number(info.lastInsertRowid);

  const insertDelivery = db.prepare(`
    INSERT INTO deliveries (type, reference_id, recipient_name, recipient_email, recipient_type, status, provider_message_id, error_message, created_at)
    VALUES ('message', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let successful = 0;
  let failed = 0;

  for (const target of recipients) {
    try {
      const result = await sendPortalEmail({ to: target.email, subject, text: body });
      insertDelivery.run(messageId, target.name, target.email, target.recipient_type, result.status, result.messageId, null, now());
      successful += 1;
    } catch (error) {
      insertDelivery.run(messageId, target.name, target.email, target.recipient_type, 'Failed', null, error.message, now());
      failed += 1;
    }
  }

  res.status(201).json({ message: db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId), recipients: recipients.length, successful, failed });
});

module.exports = router;
