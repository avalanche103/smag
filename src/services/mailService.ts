import nodemailer from "nodemailer";
import { env } from "../config/env";

export function isMailConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFrom);
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendContactFormEmail(input: {
  to: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error("SMTP не настроен. Укажите SMTP_HOST, SMTP_USER, SMTP_PASS и MAIL_FROM.");
  }

  const subject = `Сообщение с сайта: ${input.name}`;
  const text = [
    "Новое сообщение с формы обратной связи",
    "",
    `Имя: ${input.name}`,
    `Email: ${input.email}`,
    `Телефон: ${input.phone}`,
    "",
    "Сообщение:",
    input.message
  ].join("\n");

  const html = `
    <p><strong>Новое сообщение с формы обратной связи</strong></p>
    <p><strong>Имя:</strong> ${escapeText(input.name)}<br/>
    <strong>Email:</strong> ${escapeText(input.email)}<br/>
    <strong>Телефон:</strong> ${escapeText(input.phone)}</p>
    <p><strong>Сообщение:</strong></p>
    <p>${escapeText(input.message).replace(/\n/g, "<br/>")}</p>
  `;

  const transporter = createTransport();
  await transporter.sendMail({
    from: env.mailFrom,
    to: input.to,
    replyTo: input.email,
    subject,
    text,
    html
  });
}
