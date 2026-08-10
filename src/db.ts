import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { env } from "./config/env";
import type { DataStore, IssueMaterial, JournalIssue, PageContent } from "./types";

fs.mkdirSync(path.dirname(env.contentFile), { recursive: true });
fs.mkdirSync(env.uploadsDir, { recursive: true });
fs.mkdirSync(env.coversDir, { recursive: true });
fs.mkdirSync(env.invoicesDir, { recursive: true });
fs.mkdirSync(env.listsDir, { recursive: true });

const settingDefaults: Array<[string, string]> = [
  ["siteTitle", "Строительство: Экономика, учет, право"],
  ["siteDescription", "Профессиональный журнал для бухгалтеров, экономистов, инженерно-технических и юридических служб строительных организаций Беларуси."],
  ["heroTitle", "Профессиональная аналитика для строительной отрасли"],
  ["heroText", "Журнал освещает экономику строительства в Беларуси, отраслевой учет, договорную практику, изменения законодательства Республики Беларусь и управленческие решения для строительных компаний."],
  ["aboutAudience", "Бухгалтеры, экономисты, инженерно-технические работники, юристы и руководители строительных организаций Беларуси."],
  [
    "aboutAudienceTopics",
    JSON.stringify([
      "Экономика строительства в Беларуси и финансирование проектов",
      "Бухгалтерский учет, налогообложение и договорная работа",
      "Правовое сопровождение строительной деятельности в Республике Беларусь"
    ])
  ],
  ["periodicity", "Ежеквартально"],
  ["publisher", "ООО «Профессиональный диалог», УНП 193589657"],
  ["editorialInfo", "ООО «Профессиональный диалог», УНП 193589657\n+ 375 44 771 71 02, + 375 29 104 40 08\nprof.dialogi@yandex.by"],
  ["distributionFormat", "Журнал распространяется в печатной форме по подписке: напрямую через редакцию и через РУП «Белпочта»."],
  ["hotlineTitle", "Горячая линия по подписке"],
  ["hotlineText", "Уточняйте порядок оплаты, реквизиты и сроки получения свежего номера у редакции."],
  ["paymentTitle", "Оплата и получение счета"],
  ["paymentText", "Скачайте актуальный счет-фактуру в PDF, оплатите удобным для организации способом и свяжитесь с редакцией для подтверждения поступления платежа."],
  ["invoiceFile1", ""],
  ["invoiceLabel1", "Скачать счет 1"],
  ["invoiceFile2", ""],
  ["invoiceLabel2", "Скачать счет 2"],
  ["phone", "+375 (17) 000-00-00"],
  ["phone2", ""],
  ["email", "info@smag.example"],
  ["address", "220000, Минск, ул. Примерная, д. 10"],
  ["requisites", "УНП 100000000, р/с BY00UNBS30120000000000000000, ОАО \"Банк Пример\", БИК UNBSBY2X"],
  ["workingHours", "Пн-Пт, 09:00-18:00"],
  ["seoHomeTitle", "Журнал Строительство: Экономика, учет, право"],
  ["seoHomeDescription", "Официальный сайт журнала для строительной отрасли Беларуси: описание, выпуски, перечни опубликованного, контакты и счет-фактура для оплаты."],
  ["siteUrl", env.siteUrl],
  ["analyticsId", env.analyticsId],
  ["mailTo", env.mailTo]
];

const pageDefaults = [
  {
    id: 1,
    pageKey: "home",
    title: "Главная",
    lead: "Официальный сайт профессионального журнала для строительной отрасли Беларуси.",
    body: "Журнал публикует анонсы выпусков, обложки, перечни опубликованного и актуальные сведения для подписчиков и организаций Республики Беларусь."
  },
  {
    id: 2,
    pageKey: "about",
    title: "О журнале",
    lead: "Отраслевое издание для специалистов, работающих с экономикой, учетом и правом в строительстве Беларуси.",
    body: "Журнал помогает отслеживать изменения в регулировании Республики Беларусь, учитывать отраслевую специфику и принимать обоснованные управленческие решения."
  },
  {
    id: 3,
    pageKey: "payment",
    title: "Счет и оплата",
    lead: "Скачайте счет-фактуру и свяжитесь с редакцией для уточнения деталей оплаты.",
    body: "После оплаты направьте подтверждение на электронную почту редакции или уточните статус по телефону горячей линии."
  },
  {
    id: 4,
    pageKey: "contacts",
    title: "Контакты",
    lead: "Свяжитесь с редакцией по вопросам подписки, размещения информации и оплаты.",
    body: "Форма обратной связи передает обращения в административную панель сайта."
  }
] as const satisfies PageContent[];

const MAX_PRIMARY_MATERIALS = 3;

function splitLegacyMaterialText(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-•–—]+/, "").trim())
    .filter(Boolean);
}

function normalizeIssueMaterials(materials: unknown, legacyValues: unknown[] = []): IssueMaterial[] {
  const source = Array.isArray(materials)
    ? materials
    : typeof materials === "object" && materials !== null
      ? Object.values(materials as Record<string, unknown>)
      : [];

  const parsed = source
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const title = typeof entry.title === "string" ? entry.title.trim() : "";
      if (!title) {
        return null;
      }

      return {
        title,
        isPrimary: entry.isPrimary ? 1 : 0,
        author: typeof entry.author === "string" && entry.author.trim() ? entry.author : "-",
        section: typeof entry.section === "string" && entry.section.trim() ? entry.section : "-"
      } satisfies IssueMaterial;
    })
    .filter((item): item is IssueMaterial => item !== null);

  const fallback = legacyValues
    .flatMap((value) => splitLegacyMaterialText(value))
    .filter((title, index, items) => items.indexOf(title) === index)
    .map((title, index) => ({
      title,
      isPrimary: index < MAX_PRIMARY_MATERIALS ? 1 : 0,
      author: "-",
      section: "-"
    } satisfies IssueMaterial));

  let primaryCount = 0;

  return (parsed.length ? parsed : fallback).map((item) => {
    const isPrimary = item.isPrimary === 1 && primaryCount < MAX_PRIMARY_MATERIALS ? 1 : 0;
    if (isPrimary) {
      primaryCount += 1;
    }

    return {
      title: item.title,
      isPrimary,
      author: item.author ?? "-",
      section: item.section ?? "-"
    };
  });
}

function normalizeIssue(issue: Record<string, unknown>): JournalIssue {
  return {
    id: Number(issue.id ?? 0),
    numberLabel: typeof issue.numberLabel === "string" ? issue.numberLabel : "",
    publishDate: typeof issue.publishDate === "string" ? issue.publishDate : "",
    slug: typeof issue.slug === "string" ? issue.slug : "",
    materials: normalizeIssueMaterials(issue.materials, [issue.title, issue.teaser, issue.summary]),
    coverImage: typeof issue.coverImage === "string" ? issue.coverImage : "",
    isPublished: issue.isPublished ? 1 : 0,
    isFeatured: issue.isFeatured ? 1 : 0,
    createdAt: typeof issue.createdAt === "string" ? issue.createdAt : new Date().toISOString()
  };
}

function createInitialStore(): DataStore {
  const timestamp = new Date().toISOString();
  const issues = [
    {
      id: 1,
      numberLabel: "№ 2 (2026)",
      publishDate: "2026-04-20",
      slug: slugify("№ 2 (2026)-Экономика и правовые риски строительных проектов", { lower: true, strict: true, locale: "ru" }),
      materials: [
        { title: "Экономика и правовые риски строительных проектов", isPrimary: 1, author: "-", section: "-" },
        { title: "Изменения в подрядных договорах", isPrimary: 1, author: "-", section: "-" },
        { title: "Учет капитальных затрат и практика разрешения споров в строительстве Беларуси", isPrimary: 1, author: "-", section: "-" },
        { title: "Сметная дисциплина и контроль инвестиционно-строительных проектов", isPrimary: 0, author: "-", section: "-" },
        { title: "Внутренний контроль в строительной организации", isPrimary: 0, author: "-", section: "-" }
      ],
      coverImage: "https://placehold.co/640x900/e5dfd1/23313e?text=%D0%96%D1%83%D1%80%D0%BD%D0%B0%D0%BB+2%2F2026",
      isPublished: 1,
      isFeatured: 1,
      createdAt: timestamp
    },
    {
      id: 2,
      numberLabel: "№ 1 (2026)",
      publishDate: "2026-02-15",
      slug: slugify("№ 1 (2026)-Учет и налогообложение в строительных организациях", { lower: true, strict: true, locale: "ru" }),
      materials: [
        { title: "Учет и налогообложение в строительных организациях Беларуси", isPrimary: 1, author: "-", section: "-" },
        { title: "Практические кейсы по себестоимости, авансам и резервам", isPrimary: 1, author: "-", section: "-" },
        { title: "Управленческий контроль в строительной компании Республики Беларусь", isPrimary: 1, author: "-", section: "-" },
        { title: "Формирование финансового результата и налоговое планирование", isPrimary: 0, author: "-", section: "-" },
        { title: "Правовое обеспечение строительной деятельности в Беларуси", isPrimary: 0, author: "-", section: "-" }
      ],
      coverImage: "https://placehold.co/640x900/dfe7ea/1f3847?text=%D0%96%D1%83%D1%80%D0%BD%D0%B0%D0%BB+1%2F2026",
      isPublished: 1,
      isFeatured: 0,
      createdAt: timestamp
    }
  ];

  return {
    admins: [
      {
        id: 1,
        login: env.adminLogin,
        passwordHash: bcrypt.hashSync(env.adminPassword, 10),
        createdAt: timestamp
      }
    ],
    settings: Object.fromEntries(settingDefaults),
    pages: [...pageDefaults],
    issues,
    publishedLists: [
      {
        id: 1,
        title: "Перечень опубликованного",
        periodLabel: "I квартал 2026",
        filePath: "",
        createdAt: timestamp,
        isVisible: 1
      }
    ],
    contactMessages: []
  };
}

function mergeDefaults(store: DataStore): DataStore {
  const initial = createInitialStore();
  const issues = (store.issues.length ? store.issues : initial.issues).map((issue) => normalizeIssue(issue as unknown as Record<string, unknown>));

  return {
    admins: store.admins.length ? store.admins : initial.admins,
    settings: { ...initial.settings, ...store.settings },
    pages: initial.pages.map((page) => store.pages.find((item) => item.pageKey === page.pageKey) ?? page),
    issues,
    publishedLists: store.publishedLists.length ? store.publishedLists : initial.publishedLists,
    contactMessages: store.contactMessages ?? []
  };
}

export function ensureDataFile(): void {
  if (!fs.existsSync(env.contentFile)) {
    if (fs.existsSync(env.seedContentFile)) {
      fs.copyFileSync(env.seedContentFile, env.contentFile);
    } else {
      fs.writeFileSync(env.contentFile, JSON.stringify(createInitialStore(), null, 2), "utf-8");
    }
    return;
  }

  const current = JSON.parse(fs.readFileSync(env.contentFile, "utf-8")) as DataStore;
  const merged = mergeDefaults(current);
  const normalized = JSON.stringify(merged);
  const currentSerialized = JSON.stringify(current);

  if (normalized !== currentSerialized) {
    fs.writeFileSync(env.contentFile, JSON.stringify(merged, null, 2), "utf-8");
  }
}

export function readStore(): DataStore {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(env.contentFile, "utf-8")) as DataStore;
}

export function writeStore(store: DataStore): void {
  fs.writeFileSync(env.contentFile, JSON.stringify(store, null, 2), "utf-8");
}

export function updateStore<T>(updater: (store: DataStore) => T): T {
  const store = readStore();
  const result = updater(store);
  writeStore(store);
  return result;
}

ensureDataFile();
