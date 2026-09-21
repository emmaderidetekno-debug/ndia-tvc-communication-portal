const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, now } = require('../database/database');
const { authenticate, allowRoles } = require('../middleware/auth');
const { sendPortalEmail } = require('../services/emailService');

const router = express.Router();
const projectRoot = path.resolve(__dirname, '..', '..');
const uploadDir = path.join(projectRoot, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Only PDF, PNG, JPG and TXT attachments are allowed.'));
    cb(null, true);
  }
});

router.use(authenticate);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.title, a.category, a.audience, a.message, a.attachment_name, a.created_by, a.created_at, ac.name AS author_name,
      (SELECT COUNT(*) FROM deliveries d WHERE d.type='announcement' AND d.reference_id=a.id) AS delivery_count,
      (SELECT COUNT(*) FROM deliveries d WHERE d.type='announcement' AND d.reference_id=a.id AND d.status IN ('Sent','Simulated')) AS delivered_count
    FROM announcements a
    LEFT JOIN accounts ac ON ac.id = a.created_by
    ORDER BY a.id DESC
  `).all();
  res.json(rows);
});

router.post('/', allowRoles('Administrator', 'Communication Officer'), upload.single('attachment'), async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const category = String(req.body?.category || 'general').trim().toLowerCase();
  const audience = String(req.body?.audience || 'all').trim().toLowerCase();
  const message = String(req.body?.message || '').trim();

  if (!title || !message) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Title and message are required.' });
  }
  if (title.length > 200 || message.length > 10000) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Title or message is too long.' });
  }
  if (!['all', 'students', 'staff'].includes(audience)) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: 'Invalid audience.' });
  }

  const attachmentPath = req.file ? req.file.path : null;
  const attachmentName = req.file ? req.file.originalname : null;

  const info = db.prepare(`
    INSERT INTO announcements (title, category, audience, message, attachment_name, attachment_path, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, category || 'general', audience, message, attachmentName, attachmentPath, req.user.id, now());

  const announcementId = Number(info.lastInsertRowid);
  let recipients = [];

  if (audience === 'all' || audience === 'students') {
    recipients.push(...db.prepare(`SELECT name, email, 'Student' AS recipient_type FROM students WHERE status='Active'`).all());
  }
  if (audience === 'all' || audience === 'staff') {
    recipients.push(...db.prepare(`SELECT name, email, 'Staff' AS recipient_type FROM staff WHERE status='Active'`).all());
  }

  const insertDelivery = db.prepare(`
    INSERT INTO deliveries (type, reference_id, recipient_name, recipient_email, recipient_type, status, provider_message_id, error_message, created_at)
    VALUES ('announcement', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const deliveryResults = await Promise.all(recipients.map(async recipient => {
    try {
      const result = await sendPortalEmail({
        to: recipient.email,
        subject: `[Ndia TVC] ${title}`,
        text: `${message}\n\nThis communication was sent through the Ndia TVC Communication Portal prototype.`,
        attachmentPath,
        attachmentName
      });
      insertDelivery.run(announcementId, recipient.name, recipient.email, recipient.recipient_type, result.status, result.messageId, null, now());
      return result.status;
    } catch (error) {
      insertDelivery.run(announcementId, recipient.name, recipient.email, recipient.recipient_type, 'Failed', null, error.message, now());
      return 'Failed';
    }
  }));

  const successCount = deliveryResults.filter(status => status === 'Sent' || status === 'Simulated').length;
  const row = db.prepare('SELECT id, title, category, audience, message, attachment_name, created_by, created_at FROM announcements WHERE id = ?').get(announcementId);
  res.status(201).json({ announcement: row, recipients: recipients.length, successful: successCount });
});

router.delete('/:id', allowRoles('Administrator', 'Communication Officer'), (req, res) => {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Announcement not found.' });

  db.prepare('DELETE FROM deliveries WHERE type = ? AND reference_id = ?').run('announcement', req.params.id);
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  if (row.attachment_path && fs.existsSync(row.attachment_path)) {
    try { fs.unlinkSync(row.attachment_path); } catch {}
  }
  res.json({ success: true });
});

router.get('/:id/attachment', (req, res) => {
  const row = db.prepare('SELECT attachment_name, attachment_path FROM announcements WHERE id = ?').get(req.params.id);
  if (!row || !row.attachment_path || !fs.existsSync(row.attachment_path)) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }
  res.download(row.attachment_path, row.attachment_name || 'attachment');
});

router.get('/:id/deliveries', (req, res) => {
  res.json(db.prepare(`SELECT * FROM deliveries WHERE type='announcement' AND reference_id=? ORDER BY id DESC`).all(req.params.id));
});

module.exports = router;
