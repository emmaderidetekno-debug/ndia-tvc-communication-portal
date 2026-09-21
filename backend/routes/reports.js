const express = require('express');
const { db } = require('../database/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary', (req, res) => {
  const scalar = sql => db.prepare(sql).get().count;
  const announcements = scalar('SELECT COUNT(*) AS count FROM announcements');
  const students = scalar('SELECT COUNT(*) AS count FROM students');
  const activeStudents = scalar("SELECT COUNT(*) AS count FROM students WHERE status='Active'");
  const staff = scalar('SELECT COUNT(*) AS count FROM staff');
  const activeStaff = scalar("SELECT COUNT(*) AS count FROM staff WHERE status='Active'");
  const messages = scalar('SELECT COUNT(*) AS count FROM messages');
  const deliveries = scalar('SELECT COUNT(*) AS count FROM deliveries');
  const successfulDeliveries = scalar("SELECT COUNT(*) AS count FROM deliveries WHERE status IN ('Sent','Simulated')");
  const failedDeliveries = scalar("SELECT COUNT(*) AS count FROM deliveries WHERE status='Failed'");
  const deliveryRate = deliveries ? Math.round((successfulDeliveries / deliveries) * 100) : 0;

  const recentDeliveries = db.prepare(`
    SELECT id, type, reference_id, recipient_name, recipient_email, recipient_type, status, provider_message_id, error_message, created_at
    FROM deliveries
    ORDER BY id DESC LIMIT 50
  `).all();

  const recentAnnouncements = db.prepare(`
    SELECT a.id, a.title, a.category, a.audience, a.attachment_name, a.created_at, ac.name AS author_name
    FROM announcements a
    LEFT JOIN accounts ac ON ac.id = a.created_by
    ORDER BY a.id DESC LIMIT 20
  `).all();

  res.json({
    generatedAt: new Date().toISOString(),
    announcements, students, activeStudents, staff, activeStaff, messages,
    deliveries, successfulDeliveries, failedDeliveries, deliveryRate,
    recentDeliveries, recentAnnouncements
  });
});

router.get('/deliveries.csv', (req, res) => {
  const rows = db.prepare(`
    SELECT id, type, reference_id, recipient_name, recipient_email, recipient_type, status, provider_message_id, error_message, created_at
    FROM deliveries ORDER BY id DESC
  `).all();

  const headers = ['ID','Type','Reference ID','Recipient Name','Recipient Email','Recipient Type','Status','Provider Message ID','Error','Created At'];
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map(row => [
    row.id,row.type,row.reference_id,row.recipient_name,row.recipient_email,row.recipient_type,
    row.status,row.provider_message_id,row.error_message,row.created_at
  ].map(escape).join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ndia-tvc-deliveries.csv"');
  res.send(csv);
});

module.exports = router;
