import path from "node:path";
import fs from "node:fs";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import slugify from "slugify";import type { IssueMaterial, PageKey } from "../types";
import {
  createPublishedList,
  deleteIssue,
  deletePublishedList,
  getAllPages,
  formatAudienceHtml,
  formatRichHtml,
  getAudienceTopics,
  getIssueFormMaterials,
  getIssueById,
  getSettings,
  listIssues,
  listMessages,
  listPublishedLists,
  markMessageRead,
  parseJournalNumber,
  saveIssue,
  serializeAudienceTopics,
  sanitizeRichHtml,
  applyPublishedListImport,
  normalizeMaterialKey,
  togglePublishedList,
  updatePageContent,
  updatePageExtra,
  updateSettings,
  verifyAdmin
} from "../services/contentService";
import { requireAuth, requireFullAdmin } from "../middleware/auth";
import { verifyCsrfToken } from "../middleware/csrf";
import { coverUpload, invoiceUpload, listUpload, pdfListUpload } from "../middleware/uploads";
import { writeAuditLog } from "../utils/auditLog";
import { validateUploadedFile } from "../utils/fileValidation";
import { processCoverImage } from "../utils/imageProcessing";
import { deleteImportPreview, readImportPreview, saveImportPreview } from "../utils/importPreviewStore";
import { parsePublishedListPdfInWorker } from "../utils/pdfParseJob";
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
  router.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    next();
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Слишком много попыток входа. Попробуйте позже."
  });
  router.get("/login", (req, res) => {
    if (req.session.adminId && req.session.adminLogin) {
      res.redirect(req.session.adminRole === "admin" ? "/admin" : "/admin/issues");
      return;
    }

    req.session.adminId = undefined;
    req.session.adminLogin = undefined;
    req.session.adminRole = undefined;

    res.render("admin/login", {
      meta: { title: "Вход", description: "Авторизация в админ-панели" }
    });
  });

  router.post("/login", loginLimiter, verifyCsrfToken, (req, res) => {
    const { login, password } = req.body as Record<string, string>;
    const admin = verifyAdmin(String(login ?? "").trim(), String(password ?? ""));

    if (!admin) {
      req.session.flash = { type: "error", message: "Неверный логин или пароль." };
      res.redirect("/admin/login");
      return;
    }

    req.session.regenerate((error) => {
      if (error) {
        req.session.flash = { type: "error", message: "Не удалось создать сессию. Попробуйте снова." };
        res.redirect("/admin/login");
        return;
      }

      req.session.adminId = admin.id;
      req.session.adminLogin = admin.login;
      req.session.adminRole = admin.role;
      res.redirect(admin.role === "admin" ? "/admin" : "/admin/issues");
    });
  });

  const logout = (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.redirect("/admin/login");
    });
  };

  router.get("/logout", requireAuth, logout);
  router.post("/logout", requireAuth, verifyCsrfToken, logout);

  router.use(requireAuth);

  router.get("/pages/subscribe", (req, res) => {
    const page = getAllPages().find((item) => item.pageKey === "subscribe");
    if (!page) {
      res.redirect("/admin/issues");
      return;
    }

    res.render("admin/page-form", {
      meta: { title: "Счета подписки", description: "PDF-счета для страницы подписки" },
      page,
      formatRichHtml,
      invoicesOnly: req.session.adminRole !== "admin"
    });
  });

  router.post("/pages/subscribe/invoice1", invoiceUpload.single("invoiceFile1"), verifyCsrfToken, async (req, res) => {
    if (req.file) {
      const valid = await validateUploadedFile(req.file.path, "invoice");
      if (!valid) {
        fs.unlinkSync(req.file.path);
        req.session.flash = { type: "error", message: "Недопустимый формат файла счёта." };
        res.redirect("/admin/pages/subscribe");
        return;
      }
    }
    const uploaded = req.file ? `/uploads/invoices/${req.file.filename}` : getAllPages().find((page) => page.pageKey === "subscribe")?.extras?.invoiceFile1 || "";
    const label = req.body.invoiceLabel1 || "Скачать счет 1";
    updatePageExtra("subscribe", "invoiceFile1", uploaded);
    updatePageExtra("subscribe", "invoiceLabel1", label);
    writeAuditLog({ adminLogin: req.session.adminLogin ?? "unknown", action: "upload_invoice", details: "invoice1" });
    req.session.flash = { type: "success", message: "Счет 1 обновлен." };
    res.redirect("/admin/pages/subscribe");
  });

  router.post("/pages/subscribe/invoice2", invoiceUpload.single("invoiceFile2"), verifyCsrfToken, async (req, res) => {
    if (req.file) {
      const valid = await validateUploadedFile(req.file.path, "invoice");
      if (!valid) {
        fs.unlinkSync(req.file.path);
        req.session.flash = { type: "error", message: "Недопустимый формат файла счёта." };
        res.redirect("/admin/pages/subscribe");
        return;
      }
    }
    const uploaded = req.file ? `/uploads/invoices/${req.file.filename}` : getAllPages().find((page) => page.pageKey === "subscribe")?.extras?.invoiceFile2 || "";
    const label = req.body.invoiceLabel2 || "Скачать счет 2";
    updatePageExtra("subscribe", "invoiceFile2", uploaded);
    updatePageExtra("subscribe", "invoiceLabel2", label);
    writeAuditLog({ adminLogin: req.session.adminLogin ?? "unknown", action: "upload_invoice", details: "invoice2" });
    req.session.flash = { type: "success", message: "Счет 2 обновлен." };
    res.redirect("/admin/pages/subscribe");
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

  router.get("/issues/import-list", (_req, res) => {
    res.render("admin/issue-import", {
      meta: { title: "Импорт перечня", description: "Загрузка PDF перечня опубликованного" },
      preview: null
    });
  });

  router.post("/issues/import-list", pdfListUpload.single("listPdf"), verifyCsrfToken, async (req, res) => {
    if (!req.file) {
      req.session.flash = { type: "error", message: "Выберите PDF-файл перечня." };
      res.redirect("/admin/issues/import-list");
      return;
    }

    const valid = await validateUploadedFile(req.file.path, "pdfList");
    if (!valid) {
      fs.unlinkSync(req.file.path);
      req.session.flash = { type: "error", message: "Недопустимый формат PDF-файла." };
      res.redirect("/admin/issues/import-list");
      return;
    }

    try {
      const parsed = await parsePublishedListPdfInWorker(req.file.path);
      if (!parsed.entries.length) {
        req.session.flash = { type: "error", message: "В PDF не удалось найти статьи. Проверьте макет перечня." };
        res.redirect("/admin/issues/import-list");
        return;
      }

      if (req.session.importPreviewId) {
        deleteImportPreview(req.session.importPreviewId);
      }

      req.session.importPreviewId = saveImportPreview({
        year: parsed.year,
        sourceName: req.file.originalname,
        entries: parsed.entries,
        warnings: parsed.warnings
      });
      res.redirect("/admin/issues/import-list/preview");
    } catch (error) {
      console.error("Published list PDF parse failed:", error);
      req.session.flash = { type: "error", message: "Не удалось прочитать PDF. Попробуйте другой файл." };
      res.redirect("/admin/issues/import-list");
    }
  });

  router.get("/issues/import-list/preview", (req, res) => {
    const listImport = req.session.importPreviewId ? readImportPreview(req.session.importPreviewId) : null;
    if (!listImport) {
      req.session.flash = { type: "error", message: "Сначала загрузите PDF перечня." };
      res.redirect("/admin/issues/import-list");
      return;
    }

    const groups = new Map<number, typeof listImport.entries>();
    for (const entry of listImport.entries) {
      const bucket = groups.get(entry.issueNumber) ?? [];
      bucket.push(entry);
      groups.set(entry.issueNumber, bucket);
    }

    const allIssues = listIssues(true);
    const previewGroups = [...groups.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([issueNumber, entries]) => {
        const existing = allIssues.find((issue) => parseJournalNumber(issue.numberLabel) === issueNumber);
        const knownKeys = new Set(
          (existing?.materials ?? [])
            .map((material) => normalizeMaterialKey(material.title))
            .filter(Boolean)
        );
        const marked = entries.map((entry) => {
          const key = normalizeMaterialKey(entry.title);
          const isDuplicate = Boolean(key && knownKeys.has(key));
          if (key && !isDuplicate) {
            knownKeys.add(key);
          }
          return { ...entry, isDuplicate };
        });
        const newCount = marked.filter((entry) => !entry.isDuplicate).length;
        const skipCount = marked.filter((entry) => entry.isDuplicate).length;

        return {
          issueNumber,
          numberLabel: existing?.numberLabel || `№ ${issueNumber} (${listImport.year})`,
          existingId: existing?.id ?? null,
          willCreate: !existing,
          newCount,
          skipCount,
          existingCount: existing?.materials.filter((material) => material.title.trim()).length ?? 0,
          entries: marked
        };
      });

    res.render("admin/issue-import", {
      meta: { title: "Предпросмотр импорта", description: "Проверка распознанных материалов" },
      preview: {
        year: listImport.year,
        sourceName: listImport.sourceName,
        warnings: listImport.warnings,
        total: listImport.entries.length,
        groups: previewGroups
      }
    });
  });

  router.post("/issues/import-list/apply", verifyCsrfToken, (req, res) => {
    const listImport = req.session.importPreviewId ? readImportPreview(req.session.importPreviewId) : null;
    if (!listImport) {
      req.session.flash = { type: "error", message: "Нет данных импорта. Загрузите PDF ещё раз." };
      res.redirect("/admin/issues/import-list");
      return;
    }

    const result = applyPublishedListImport(listImport.year, listImport.entries);
    if (req.session.importPreviewId) {
      deleteImportPreview(req.session.importPreviewId);
      delete req.session.importPreviewId;
    }
    writeAuditLog({
      adminLogin: req.session.adminLogin ?? "unknown",
      action: "import_published_list",
      details: `${listImport.sourceName}: added ${result.added}`
    });
    req.session.flash = {
      type: "success",
      message: `Импорт завершён: добавлено материалов ${result.added}, пропущено копий ${result.skipped}, обновлено выпусков ${result.updated}, создано черновиков ${result.created}.`
    };
    res.redirect("/admin/issues");
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

  router.post("/issues", coverUpload.single("coverImage"), verifyCsrfToken, async (req, res) => {
    const body = req.body as Record<string, unknown>;
    let uploadedCover = typeof body.existingCover === "string" ? body.existingCover : "";

    if (req.file) {
      const valid = await validateUploadedFile(req.file.path, "cover");
      if (!valid) {
        fs.unlinkSync(req.file.path);
        req.session.flash = { type: "error", message: "Недопустимый формат изображения обложки." };
        res.redirect(body.id ? `/admin/issues/${body.id}/edit` : "/admin/issues/new");
        return;
      }

      try {
        const processed = await processCoverImage(req.file.path, req.file.filename);
        uploadedCover = processed.publicPath;
      } catch (error) {
        console.error("Cover processing failed:", error);
        req.session.flash = { type: "error", message: "Не удалось обработать обложку." };
        res.redirect(body.id ? `/admin/issues/${body.id}/edit` : "/admin/issues/new");
        return;
      }
    }
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
      coverImage: uploadedCover,
      isPublished: body.isPublished ? 1 : 0,
      isFeatured: body.isFeatured ? 1 : 0
    });

    writeAuditLog({
      adminLogin: req.session.adminLogin ?? "unknown",
      action: body.id ? "update_issue" : "create_issue",
      details: numberLabel
    });

    req.session.flash = { type: "success", message: body.id ? "Выпуск обновлен." : "Выпуск создан." };
    res.redirect("/admin/issues");
  });

  router.use(requireFullAdmin);

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
      aboutAudienceHtml: formatAudienceHtml(settings.aboutAudience),
      formatRichHtml
    });
  });

  router.post("/settings", verifyCsrfToken, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const rich = (key: string) => sanitizeRichHtml(String(body[key] ?? ""));
    updateSettings({
      siteTitle: String(body.siteTitle ?? ""),
      siteDescription: rich("siteDescription"),
      aboutAudience: rich("aboutAudience"),
      aboutAudienceTopics: serializeAudienceTopics(body.audienceTopics),
      publisher: rich("publisher"),
      hotlineText: rich("hotlineText"),
      phone: String(body.phone ?? ""),
      phone2: String(body.phone2 ?? ""),
      email: String(body.email ?? ""),
      address: String(body.address ?? ""),
      requisites: rich("requisites"),
      siteUrl: String(body.siteUrl ?? ""),
      mailTo: String(body.mailTo ?? "")
    });
    writeAuditLog({ adminLogin: req.session.adminLogin ?? "unknown", action: "update_settings" });
    req.session.flash = { type: "success", message: "Настройки сохранены." };
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
      page,
      formatRichHtml,
      invoicesOnly: false
    });
  });

  router.post("/pages/:pageKey", verifyCsrfToken, (req, res) => {
    const pageKey = req.params.pageKey as PageKey;
    const body = req.body as Record<string, string>;
    const rich = (key: string) => sanitizeRichHtml(body[key] ?? "");

    if (pageKey === "home") {
      updatePageContent(pageKey, "Главная", "", "", {
        heroTitle: rich("heroTitle"),
        heroText: rich("heroText"),
        seoTitle: body.seoTitle ?? "",
        seoDescription: rich("seoDescription")
      });
    } else if (pageKey === "about") {
      updatePageContent(pageKey, body.title ?? "", rich("lead"), rich("body"), {
        periodicity: body.periodicity ?? "",
        distributionFormat: rich("distributionFormat"),
        seoTitle: body.seoTitle ?? "",
        seoDescription: rich("seoDescription")
      });
    } else if (pageKey === "contacts") {
      updatePageContent(pageKey, body.title ?? "", rich("lead"), "", {
        workingHours: body.workingHours ?? "",
        seoTitle: body.seoTitle ?? "",
        seoDescription: rich("seoDescription")
      });
    } else if (pageKey === "subscribe") {
      updatePageContent(pageKey, body.title ?? "", rich("lead"), rich("body"), {
        channelsLabel: body.channelsLabel ?? "",
        directTitle: body.directTitle ?? "",
        step1Text: body.step1Text ?? "",
        step2Text: body.step2Text ?? "",
        paymentNoteLabel: body.paymentNoteLabel ?? "",
        paymentNoteText: body.paymentNoteText ?? "",
        belpochtaTitle: body.belpochtaTitle ?? "",
        belpochtaIntro: body.belpochtaIntro ?? "",
        index1Label: body.index1Label ?? "",
        index1Value: body.index1Value ?? "",
        index2Label: body.index2Label ?? "",
        index2Value: body.index2Value ?? "",
        requisitesTitle: body.requisitesTitle ?? "",
        hotlineTitle: body.hotlineTitle ?? "",
        hotlineExpert: body.hotlineExpert ?? "",
        hotlineSchedule: body.hotlineSchedule ?? "",
        hotlineNote: body.hotlineNote ?? "",
        helpTitle: body.helpTitle ?? "",
        seoTitle: body.seoTitle ?? "",
        seoDescription: rich("seoDescription")
      });
    } else {
      updatePageContent(pageKey, body.title ?? "", rich("lead"), rich("body"));
    }

    req.session.flash = { type: "success", message: "Страница обновлена." };
    writeAuditLog({ adminLogin: req.session.adminLogin ?? "unknown", action: "update_page", details: pageKey });
    res.redirect(`/admin/pages/${pageKey}`);
  });

  router.post("/issues/:id/delete", verifyCsrfToken, (req, res) => {
    deleteIssue(Number(req.params.id));
    writeAuditLog({
      adminLogin: req.session.adminLogin ?? "unknown",
      action: "delete_issue",
      details: String(req.params.id)
    });
    req.session.flash = { type: "success", message: "Выпуск удален." };
    res.redirect("/admin/issues");
  });

  router.get("/lists", (_req, res) => {
    res.render("admin/lists", {
      meta: { title: "Перечни опубликованного", description: "Импорт и публикация Excel-файлов" },
      items: listPublishedLists(false)
    });
  });

  router.post("/lists", listUpload.single("listFile"), verifyCsrfToken, async (req, res) => {
    if (!req.file) {
      req.session.flash = { type: "error", message: "Выберите Excel-файл для импорта." };
      res.redirect("/admin/lists");
      return;
    }

    const valid = await validateUploadedFile(req.file.path, "list");
    if (!valid) {
      fs.unlinkSync(req.file.path);
      req.session.flash = { type: "error", message: "Недопустимый формат Excel-файла." };
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

  return router;
}
