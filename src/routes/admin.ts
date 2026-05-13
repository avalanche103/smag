import path from "node:path";
import { Router } from "express";
import slugify from "slugify";
import type { PageKey } from "../types";
import {
  createPublishedList,
  deleteIssue,
  deletePublishedList,
  getAllPages,
  getIssueById,
  getSettings,
  listIssues,
  listMessages,
  listPublishedLists,
  markMessageRead,
  saveIssue,
  togglePublishedList,
  updatePageContent,
  updateSettings
} from "../services/contentService";
import { requireAdmin } from "../middleware/auth";
import { verifyCsrfToken } from "../middleware/csrf";
import { coverUpload, invoiceUpload, listUpload } from "../middleware/uploads";

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
    res.render("admin/settings", {
      meta: { title: "Настройки сайта", description: "Основные настройки и контакты" },
      settings: getSettings()
    });
  });

  router.post("/settings", verifyCsrfToken, (req, res) => {
    const body = req.body as Record<string, string>;
    updateSettings({
      siteTitle: body.siteTitle ?? "",
      siteDescription: body.siteDescription ?? "",
      heroTitle: body.heroTitle ?? "",
      heroText: body.heroText ?? "",
      aboutAudience: body.aboutAudience ?? "",
      periodicity: body.periodicity ?? "",
      publisher: body.publisher ?? "",
      editorialInfo: body.editorialInfo ?? "",
      distributionFormat: body.distributionFormat ?? "",
      hotlineTitle: body.hotlineTitle ?? "",
      hotlineText: body.hotlineText ?? "",
      paymentTitle: body.paymentTitle ?? "",
      paymentText: body.paymentText ?? "",
      phone: body.phone ?? "",
      email: body.email ?? "",
      address: body.address ?? "",
      requisites: body.requisites ?? "",
      workingHours: body.workingHours ?? "",
      contactPerson: body.contactPerson ?? "",
      seoHomeTitle: body.seoHomeTitle ?? "",
      seoHomeDescription: body.seoHomeDescription ?? "",
      siteUrl: body.siteUrl ?? "",
      analyticsId: body.analyticsId ?? "",
      mailTo: body.mailTo ?? ""
    });
    req.session.flash = { type: "success", message: "Настройки сохранены." };
    res.redirect("/admin/settings");
  });

  router.post("/invoice", invoiceUpload.single("invoiceFile"), verifyCsrfToken, (req, res) => {
    const uploaded = req.file ? `/uploads/invoices/${req.file.filename}` : "";
    if (!uploaded) {
      req.session.flash = { type: "error", message: "Выберите PDF-файл счета." };
      res.redirect("/admin/settings");
      return;
    }

    updateSettings({ invoiceFile: uploaded });
    req.session.flash = { type: "success", message: "Счет-фактура обновлен." };
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
      issue: null
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
      issue
    });
  });

  router.post("/issues", coverUpload.single("coverImage"), verifyCsrfToken, (req, res) => {
    const body = req.body as Record<string, string>;
    const uploadedCover = req.file ? `/uploads/covers/${req.file.filename}` : body.existingCover;
    const slug = body.slug?.trim() || slugify(`${body.numberLabel}-${body.title}`, { lower: true, strict: true, locale: "ru" });

    saveIssue({
      id: body.id ? Number(body.id) : undefined,
      numberLabel: body.numberLabel ?? "",
      publishDate: body.publishDate ?? "",
      slug,
      title: body.title ?? "",
      teaser: body.teaser ?? "",
      summary: body.summary ?? "",
      coverImage: uploadedCover ?? "",
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
