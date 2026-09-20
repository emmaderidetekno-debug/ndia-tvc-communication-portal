const nodemailer = require('nodemailer');

function createTransporter() {
  if ((process.env.EMAIL_MODE || 'preview').toLowerCase() !== 'smtp') {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendPortalEmail({ to, subject, text, attachmentPath, attachmentName }) {
  const transporter = createTransporter();
  const attachments = attachmentPath
    ? [{ filename: attachmentName || 'attachment', path: attachmentPath }]
    : [];

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Ndia TVC Communication Portal <no-reply@example.com>',
    to,
    subject,
    text,
    attachments
  });

  const preview = (process.env.EMAIL_MODE || 'preview').toLowerCase() !== 'smtp';

  return {
    status: preview ? 'Simulated' : 'Sent',
    messageId: info.messageId || `preview-${Date.now()}`
  };
}

module.exports = { sendPortalEmail };
