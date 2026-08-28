import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { env } from "./config/env";
import type { AdminRecord, AdminRole, DataStore, IssueMaterial, JournalIssue, PageContent } from "./types";

fs.mkdirSync(path.dirname(env.contentFile), { recursive: true });
fs.mkdirSync(env.uploadsDir, { recursive: true });
fs.mkdirSync(env.coversDir, { recursive: true });
fs.mkdirSync(env.invoicesDir, { recursive: true });
fs.mkdirSync(env.listsDir, { recursive: true });

const settingDefaults: Array<[string, string]> = [
  ["siteTitle", "Строительство: Экономика, учет, право"],
  ["siteDescription", "Профессиональный журнал для бухгалтеров, экономистов, инженерно-технических и юридических служб строительных организаций Беларуси."],
  ["aboutAudience", "<p>Только для действующих подписчиков работает горячая линия журнала.</p><p>Задайте свой вопрос нашему эксперту и получите персональную консультацию.</p><p>Каждый вторник с 14:00 до 16:00.</p>"],
  [
    "aboutAudienceTopics",
    JSON.stringify([
      "Экономика строительства в Беларуси и финансирование проектов",
      "Бухгалтерский учет, налогообложение и договорная работа",
      "Правовое сопровождение строительной деятельности в Республике Беларусь"
    ])
  ],
  ["publisher", "ООО «Профессиональный диалог», УНП 193589657"],
  ["hotlineText", "Получите оперативный и квалифицированный ответ от нашего эксперта по вашему конкретному вопросу. Каждый вторник с 14:00 до 16:00. Телефон: +375 29 104 40 08. Эксперт: Коковкина Татьяна Валерьевна"],
  ["phone", "+375 (17) 000-00-00"],
  ["phone2", ""],
  ["email", "prof.dialogi@yandex.by"],
  ["address", "220000, Минск, ул. Примерная, д. 10"],
  ["requisites", "ООО «Профессиональный диалог»\n\nУНП 193589657, ОКПО 505378575000\nР/с BY11SLAN30125250900000100000 в ЗАО Банк ВТБ (Беларусь), БИК SLANBY22, г. Минск, пр-т Дзержинского, 119"],
  ["siteUrl", env.siteUrl],
  ["analyticsId", env.analyticsId],
  ["mailTo", "prof.dialogi@yandex.by"]
];

const pageDefaults = [
  {
    id: 1,
    pageKey: "home",
    title: "Главная",
    lead: "",
    body: "",
    extras: {
      heroTitle: "Профессиональная аналитика для строительной отрасли",
      heroText: "Журнал освещает экономику строительства в Беларуси, отраслевой учет, договорную практику, изменения законодательства Республики Беларусь и управленческие решения для строительных компаний.",
      seoTitle: "Журнал Строительство: Экономика, учет, право",
      seoDescription: "Официальный сайт журнала для строительной отрасли Беларуси: описание, выпуски, перечни опубликованного, контакты и счет-фактура для оплаты."
    }
  },
  {
    id: 2,
    pageKey: "about",
    title: "О журнале",
    lead: "Отраслевое издание для специалистов, работающих с экономикой, учетом и правом в строительстве Беларуси.",
    body: "Журнал помогает отслеживать изменения в регулировании Республики Беларусь, учитывать отраслевую специфику и принимать обоснованные управленческие решения.",
    extras: {
      periodicity: "Ежеквартально",
      distributionFormat: "Журнал распространяется в печатной форме по подписке: напрямую через редакцию и через РУП «Белпочта»."
    }
  },
  {
    id: 3,
    pageKey: "contacts",
    title: "Контакты",
    lead: "Свяжитесь с редакцией по вопросам подписки, размещения информации и оплаты.",
    body: "",
    extras: {
      workingHours: "Пн-Пт, 09:00-18:00"
    }
  },
  {
    id: 4,
    pageKey: "subscribe",
    title: "Оформление подписки",
    lead: "Оформите подписку на печатную версию журнала «Строительство: экономика, учёт, право».",
    body: "После оплаты направьте подтверждение на электронную почту редакции или уточните статус по телефону горячей линии.",
    extras: {
      invoiceFile1: "",
      invoiceLabel1: "Скачать счет 1",
      invoiceFile2: "",
      invoiceLabel2: "Скачать счет 2"
    }
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
        login: "admin",
        passwordHash: bcrypt.hashSync("admin", 10),
        role: "admin",
        createdAt: timestamp
      },
      {
        id: 2,
        login: "user",
        passwordHash: bcrypt.hashSync("user", 10),
        role: "user",
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
    publishedMaterials: [],
    contactMessages: []
  };
}

function migratePaymentToSubscribe(store: DataStore): void {
  const paymentPage = store.pages.find((page) => page.pageKey === ("payment" as PageContent["pageKey"]));
  const subscribePage = store.pages.find((page) => page.pageKey === "subscribe");
  if (!paymentPage || !subscribePage) {
    return;
  }

  if (!subscribePage.body?.trim() && paymentPage.body?.trim()) {
    subscribePage.body = paymentPage.body;
  }
}

function migratePageExtras(store: DataStore): void {
  migratePaymentToSubscribe(store);

  const settings = store.settings;
  const legacyValues: Partial<Record<PageContent["pageKey"], Record<string, string>>> = {
    home: {
      heroTitle: settings.heroTitle ?? "",
      heroText: settings.heroText ?? "",
      seoTitle: settings.seoHomeTitle ?? "",
      seoDescription: settings.seoHomeDescription ?? ""
    },
    about: {
      periodicity: settings.periodicity ?? "",
      distributionFormat: settings.distributionFormat ?? ""
    },
    contacts: {
      workingHours: settings.workingHours ?? ""
    },
    subscribe: {
      invoiceFile1: settings.invoiceFile1 ?? "",
      invoiceLabel1: settings.invoiceLabel1 ?? "Скачать счет 1",
      invoiceFile2: settings.invoiceFile2 ?? "",
      invoiceLabel2: settings.invoiceLabel2 ?? "Скачать счет 2"
    }
  };

  for (const page of store.pages) {
    page.extras = page.extras ?? {};
    const defaults = legacyValues[page.pageKey];
    if (!defaults) {
      continue;
    }

    for (const [key, value] of Object.entries(defaults)) {
      if (!page.extras[key]?.trim() && value.trim()) {
        page.extras[key] = value;
      }
    }
  }

  const knownKeys = new Set(pageDefaults.map((page) => page.pageKey));
  for (const template of pageDefaults) {
    if (!store.pages.some((page) => page.pageKey === template.pageKey)) {
      store.pages.push({ ...template, extras: { ...template.extras } });
      continue;
    }

    const page = store.pages.find((item) => item.pageKey === template.pageKey);
    if (!page) {
      continue;
    }

    page.extras = page.extras ?? {};
    for (const [key, value] of Object.entries(template.extras ?? {})) {
      if (!page.extras[key]?.trim() && value.trim()) {
        page.extras[key] = value;
      }
    }
  }

  store.pages = store.pages.filter((page) => knownKeys.has(page.pageKey));
}

function normalizeAdmins(store: DataStore): AdminRecord[] {
  const timestamp = new Date().toISOString();
  const admins = store.admins.map((admin) => ({
    ...admin,
    role: (admin.role ?? "admin") as AdminRole
  }));

  const ensureCredentials = (record: AdminRecord, password: string, role: AdminRole) => {
    record.role = role;
    if (!bcrypt.compareSync(password, record.passwordHash)) {
      record.passwordHash = bcrypt.hashSync(password, 10);
    }
  };

  const upsert = (login: string, password: string, role: AdminRole, preferredId: number) => {
    let record = admins.find((admin) => admin.login === login);
    if (!record) {
      record = {
        id: preferredId,
        login,
        passwordHash: bcrypt.hashSync(password, 10),
        role,
        createdAt: timestamp
      };
      admins.push(record);
      return;
    }

    ensureCredentials(record, password, role);
  };

  upsert("admin", "admin", "admin", 1);
  upsert("user", "user", "user", 2);

  return admins.sort((left, right) => left.id - right.id);
}

function mergeDefaults(store: DataStore): DataStore {
  const initial = createInitialStore();
  const issues = (store.issues.length ? store.issues : initial.issues).map((issue) => normalizeIssue(issue as unknown as Record<string, unknown>));
  const mergedPages = initial.pages.map((page) => {
    const existing = store.pages.find((item) => item.pageKey === page.pageKey);
    if (!existing) {
      return { ...page, extras: { ...page.extras } };
    }

    return {
      ...page,
      ...existing,
      extras: { ...page.extras, ...existing.extras }
    };
  });

  const merged: DataStore = {
    admins: normalizeAdmins(store.admins.length ? store : createInitialStore()),
    settings: { ...initial.settings, ...store.settings },
    pages: mergedPages,
    issues,
    publishedLists: store.publishedLists.length ? store.publishedLists : initial.publishedLists,
    publishedMaterials: store.publishedMaterials ?? [],
    contactMessages: store.contactMessages ?? []
  };

  migratePageExtras(merged);
  return merged;
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
