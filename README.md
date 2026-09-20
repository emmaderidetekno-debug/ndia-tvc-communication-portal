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

These are prototype credentials only. Change/remove them before any real institutional deployment.

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

Do **not** open `frontend/index.html` by double-clicking it. The frontend is served by the Node backend.

## Email modes
The default `.env.example` uses:

```env
EMAIL_MODE=preview
```

Preview mode records each email as **Simulated**. This is ideal for a safe HOD presentation because no external emails are sent.

To demonstrate real email delivery, edit `backend/.env`:

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
EMAIL_FROM="Ndia TVC Communication Portal <your-email@example.com>"
```

Then replace the seeded `example.com` recipient addresses from the portal with test addresses you control. Restart the server after changing `.env`.

Never commit `backend/.env` or email passwords to GitHub.

## Seed data
On the first run, the database automatically creates:
- 6 test students
- 4 test staff
- 3 demo login accounts

That gives 10 announcement recipients when the audience is **Students & Staff**.

The database file is created at `data/ndia-portal.db` and is ignored by Git.

## Presentation flow
1. Start the server and sign in as `officer` or `admin`.
2. Show the dashboard and the student/staff directories.
3. Create a new announcement.
4. Choose **Students & Staff**.
5. Attach a small PDF if desired.
6. Publish it.
7. Show the announcement delivery count.
8. Open Reports and show delivery statistics.
9. Download the CSV report.
10. Explain that Preview mode can be switched to authenticated SMTP for live delivery.

## GitHub
From the project root:

```bash
git init
git add .
git commit -m "Ndia TVC Communication Portal functional prototype"
```

Then create an empty GitHub repository and follow GitHub's commands to add the remote and push.

## Production notes
This is a functional prototype, not the final institutional deployment. Before production use, confirm Ndia TVC's requirements for hosting, official email/domain configuration, privacy/data protection, account provisioning, backups, audit logs, approval workflows, retention rules, and official brand guidelines.
