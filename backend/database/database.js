const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const projectRoot = path.resolve(__dirname, '..', '..');
const dataDir = path.join(projectRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'ndia-portal.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function now() {
  return new Date().toISOString();
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      admission TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      department TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      audience TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_name TEXT,
      attachment_path TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      recipient_name TEXT,
      recipient_email TEXT NOT NULL,
      recipient_type TEXT,
      status TEXT NOT NULL,
      provider_message_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_reference
      ON deliveries(type, reference_id);
  `);

  seedAccounts();
  seedRecipients();
}

function seedAccounts() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count;
  if (count) return;

  const insert = db.prepare(`
    INSERT INTO accounts (name, username, password_hash, role, status, created_at)
    VALUES (?, ?, ?, ?, 'Active', ?)
  `);

  const seed = [
    ['System Administrator', 'admin', 'admin123', 'Administrator'],
    ['Communication Officer', 'officer', 'officer123', 'Communication Officer'],
    ['Demo Student', 'student', 'student123', 'Student']
  ];

  const transaction = db.transaction(() => {
    for (const [name, username, password, role] of seed) {
      insert.run(name, username, bcrypt.hashSync(password, 10), role, now());
    }
  });

  transaction();
}

function seedRecipients() {
  const studentCount = db.prepare('SELECT COUNT(*) AS count FROM students').get().count;
  const staffCount = db.prepare('SELECT COUNT(*) AS count FROM staff').get().count;

  if (!studentCount) {
    const insertStudent = db.prepare(`
      INSERT INTO students (name, admission, department, email, status, created_at)
      VALUES (?, ?, ?, ?, 'Active', ?)
    `);

    const students = [
      ['Test Student 001', 'NDIA/ICT/001', 'ICT', 'student001@example.com'],
      ['Test Student 002', 'NDIA/MECH/002', 'Mechanical & Automotive', 'student002@example.com'],
      ['Test Student 003', 'NDIA/ELC/003', 'Electrical', 'student003@example.com'],
      ['Test Student 004', 'NDIA/AGR/004', 'Agriculture', 'student004@example.com'],
      ['Test Student 005', 'NDIA/HOS/005', 'Hospitality', 'student005@example.com'],
      ['Test Student 006', 'NDIA/BUS/006', 'Business', 'student006@example.com']
    ];

    const transaction = db.transaction(() => {
      for (const student of students) {
        insertStudent.run(...student, now());
      }
    });
    transaction();
  }

  if (!staffCount) {
    const insertStaff = db.prepare(`
      INSERT INTO staff (name, position, department, email, status, created_at)
      VALUES (?, ?, ?, ?, 'Active', ?)
    `);

    const staff = [
      ['Test Staff 001', 'Head of Department', 'ICT', 'staff001@example.com'],
      ['Test Staff 002', 'Lecturer', 'Building & Civil Engineering', 'staff002@example.com'],
      ['Test Staff 003', 'Administrator', 'Administration', 'staff003@example.com'],
      ['Test Staff 004', 'Lecturer', 'Business', 'staff004@example.com']
    ];

    const transaction = db.transaction(() => {
      for (const member of staff) {
        insertStaff.run(...member, now());
      }
    });
    transaction();
  }
}

module.exports = { db, initDatabase, now };
