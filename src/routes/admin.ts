// ...existing code...
// ...existing code...
// ...existing code...
// ...existing code...
import path from "node:path";
import { Router } from "express";
import slugify from "slugify";
import type { IssueMaterial, PageKey } from "../types";
import {
  createPublishedList,
  deleteIssue,
  deletePublishedList,
  getAllPages,
  formatAudienceHtml,
  getAudienceTopics,
  getIssueFormMaterials,
  getIssueById,
  getSettings,
  listIssues,
  listMessages,
  listPublishedLists,
  markMessageRead,
  saveIssue,
  serializeAudienceTopics,
  sanitizeRichHtml,
  togglePublishedList,
  updatePageContent,
  updateSettings
} from "../services/contentService";
import { requireAdmin } from "../middleware/auth";
import { verifyCsrfToken } from "../middleware/csrf";
import { coverUpload, invoiceUpload, listUpload } from "../middleware/uploads";

function parseIssueMaterials(input: unknown): IssueMaterial[] {
  const entries = Array.isArray(input)
    ? input
    : typeof input === "object" && input !== null
      ? Object.values(input as Record<string, unknown>)
      : [];

  return entries.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return { title: "", isPrimary: 0, author: "-", section: "-" };
    }

    const record = entry as Record<string, unknown>;
    return {
      title: typeof record.title === "string" ? record.title : "",
      isPrimary: record.isPrimary ? 1 : 0,
      author: typeof record.author === "string" && record.author.trim() ? record.author : "-",
      section: typeof record.section === "string" && record.section.trim() ? record.section : "-"
    };
  });
}

export default function adminRouter() {
  const router = Router();

  router.get("/login", (req, res) => {
    req.session.adminId = 1;
    req.session.adminLogin = "admin";
    res.redirect("/admin");
  });

  router.post("/logout", requireAdmin, verifyCsrfToken, (req, res) => {
    req.session.destroy(() => {
      res.redirect("/admin");
    });
  });

  router.use(requireAdmin);

  router.get("/", (_req, res) => {
    res.render("admin/dashboard", {
      meta: { title: "Админ-панель", description: "Управление сайтом журнала" },
      issues: listIssues(true).slice(0, 5),
      messages: listMessages().slice(0, 5),
      lists: listPublishedLists(false).slice(0, 5)
    });
  });

  router.get("/settings", (_req, res) => {
    const settings = getSettings();
    res.render("admin/settings", {
      meta: { title: "Настройки сайта", description: "Основные настройки и контакты" },
      settings,
      audienceTopics: getAudienceTopics(settings),
      aboutAudienceHtml: formatAudienceHtml(settings.aboutAudience)
    });
  });

  router.post("/settings", verifyCsrfToken, (req, res) => {
    const body = req.body as Record<string, unknown>;
    updateSettings({
      siteTitle: String(body.siteTitle ?? ""),
      siteDescription: String(body.siteDescription ?? ""),
      heroTitle: String(body.heroTitle ?? ""),
      heroText: String(body.heroText ?? ""),
      aboutAudience: sanitizeRichHtml(String(body.aboutAudience ?? "")),
      aboutAudienceTopics: serializeAudienceTopics(body.audienceTopics),
      periodicity: String(body.periodicity ?? ""),
      publisher: String(body.publisher ?? ""),
      editorialInfo: String(body.editorialInfo ?? ""),
      distributionFormat: String(body.distributionFormat ?? ""),
      hotlineTitle: String(body.hotlineTitle ?? ""),
      hotlineText: String(body.hotlineText ?? ""),
      paymentTitle: String(body.paymentTitle ?? ""),
      paymentText: String(body.paymentText ?? ""),
      phone: String(body.phone ?? ""),
      phone2: String(body.phone2 ?? ""),
      email: String(body.email ?? ""),
      address: String(body.address ?? ""),
      requisites: String(body.requisites ?? ""),
      workingHours: String(body.workingHours ?? ""),
      seoHomeTitle: String(body.seoHomeTitle ?? ""),
      seoHomeDescription: String(body.seoHomeDescription ?? ""),
      siteUrl: String(body.siteUrl ?? ""),
      analyticsId: String(body.analyticsId ?? ""),
      mailTo: String(body.mailTo ?? "")
    });
    req.session.flash = { type: "success", message: "Настройки сохранены." };
    res.redirect("/admin/settings");
  });


  router.post("/invoice1", invoiceUpload.single("invoiceFile1"), verifyCsrfToken, (req, res) => {
    const uploaded = req.file ? `/uploads/invoices/${req.file.filename}` : req.body.currentFile1 || "";
    const label = req.body.invoiceLabel1 || "Скачать счет 1";
    updateSettings({ invoiceFile1: uploaded, invoiceLabel1: label });
    req.session.flash = { type: "success", message: "Счет 1 обновлен." };
    res.redirect("/admin/settings");
  });

  router.post("/invoice2", invoiceUpload.single("invoiceFile2"), verifyCsrfToken, (req, res) => {
    const uploaded = req.file ? `/uploads/invoices/${req.file.filename}` : req.body.currentFile2 || "";
    const label = req.body.invoiceLabel2 || "Скачать счет 2";
    updateSettings({ invoiceFile2: uploaded, invoiceLabel2: label });
    req.session.flash = { type: "success", message: "Счет 2 обновлен." };
    res.redirect("/admin/settings");
  });

  router.get("/pages", (_req, res) => {
    res.render("admin/pages", {
      meta: { title: "Страницы", description: "Редактирование текстовых страниц" },
      pages: getAllPages()
    });
  });

  router.get("/pages/:pageKey", (req, res) => {
    const page = getAllPages().find((item) => item.pageKey === req.params.pageKey);
    if (!page) {
      res.redirect("/admin/pages");
      return;
    }
    res.render("admin/page-form", {
      meta: { title: `Редактирование: ${page.title}`, description: "Редактирование содержимого страницы" },
      page
    });
  });

  router.post("/pages/:pageKey", verifyCsrfToken, (req, res) => {
    const { title, lead, body } = req.body as Record<string, string>;
    updatePageContent(req.params.pageKey as PageKey, title ?? "", lead ?? "", body ?? "");
    req.session.flash = { type: "success", message: "Страница обновлена." };
    res.redirect(`/admin/pages/${req.params.pageKey}`);
  });

  router.get("/issues", (_req, res) => {
    res.render("admin/issues", {
      meta: { title: "Выпуски", description: "Управление выпусками журнала" },
      issues: listIssues(true)
    });
  });

  router.get("/issues/new", (_req, res) => {
    res.render("admin/issue-form", {
      meta: { title: "Новый выпуск", description: "Создание карточки выпуска" },
      issue: null,
      materials: getIssueFormMaterials()
    });
  });

  router.get("/issues/:id/edit", (req, res) => {
    const issue = getIssueById(Number(req.params.id));
    if (!issue) {
      res.redirect("/admin/issues");
      return;
    }
    res.render("admin/issue-form", {
      meta: { title: `Редактирование: ${issue.numberLabel}`, description: "Редактирование выпуска" },
      issue,
      materials: getIssueFormMaterials(issue)
    });
  });

  router.post("/issues", coverUpload.single("coverImage"), verifyCsrfToken, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const uploadedCover = req.file ? `/uploads/covers/${req.file.filename}` : body.existingCover;
    const materials = parseIssueMaterials(body.materials);
    const firstMaterial = materials.find((material) => material.title.trim())?.title ?? "vypusk";
    const numberLabel = typeof body.numberLabel === "string" ? body.numberLabel : "";
    const slugSource = `${numberLabel}-${firstMaterial}`;
    const slug = typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim()
      : slugify(slugSource, { lower: true, strict: true, locale: "ru" });

    saveIssue({
      id: typeof body.id === "string" && body.id ? Number(body.id) : undefined,
      numberLabel,
      publishDate: typeof body.publishDate === "string" ? body.publishDate : "",
      slug,
      materials,
      coverImage: typeof uploadedCover === "string" ? uploadedCover : "",
      isPublished: body.isPublished ? 1 : 0,
      isFeatured: body.isFeatured ? 1 : 0
    });

    req.session.flash = { type: "success", message: body.id ? "Выпуск обновлен." : "Выпуск создан." };
    res.redirect("/admin/issues");
  });

  router.post("/issues/:id/delete", verifyCsrfToken, (req, res) => {
    deleteIssue(Number(req.params.id));
    req.session.flash = { type: "success", message: "Выпуск удален." };
    res.redirect("/admin/issues");
  });

  router.get("/lists", (_req, res) => {
    res.render("admin/lists", {
      meta: { title: "Перечни опубликованного", description: "Импорт и публикация Excel-файлов" },
      items: listPublishedLists(false)
    });
  });

  router.post("/lists", listUpload.single("listFile"), verifyCsrfToken, (req, res) => {
    if (!req.file) {
      req.session.flash = { type: "error", message: "Выберите Excel-файл для импорта." };
      res.redirect("/admin/lists");
      return;
    }

    createPublishedList(
      req.body.title ?? "Перечень опубликованного",
      req.body.periodLabel ?? "Без периода",
      path.join(req.file.destination, req.file.filename)
    );

    req.session.flash = { type: "success", message: "Excel-файл импортирован." };
    res.redirect("/admin/lists");
  });

  router.post("/lists/:id/toggle", verifyCsrfToken, (req, res) => {
    togglePublishedList(Number(req.params.id), Number(req.body.isVisible ?? 0));
    req.session.flash = { type: "success", message: "Статус перечня обновлен." };
    res.redirect("/admin/lists");
  });

  router.post("/lists/:id/delete", verifyCsrfToken, (req, res) => {
    deletePublishedList(Number(req.params.id));
    req.session.flash = { type: "success", message: "Перечень удален." };
    res.redirect("/admin/lists");
  });

  router.get("/messages", (_req, res) => {
    res.render("admin/messages", {
      meta: { title: "Сообщения", description: "Обращения из формы обратной связи" },
      messages: listMessages()
    });
  });

  router.post("/messages/:id/read", verifyCsrfToken, (req, res) => {
    markMessageRead(Number(req.params.id));
    req.session.flash = { type: "success", message: "Сообщение отмечено как прочитанное." };
    res.redirect("/admin/messages");
  });

  return router;
}
