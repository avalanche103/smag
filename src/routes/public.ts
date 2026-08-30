import fs from "node:fs";
import path from "node:path";
import type { RequestHandler } from "express";
import { Router } from "express";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/ru";
import { env } from "../config/env";
import {
  getFeaturedIssue,
  getIssueBySlug,
  getAdjacentIssues,
  getPrimaryIssueMaterials,
  getPageContent,
  getPageExtra,
  getSettings,
  listIssues,
  listPublishedMaterialsForPage,
  filterPublishedMaterials,
  saveMessage,
  stripHtmlTags
} from "../services/contentService";
import { sendContactFormEmail } from "../services/mailService";
import { verifyCsrfToken } from "../middleware/csrf";
import { buildOrganizationJsonLd, buildPageMeta, buildPublicationIssueJsonLd } from "../utils/seo";

dayjs.extend(localizedFormat);
dayjs.locale("ru");

const PUBLISHED_LISTS_PAGE_SIZE = 100;

function siteBase(settings: ReturnType<typeof getSettings>): string {
  return (settings.siteUrl || env.siteUrl).replace(/\/$/, "");
}

function withSiteMeta(
  settings: ReturnType<typeof getSettings>,
  input: {
    title: string;
    description: string;
    path: string;
    ogImage?: string;
    ogType?: string;
    jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  }
) {
  return buildPageMeta({
    title: input.title,
    description: input.description,
    siteUrl: siteBase(settings),
    path: input.path,
    ogImage: input.ogImage,
    ogType: input.ogType,
    jsonLd: input.jsonLd
  });
}

function invoiceDownloadPath(filePath: string): string {
  if (!filePath.startsWith("/uploads/invoices/")) {
    return filePath;
  }
  return `/download/invoice/${path.basename(filePath)}`;
}

export default function publicRouter(formLimiter: RequestHandler) {
  const router = Router();

  router.get("/", (_req, res) => {
    const settings = getSettings();
    const page = getPageContent("home");
    const featuredIssue = getFeaturedIssue();
    const issues = listIssues().slice(0, 6);
    const seoTitle = getPageExtra(page, "seoTitle") || "Главная";
    const seoDescription = getPageExtra(page, "seoDescription") || settings.siteDescription;

    res.render("home", {
      page,
      featuredIssue,
      issues,
      meta: withSiteMeta(settings, {
        title: seoTitle,
        description: stripHtmlTags(seoDescription),
        path: "/",
        ogImage: featuredIssue?.coverImage,
        jsonLd: buildOrganizationJsonLd(settings, siteBase(settings))
      }),
      dayjs
    });
  });

  router.get("/about", (_req, res) => {
    const settings = getSettings();
    const page = getPageContent("about");
    res.render("about", {
      page,
      featuredIssue: getFeaturedIssue(),
      meta: withSiteMeta(settings, {
        title: "О журнале",
        description: stripHtmlTags(page.lead || settings.siteDescription),
        path: "/about",
        jsonLd: buildOrganizationJsonLd(settings, siteBase(settings))
      })
    });
  });

  router.get("/issues", (_req, res) => {
    const settings = getSettings();
    res.render("issues", {
      issues: listIssues(),
      meta: withSiteMeta(settings, {
        title: "Выпуски",
        description: "Актуальные и архивные выпуски журнала с анонсами и обложками.",
        path: "/issues"
      }),
      dayjs
    });
  });

  router.get("/issues/:slug", (req, res) => {
    const settings = getSettings();
    const issue = getIssueBySlug(req.params.slug);
    if (!issue) {
      res.status(404).render("404", {
        meta: withSiteMeta(settings, {
          title: "Выпуск не найден",
          description: "Запрошенный выпуск не найден.",
          path: req.path
        })
      });
      return;
    }

    const metaDescription =
      getPrimaryIssueMaterials(issue)
        .map((material) => material.title)
        .join("; ") || `Материалы выпуска ${issue.numberLabel}`;

    const { previous, next } = getAdjacentIssues(issue.slug);
    const base = siteBase(settings);

    res.render("issue-detail", {
      issue,
      previousIssue: previous,
      nextIssue: next,
      meta: withSiteMeta(settings, {
        title: issue.numberLabel,
        description: metaDescription,
        path: `/issues/${issue.slug}`,
        ogImage: issue.coverImage.startsWith("http") ? issue.coverImage : `${base}${issue.coverImage}`,
        ogType: "article",
        jsonLd: [buildOrganizationJsonLd(settings, base), buildPublicationIssueJsonLd(issue, base)]
      }),
      dayjs
    });
  });

  router.get("/published-lists", (req, res) => {
    const settings = getSettings();
    const filters = {
      number: String(req.query.number ?? "").trim(),
      section: String(req.query.section ?? "").trim(),
      title: String(req.query.title ?? "").trim(),
      author: String(req.query.author ?? "").trim()
    };
    const hasFilters = Object.values(filters).some(Boolean);
    const filteredMaterials = filterPublishedMaterials(listPublishedMaterialsForPage(), filters);
    const pageNumber = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / PUBLISHED_LISTS_PAGE_SIZE));
    const currentPage = Math.min(pageNumber, totalPages);
    const materials = filteredMaterials.slice(
      (currentPage - 1) * PUBLISHED_LISTS_PAGE_SIZE,
      currentPage * PUBLISHED_LISTS_PAGE_SIZE
    );

    const filterQuery = new URLSearchParams();
    if (filters.number) {
      filterQuery.set("number", filters.number);
    }
    if (filters.section) {
      filterQuery.set("section", filters.section);
    }
    if (filters.title) {
      filterQuery.set("title", filters.title);
    }
    if (filters.author) {
      filterQuery.set("author", filters.author);
    }
    const filterQueryString = filterQuery.toString();

    res.render("published-lists", {
      materials,
      filters,
      hasFilters,
      filterQueryString,
      pagination: {
        currentPage,
        totalPages,
        totalItems: filteredMaterials.length,
        pageSize: PUBLISHED_LISTS_PAGE_SIZE
      },
      meta: withSiteMeta(settings, {
        title: "Перечни опубликованного",
        description: "Перечень опубликованных материалов по выпускам.",
        path: currentPage > 1 ? `/published-lists?page=${currentPage}` : "/published-lists"
      }),
      dayjs
    });
  });

  router.get("/payment", (_req, res) => {
    res.redirect(301, "/subscribe");
  });

  router.get("/download/invoice/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = `/uploads/invoices/${filename}`;
    const page = getPageContent("subscribe");
    const allowed = [getPageExtra(page, "invoiceFile1"), getPageExtra(page, "invoiceFile2")];

    if (!allowed.includes(filePath)) {
      res.status(404).render("404", {
        meta: {
          title: "Файл не найден",
          description: "Запрошенный файл недоступен."
        }
      });
      return;
    }

    const diskPath = path.join(env.invoicesDir, filename);
    if (!fs.existsSync(diskPath)) {
      res.status(404).render("404", {
        meta: {
          title: "Файл не найден",
          description: "Запрошенный файл недоступен."
        }
      });
      return;
    }

    res.download(diskPath, filename);
  });

  router.get("/subscribe", (req, res) => {
    const settings = getSettings();
    const page = getPageContent("subscribe");
    res.render("subscribe", {
      page,
      invoiceDownloadPath,
      meta: withSiteMeta(settings, {
        title: "Подписка",
        description: "Оформление подписки на печатную версию журнала.",
        path: "/subscribe"
      }),
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
    req.session.flash = { type: "success", message: "Заявка на подписку отправлена. Редакция свяжется с вами." };
    res.redirect("/subscribe");
  });

  router.get("/contacts", (req, res) => {
    const settings = getSettings();
    const left = 1 + Math.floor(Math.random() * 8);
    const right = 1 + Math.floor(Math.random() * 8);
    req.session.contactCaptcha = {
      answer: left + right,
      issuedAt: Date.now()
    };
    res.render("contacts", {
      page: getPageContent("contacts"),
      meta: withSiteMeta(settings, {
        title: "Контакты",
        description: "Контактная информация редакции и форма обратной связи.",
        path: "/contacts"
      }),
      captchaQuestion: `${left} + ${right}`,
      success: false
    });
  });

  router.post("/contacts", formLimiter, verifyCsrfToken, async (req, res) => {
    const { name, email, phone, message, website, captcha } = req.body as Record<string, string>;
    if (website) {
      req.session.flash = { type: "success", message: "Сообщение отправлено." };
      res.redirect("/contacts");
      return;
    }

    const expected = req.session.contactCaptcha;
    delete req.session.contactCaptcha;
    const captchaValue = Number(String(captcha || "").trim());
    const elapsed = expected ? Date.now() - expected.issuedAt : 0;
    const captchaOk =
      Boolean(expected) &&
      Number.isFinite(captchaValue) &&
      captchaValue === expected!.answer &&
      elapsed >= 1200 &&
      elapsed <= 1000 * 60 * 60;

    if (!captchaOk) {
      req.session.flash = { type: "error", message: "Проверьте ответ на проверочный вопрос и попробуйте ещё раз." };
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

    const mailTo = (settings.mailTo || settings.email || "prof.dialogi@yandex.by").trim();

    try {
      await sendContactFormEmail({
        to: mailTo,
        ...trimmed
      });
      req.session.flash = { type: "success", message: "Сообщение отправлено. Редакция свяжется с вами." };
    } catch (error) {
      console.error("Contact form email failed:", error);
      const detail = error instanceof Error ? error.message : String(error);
      const authFailed = /Invalid login|authentication failed|EAUTH/i.test(detail);
      req.session.flash = {
        type: "error",
        message: authFailed
          ? "Не удалось авторизоваться в почте (SMTP). Проверьте пароль приложения Яндекса в .env и перезапустите сервер. Сообщение сохранено в админке."
          : "Не удалось отправить письмо. Сообщение сохранено в админке, попробуйте позже или позвоните в редакцию."
      };
    }

    res.redirect("/contacts");
  });

  router.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n");
  });

  router.get("/sitemap.xml", (_req, res) => {
    const settings = getSettings();
    const base = siteBase(settings);
    const staticPages: Array<{ path: string; lastmod?: string }> = [
      { path: "" },
      { path: "/about" },
      { path: "/issues" },
      { path: "/published-lists" },
      { path: "/subscribe" },
      { path: "/contacts" }
    ];
    const issuePages = listIssues().map((issue) => ({
      path: `/issues/${issue.slug}`,
      lastmod: issue.publishDate || issue.createdAt
    }));

    const body = [...staticPages, ...issuePages]
      .map((entry) => {
        const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : "";
        return `<url><loc>${base}${entry.path}</loc>${lastmod}<changefreq>weekly</changefreq><priority>${entry.path.startsWith("/issues/") ? "0.8" : "0.9"}</priority></url>`;
      })
      .join("");

    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
  });

  return router;
}
