# Ndia TVC Communication Portal — Functional Prototype V3

A presentation-ready full-stack prototype for college-wide announcements and communication.

## What is included
- Responsive dark-blue + green institutional UI
- Login with roles and hashed passwords
- Node.js + Express API
- SQLite database with automatic seed data
- Students and staff management
- Announcements with PDF/JPG/PNG/TXT attachments
- Recipient targeting: students, staff, or both
- Email delivery layer with safe Preview mode and optional live SMTP mode
- Messages, delivery records, reports, CSV report download
- 10 controlled test recipients seeded automatically

## Demo accounts
- Administrator: `admin` / `admin123`
- Communication Officer: `officer` / `officer123`
- Student: `student` / `student123`


## Requirements
Install Node.js 20 LTS or later, then open the project in VS Code.

## First run on Windows
1. Open the project folder.
2. Open a terminal in VS Code.
3. Run:

```bash
cd backend
npm install
copy .env.example .env
npm start
```

4. Open `http://localhost:3000` in your browser.

Demonstrating real email delivery, edit `backend/.env`:


EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
EMAIL_FROM="Ndia TVC Communication Portal <your-email@example.com>"

C:\Users\ADMIN\Desktop\PROJECTRIVER\ndia-tvc-communication-portal>
