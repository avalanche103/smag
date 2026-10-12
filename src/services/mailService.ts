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

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

function sanitizeEmail(value: string): string {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
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

  const subject = `Сообщение с сайта: ${sanitizeHeaderValue(input.name)}`;
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
    replyTo: sanitizeEmail(input.email) || undefined,
    subject,
    text,
    html
  });
}

export async function sendInvoiceDownloadDigestEmail(input: {
  to: string;
  dateYmd: string;
  label1: string;
  label2: string;
  count1: number;
  count2: number;
  total: number;
  events: Array<{ time: string; label: string; geo: string; ip: string }>;
  geoSummary: Array<{ place: string; count: number }>;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error("SMTP не настроен. Укажите SMTP_HOST, SMTP_USER, SMTP_PASS и MAIL_FROM.");
  }

  const subject = `Скачивания счетов за ${input.dateYmd}`;
  const eventLines = input.events.map(
    (event) => `${event.time} — ${event.label} — ${event.geo} — ${event.ip || "IP н/д"}`
  );
  const geoLines = input.geoSummary.map((item) => `${item.place} — ${item.count}`);

  const text = [
    `Скачивания счетов за ${input.dateYmd} (Europe/Minsk)`,
    "",
    `${input.label1}: ${input.count1}`,
    `${input.label2}: ${input.count2}`,
    `Всего: ${input.total}`,
    "",
    "Кто скачал:",
    ...eventLines,
    "",
    "По географии:",
    ...geoLines
  ].join("\n");

  const htmlEvents = input.events
    .map(
      (event) =>
        `<li><strong>${escapeText(event.time)}</strong> — ${escapeText(event.label)} — ${escapeText(event.geo)} — <code>${escapeText(event.ip || "IP н/д")}</code></li>`
    )
    .join("");
  const htmlGeo = input.geoSummary
    .map((item) => `<li>${escapeText(item.place)} — ${item.count}</li>`)
    .join("");

  const html = `
    <p><strong>Скачивания счетов за ${escapeText(input.dateYmd)}</strong> (Europe/Minsk)</p>
    <ul>
      <li>${escapeText(input.label1)}: <strong>${input.count1}</strong></li>
      <li>${escapeText(input.label2)}: <strong>${input.count2}</strong></li>
      <li>Всего: <strong>${input.total}</strong></li>
    </ul>
    <p><strong>Кто скачал</strong></p>
    <ul>${htmlEvents}</ul>
    <p><strong>По географии</strong></p>
    <ul>${htmlGeo}</ul>
  `;

  const transporter = createTransport();
  await transporter.sendMail({
    from: env.mailFrom,
    to: input.to,
    subject,
    text,
    html
  });
}
