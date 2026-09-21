require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { initDatabase } = require('./database/database');

const jwtSecret = String(process.env.JWT_SECRET || '').trim();
if (jwtSecret.length < 32) {
  console.error('ERROR: JWT_SECRET must be set in backend/.env and contain at least 32 characters.');
  process.exit(1);
}

initDatabase();

const app = express();
app.disable('x-powered-by');

const port = Number(process.env.PORT || 3000);
const projectRoot = path.resolve(__dirname, '..');
const frontendDir = path.join(projectRoot, 'frontend');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Ndia TVC Communication Portal',
    emailMode: process.env.EMAIL_MODE || 'preview'
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reports', require('./routes/reports'));

// Uploaded files are intentionally NOT exposed as a public static directory.
// Announcement attachments are served through an authenticated route.
app.use(express.static(frontendDir));

app.get('*', (_req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Attachment is too large. Maximum size is 8 MB.' });
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected attachment field.' });
  }
  res.status(400).json({ error: error.message || 'Request failed.' });
});

app.listen(port, () => {
  console.log(`Ndia TVC Communication Portal running at http://localhost:${port}`);
  console.log(`Email mode: ${process.env.EMAIL_MODE || 'preview'}`);
});
