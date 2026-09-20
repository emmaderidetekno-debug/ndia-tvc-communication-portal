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
    SELECT * FROM deliveries ORDER BY id DESC LIMIT 20
  `).all();

  res.json({
    announcements, students, activeStudents, staff, activeStaff, messages,
    deliveries, successfulDeliveries, failedDeliveries, deliveryRate, recentDeliveries
  });
});

module.exports = router;
