import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { env } from "./config/env";
import type { DataStore, PageContent } from "./types";

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
  ["periodicity", "Ежеквартально"],
  ["publisher", "ООО \"Издательский дом строительной аналитики\""],
  ["editorialInfo", "Редакция готовит практические материалы для специалистов, принимающих финансовые, правовые и управленческие решения в строительстве Беларуси."],
  ["distributionFormat", "Печатный и электронный формат по подписке и корпоративным поставкам."],
  ["hotlineTitle", "Горячая линия по подписке"],
  ["hotlineText", "Уточняйте порядок оплаты, реквизиты и сроки получения свежего номера у редакции."],
  ["paymentTitle", "Оплата и получение счета"],
  ["paymentText", "Скачайте актуальный счет-фактуру в PDF, оплатите удобным для организации способом и свяжитесь с редакцией для подтверждения поступления платежа."],
  ["invoiceFile", ""],
  ["phone", "+375 (17) 000-00-00"],
  ["email", "info@smag.example"],
  ["address", "220000, Минск, ул. Примерная, д. 10"],
  ["requisites", "УНП 100000000, р/с BY00UNBS30120000000000000000, ОАО \"Банк Пример\", БИК UNBSBY2X"],
  ["workingHours", "Пн-Пт, 09:00-18:00"],
  ["contactPerson", "Редакция журнала"],
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

function createInitialStore(): DataStore {
  const timestamp = new Date().toISOString();
  const issues = [
    {
      id: 1,
      numberLabel: "№ 2 (2026)",
      publishDate: "2026-04-20",
      slug: slugify("№ 2 (2026)-Экономика и правовые риски строительных проектов", { lower: true, strict: true, locale: "ru" }),
      title: "Экономика и правовые риски строительных проектов",
      teaser: "Изменения в подрядных договорах, учет капитальных затрат и практика разрешения споров в строительстве Беларуси.",
      summary: "В выпуск включены материалы по договорной работе, сметной дисциплине, налоговым последствиям инвестиционно-строительных проектов в Республике Беларусь и внутреннему контролю.",
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
      title: "Учет и налогообложение в строительных организациях Беларуси",
      teaser: "Практические кейсы по себестоимости, авансам, резервам и управленческому контролю в строительной компании Республики Беларусь.",
      summary: "Материалы номера посвящены формированию финансового результата, налоговому планированию и правовому обеспечению строительной деятельности в Беларуси.",
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
  return {
    admins: store.admins.length ? store.admins : initial.admins,
    settings: { ...initial.settings, ...store.settings },
    pages: initial.pages.map((page) => store.pages.find((item) => item.pageKey === page.pageKey) ?? page),
    issues: store.issues.length ? store.issues : initial.issues,
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
