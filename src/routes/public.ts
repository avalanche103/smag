import fs from "node:fs";
import path from "node:path";
import type { RequestHandler } from "express";
import { Router } from "express";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/ru";
import {
  getFeaturedIssue,
  getIssueBySlug,
  getPrimaryIssueMaterials,
  getPageContent,
  getSettings,
  listIssues,
  listPublishedLists,
  saveMessage
} from "../services/contentService";
import { sendContactFormEmail } from "../services/mailService";
import { verifyCsrfToken } from "../middleware/csrf";
import { parseWorkbookPreview } from "../utils/excel";

dayjs.extend(localizedFormat);
dayjs.locale("ru");

function buildMeta(title: string, description: string) {
  return { title, description };
}

export default function publicRouter(formLimiter: RequestHandler) {
  const router = Router();

  router.get("/", (_req, res) => {
    const settings = getSettings();
    const featuredIssue = getFeaturedIssue();
    const issues = listIssues().slice(0, 6);

    res.render("home", {
      page: getPageContent("home"),
      featuredIssue,
      issues,
      meta: buildMeta(settings.seoHomeTitle || settings.siteTitle, settings.seoHomeDescription || settings.siteDescription),
      dayjs
    });
  });

  router.get("/about", (_req, res) => {
    const settings = getSettings();
    res.render("about", {
      page: getPageContent("about"),
      featuredIssue: getFeaturedIssue(),
      meta: buildMeta(`О журнале | ${settings.siteTitle}`, settings.siteDescription)
    });
  });

  router.get("/issues", (_req, res) => {
    const settings = getSettings();
    res.render("issues", {
      issues: listIssues(),
      meta: buildMeta(`Выпуски | ${settings.siteTitle}`, "Актуальные и архивные выпуски журнала с анонсами и обложками."),
      dayjs
    });
  });

  router.get("/issues/:slug", (req, res) => {
    const settings = getSettings();
    const issue = getIssueBySlug(req.params.slug);
    if (!issue) {
      res.status(404).render("404", {
        meta: buildMeta("Выпуск не найден", "Запрошенный выпуск не найден.")
      });
      return;
    }

    const metaDescription = getPrimaryIssueMaterials(issue)
      .map((material) => material.title)
      .join("; ") || `Материалы выпуска ${issue.numberLabel}`;

    res.render("issue-detail", {
      issue,
      meta: buildMeta(`${issue.numberLabel} | ${settings.siteTitle}`, metaDescription),
      dayjs
    });
  });

  router.get("/published-lists", (_req, res) => {
    const settings = getSettings();
    const issues = listIssues();
    // Собираем все материалы из всех выпусков
    const materials = issues.flatMap(issue =>
      (issue.materials || []).map(material => ({
        numberLabel: issue.numberLabel,
        slug: issue.slug,
        publishDate: issue.publishDate,
        section: material.section && material.section.trim() ? material.section : '-',
        title: material.title || '',
        author: material.author && material.author.trim() ? material.author : '-'
      }))
    ).filter(m => m.title);

    res.render("published-lists", {
      materials,
      meta: buildMeta(`Перечни опубликованного | ${settings.siteTitle}`, "Перечень опубликованных материалов по выпускам."),
      dayjs
    });
  });


  router.get("/payment", (_req, res) => {
    const settings = getSettings();
    res.render("payment", {
      page: getPageContent("payment"),
      meta: buildMeta(`Счет и оплата | ${settings.siteTitle}`, "Скачивание счета-фактуры и порядок оплаты."),
      invoiceFile: settings.invoiceFile
    });
  });

  router.get("/subscribe", (req, res) => {
    const settings = getSettings();
    res.render("subscribe", {
      meta: buildMeta(`Подписка | ${settings.siteTitle}`, "Оформление подписки на журнал."),
      site: settings,
      flash: req.session.flash
    });
    req.session.flash = undefined;
  });

  router.post("/subscribe", formLimiter, verifyCsrfToken, (req, res) => {
    const { name, email, phone, address } = req.body as Record<string, string>;
    if (!name || !email || !address) {
      req.session.flash = { type: "error", message: "Пожалуйста, заполните все обязательные поля." };
      res.redirect("/subscribe");
      return;
    }
    // Здесь можно добавить сохранение заявки в базу или отправку на email
    req.session.flash = { type: "success", message: "Заявка на подписку отправлена. Редакция свяжется с вами." };
    res.redirect("/subscribe");
  });

  router.get("/contacts", (_req, res) => {
    const settings = getSettings();
    res.render("contacts", {
      page: getPageContent("contacts"),
      meta: buildMeta(`Контакты | ${settings.siteTitle}`, "Контактная информация редакции и форма обратной связи."),
      success: false
    });
  });

  router.post("/contacts", formLimiter, verifyCsrfToken, async (req, res) => {
    const { name, email, phone, message, website } = req.body as Record<string, string>;
    if (website) {
      req.session.flash = { type: "success", message: "Сообщение отправлено." };
      res.redirect("/contacts");
      return;
    }

    if (!name || !email || !phone || !message) {
      req.session.flash = { type: "error", message: "Заполните все поля формы." };
      res.redirect("/contacts");
      return;
    }

    const settings = getSettings();
    const trimmed = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim()
    };

    saveMessage(trimmed.name, trimmed.email, trimmed.phone, trimmed.message);

    const mailTo = (settings.mailTo || settings.email || "").trim();
    if (!mailTo) {
      req.session.flash = {
        type: "error",
        message: "Не указан email для уведомлений. Сообщение сохранено в админке."
      };
      res.redirect("/contacts");
      return;
    }

    try {
      await sendContactFormEmail({
        to: mailTo,
        ...trimmed
      });
      req.session.flash = { type: "success", message: "Сообщение отправлено. Редакция свяжется с вами." };
    } catch (error) {
      console.error("Contact form email failed:", error);
      req.session.flash = {
        type: "error",
        message: "Не удалось отправить письмо. Сообщение сохранено в админке, попробуйте позже или позвоните в редакцию."
      };
    }

    res.redirect("/contacts");
  });

  router.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n");
  });

  router.get("/sitemap.xml", (_req, res) => {
    const settings = getSettings();
    const base = (settings.siteUrl || process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
    const urls = ["", "/about", "/issues", "/published-lists", "/payment", "/contacts"];
    const issueUrls = listIssues().map((issue) => `/issues/${issue.slug}`);
    const body = [
      ...urls,
      ...issueUrls
    ]
      .map((url) => `<url><loc>${base}${url}</loc></url>`)
      .join("");

    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
  });

  return router;
}
