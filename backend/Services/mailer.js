import { createTransport } from 'nodemailer';

const transporter = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true only for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, html, text }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || `"InternArea" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

export { sendMail };