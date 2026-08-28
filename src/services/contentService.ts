import bcrypt from "bcryptjs";
import slugify from "slugify";
import { readStore, updateStore } from "../db";
import type { AdminRole, ContactMessage, IssueMaterial, JournalIssue, PageContent, PageKey, PublishedListItem, PublishedMaterial, PublishedMaterialRow } from "../types";
import type { PublishedListEntry } from "../utils/publishedListPdf";

export const DEFAULT_ISSUE_MATERIAL_COUNT = 10;
export const MAX_PRIMARY_ISSUE_MATERIALS = 3;

export function sanitizeIssueMaterials(materials: IssueMaterial[]): IssueMaterial[] {
  let primaryCount = 0;

  return materials
    .map((material) => {
      const title = material.title.trim();
      if (!title) {
        return null;
      }

      const isPrimary = material.isPrimary === 1 && primaryCount < MAX_PRIMARY_ISSUE_MATERIALS ? 1 : 0;
      if (isPrimary) {
        primaryCount += 1;
      }

      return {
        title,
        isPrimary,
        author: material.author?.trim() || "-",
        section: material.section?.trim() || "-"
      } satisfies IssueMaterial;
    })
    .filter((material): material is IssueMaterial => material !== null);
}

export function getPrimaryIssueMaterials(issue: JournalIssue): IssueMaterial[] {
  const primaryMaterials = issue.materials.filter((material) => material.isPrimary === 1);
  return (primaryMaterials.length ? primaryMaterials : issue.materials).slice(0, MAX_PRIMARY_ISSUE_MATERIALS);
}

export function getIssueFormMaterials(issue?: JournalIssue): IssueMaterial[] {
  const materials = [...(issue?.materials ?? [])].map((material) => ({ ...material }));

  while (materials.length < DEFAULT_ISSUE_MATERIAL_COUNT) {
    materials.push({ title: "", isPrimary: 0, author: "-", section: "-" });
  }

  return materials;
}

export const DEFAULT_AUDIENCE_TOPICS = [
  "Экономика строительства в Беларуси и финансирование проектов",
  "Бухгалтерский учет, налогообложение и договорная работа",
  "Правовое сопровождение строительной деятельности в Республике Беларусь"
];

export function parseAudienceTopics(value: unknown): string[] {
  if (typeof value !== "string") {
    return [...DEFAULT_AUDIENCE_TOPICS];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_AUDIENCE_TOPICS];
    }

    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } catch {
    return [...DEFAULT_AUDIENCE_TOPICS];
  }
}

export function serializeAudienceTopics(input: unknown): string {
  const entries = Array.isArray(input)
    ? input
    : typeof input === "object" && input !== null
      ? Object.values(input as Record<string, unknown>)
      : [];

  const topics = entries
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return JSON.stringify(topics);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeRichHtml(value: string): string {
  return value
    .replace(/<\/?o:p\b[^>]*>/gi, "")
    .replace(/<\/?span\b[^>]*>/gi, "")
    .replace(/\s(?:class|lang|align|dir|id)="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/<(p|div|br|ul|ol|li|b|strong|i|em|u)\b[^>]*>/gi, "<$1>")
    .replace(/&nbsp;/gi, " ")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, "<p></p>")
    .trim();
}

export function formatRichHtml(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeRichHtml(trimmed);
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

export function formatAudienceHtml(value: unknown): string {
  return formatRichHtml(value);
}

export function stripHtmlTags(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function getSettings(): Record<string, string> {
  return readStore().settings;
}

export function getAudienceTopics(settings?: Record<string, string>): string[] {
  const source = settings ?? getSettings();
  return parseAudienceTopics(source.aboutAudienceTopics);
}

export function updateSettings(entries: Record<string, string>): void {
  updateStore((store) => {
    store.settings = { ...store.settings, ...entries };
  });
}

const PAGE_EXTRA_SETTINGS_FALLBACK: Partial<Record<PageKey, Record<string, string>>> = {
  home: {
    heroTitle: "heroTitle",
    heroText: "heroText",
    seoTitle: "seoHomeTitle",
    seoDescription: "seoHomeDescription"
  },
  about: {
    periodicity: "periodicity",
    distributionFormat: "distributionFormat"
  },
  contacts: {
    workingHours: "workingHours"
  },
  subscribe: {
    invoiceFile1: "invoiceFile1",
    invoiceLabel1: "invoiceLabel1",
    invoiceFile2: "invoiceFile2",
    invoiceLabel2: "invoiceLabel2"
  }
};

export function getPageExtra(page: PageContent, key: string): string {
  const fromPage = page.extras?.[key]?.trim();
  if (fromPage) {
    return fromPage;
  }

  const fallbackKey = PAGE_EXTRA_SETTINGS_FALLBACK[page.pageKey]?.[key];
  if (!fallbackKey) {
    return "";
  }

  return getSettings()[fallbackKey]?.trim() ?? "";
}

export function getPageContent(pageKey: PageKey): PageContent {
  const page = readStore().pages.find((item) => item.pageKey === pageKey);
  if (!page) {
    throw new Error(`Page not found: ${pageKey}`);
  }
  return page;
}

export function getAllPages(): PageContent[] {
  return readStore().pages.sort((left, right) => left.id - right.id);
}

export function updatePageContent(
  pageKey: PageKey,
  title: string,
  lead: string,
  body: string,
  extras?: Record<string, string>
): void {
  updateStore((store) => {
    const page = store.pages.find((item) => item.pageKey === pageKey);
    if (!page) {
      throw new Error(`Page not found: ${pageKey}`);
    }
    page.title = title;
    page.lead = lead;
    page.body = body;
    if (extras) {
      page.extras = { ...(page.extras ?? {}), ...extras };
    }
  });
}

export function updatePageExtra(pageKey: PageKey, key: string, value: string): void {
  updateStore((store) => {
    const page = store.pages.find((item) => item.pageKey === pageKey);
    if (!page) {
      throw new Error(`Page not found: ${pageKey}`);
    }
    page.extras = { ...(page.extras ?? {}), [key]: value };
  });
}

export function getFeaturedIssue(): JournalIssue | undefined {
  return listIssues().sort((left, right) => {
    if (right.isFeatured !== left.isFeatured) {
      return right.isFeatured - left.isFeatured;
    }
    return right.publishDate.localeCompare(left.publishDate);
  })[0];
}

export function listIssues(includeHidden = false): JournalIssue[] {
  return readStore()
    .issues
    .filter((issue) => includeHidden || issue.isPublished === 1)
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate));
}

export function getIssueBySlug(slug: string): JournalIssue | undefined {
  return readStore().issues.find((issue) => issue.slug === slug && issue.isPublished === 1);
}

export function getAdjacentIssues(slug: string): {
  previous: JournalIssue | null;
  next: JournalIssue | null;
} {
  const issues = listIssues().sort((left, right) => {
    const leftNumber = parseJournalNumber(left.numberLabel) ?? 0;
    const rightNumber = parseJournalNumber(right.numberLabel) ?? 0;
    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return left.publishDate.localeCompare(right.publishDate);
  });

  const index = issues.findIndex((issue) => issue.slug === slug);
  if (index < 0) {
    return { previous: null, next: null };
  }

  return {
    previous: index > 0 ? issues[index - 1] : null,
    next: index < issues.length - 1 ? issues[index + 1] : null
  };
}

export function getIssueById(id: number): JournalIssue | undefined {
  return readStore().issues.find((issue) => issue.id === id);
}

export function saveIssue(issue: Omit<JournalIssue, "id" | "createdAt"> & { id?: number }): void {
  updateStore((store) => {
    const normalizedIssue = {
      ...issue,
      materials: sanitizeIssueMaterials(issue.materials)
    };

    if (issue.isFeatured) {
      for (const item of store.issues) {
        item.isFeatured = 0;
      }
    }

    if (issue.id) {
      const existing = store.issues.find((item) => item.id === issue.id);
      if (!existing) {
        throw new Error(`Issue not found: ${issue.id}`);
      }
      Object.assign(existing, normalizedIssue);
      return;
    }

    const nextId = Math.max(0, ...store.issues.map((item) => item.id)) + 1;
    store.issues.push({
      ...normalizedIssue,
      id: nextId,
      createdAt: new Date().toISOString()
    });
  });
}

export function deleteIssue(id: number): void {
  updateStore((store) => {
    store.issues = store.issues.filter((issue) => issue.id !== id);
  });
}

export function listPublishedLists(visibleOnly = true): PublishedListItem[] {
  return readStore()
    .publishedLists
    .filter((item) => !visibleOnly || item.isVisible === 1)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createPublishedList(title: string, periodLabel: string, filePath: string): void {
  updateStore((store) => {
    const nextId = Math.max(0, ...store.publishedLists.map((item) => item.id)) + 1;
    store.publishedLists.push({
      id: nextId,
      title,
      periodLabel,
      filePath,
      createdAt: new Date().toISOString(),
      isVisible: 1
    });
  });
}

export function togglePublishedList(id: number, isVisible: number): void {
  updateStore((store) => {
    const item = store.publishedLists.find((entry) => entry.id === id);
    if (item) {
      item.isVisible = isVisible;
    }
  });
}

export function deletePublishedList(id: number): void {
  updateStore((store) => {
    store.publishedLists = store.publishedLists.filter((item) => item.id !== id);
  });
}

export function saveMessage(name: string, email: string, phone: string, message: string): void {
  updateStore((store) => {
    const nextId = Math.max(0, ...store.contactMessages.map((item) => item.id)) + 1;
    store.contactMessages.push({
      id: nextId,
      name,
      email,
      phone,
      message,
      createdAt: new Date().toISOString(),
      isRead: 0
    });
  });
}

export function listMessages(): ContactMessage[] {
  return readStore().contactMessages.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function markMessageRead(id: number): void {
  updateStore((store) => {
    const message = store.contactMessages.find((item) => item.id === id);
    if (message) {
      message.isRead = 1;
    }
  });
}

export function parseJournalNumber(numberLabel: string): number | null {
  const match = numberLabel.match(/№\s*(\d+)/i) || numberLabel.match(/(\d+)/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return value >= 1 && value <= 12 ? value : null;
}

const ISSUE_MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
] as const;

export function parseIssueYear(numberLabel: string, publishDate?: string): number | null {
  const fromLabel = numberLabel.match(/\((\d{4})\)/);
  if (fromLabel) {
    return Number(fromLabel[1]);
  }

  if (publishDate) {
    const fromDate = publishDate.match(/^(\d{4})/);
    if (fromDate) {
      return Number(fromDate[1]);
    }
  }

  return null;
}

/** Месяц выпуска по номеру журнала: №1 → Январь, №2 → Февраль и т.д. */
export function formatIssuePeriod(issue: { numberLabel: string; publishDate?: string }): string {
  const monthNumber = parseJournalNumber(issue.numberLabel);
  const year = parseIssueYear(issue.numberLabel, issue.publishDate);

  if (!monthNumber || !year) {
    return issue.publishDate || issue.numberLabel;
  }

  return `${ISSUE_MONTHS_RU[monthNumber - 1]} ${year}`;
}

export function normalizeMaterialKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findIssueByJournalNumber(issueNumber: number): JournalIssue | undefined {
  return readStore().issues.find((issue) => parseJournalNumber(issue.numberLabel) === issueNumber);
}

function isImportableEntry(entry: PublishedListEntry): boolean {
  const title = entry.title.trim();
  return Boolean(title) && title !== entry.author.trim();
}

function normalizeArchiveAuthor(entry: PublishedListEntry): { title: string; author: string } {
  if (entry.author && entry.author.trim() && entry.author.trim() !== "-") {
    return { title: entry.title.trim(), author: entry.author.trim() };
  }

  const match = entry.title.match(/^(.*)\s*\(([^()]{2,120})\)\s*$/);
  if (match && /[А-ЯЁA-Z][а-яёa-z-]+\s+[А-ЯЁA-Z]\.?/.test(match[2])) {
    return { title: match[1].trim(), author: match[2].trim() };
  }

  return { title: entry.title.trim(), author: "-" };
}

function publishedMaterialKey(year: number, issueNumber: number, title: string): string {
  return `${year}:${issueNumber}:${normalizeMaterialKey(title)}`;
}

export function listPublishedMaterialsForPage(): PublishedMaterialRow[] {
  const store = readStore();
  const seen = new Set<string>();
  const rows: PublishedMaterialRow[] = [];

  for (const issue of store.issues.filter((item) => item.isPublished === 1)) {
    const year = parseIssueYear(issue.numberLabel, issue.publishDate) ?? 0;
    const issueNumber = parseJournalNumber(issue.numberLabel) ?? 0;

    for (const material of issue.materials) {
      const title = material.title?.trim();
      if (!title) {
        continue;
      }

      const key = publishedMaterialKey(year, issueNumber, title);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      rows.push({
        numberLabel: issue.numberLabel,
        slug: issue.slug,
        section: material.section?.trim() || "-",
        title,
        author: material.author?.trim() || "-",
        sortYear: year,
        sortIssue: issueNumber
      });
    }
  }

  for (const material of store.publishedMaterials ?? []) {
    const key = publishedMaterialKey(material.year, material.issueNumber, material.title);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push({
      numberLabel: material.numberLabel,
      section: material.section?.trim() || "-",
      title: material.title,
      author: material.author?.trim() || "-",
      sortYear: material.year,
      sortIssue: material.issueNumber
    });
  }

  return rows.sort((left, right) => {
    if (right.sortYear !== left.sortYear) {
      return right.sortYear - left.sortYear;
    }

    if (right.sortIssue !== left.sortIssue) {
      return right.sortIssue - left.sortIssue;
    }

    return left.title.localeCompare(right.title, "ru");
  });
}

export function applyArchivePublishedMaterialsImport(
  year: number,
  entries: PublishedListEntry[]
): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;

  updateStore((store) => {
    if (!store.publishedMaterials) {
      store.publishedMaterials = [];
    }

    const seen = new Set(
      store.publishedMaterials.map((item) => publishedMaterialKey(item.year, item.issueNumber, item.title))
    );

    for (const issue of store.issues) {
      const issueYear = parseIssueYear(issue.numberLabel, issue.publishDate);
      const issueNumber = parseJournalNumber(issue.numberLabel);
      if (!issueYear || !issueNumber) {
        continue;
      }

      for (const material of issue.materials) {
        const title = material.title?.trim();
        if (!title) {
          continue;
        }

        seen.add(publishedMaterialKey(issueYear, issueNumber, title));
      }
    }

    let nextId = Math.max(0, ...(store.publishedMaterials.map((item) => item.id)), 0) + 1;

    for (const entry of entries) {
      if (!isImportableEntry(entry)) {
        skipped += 1;
        continue;
      }

      const normalized = normalizeArchiveAuthor(entry);
      const key = publishedMaterialKey(year, entry.issueNumber, normalized.title);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }

      seen.add(key);
      store.publishedMaterials.push({
        id: nextId,
        issueNumber: entry.issueNumber,
        year,
        numberLabel: `№ ${entry.issueNumber} (${year})`,
        section: entry.section?.trim() || "-",
        title: normalized.title,
        author: normalized.author
      });
      nextId += 1;
      added += 1;
    }
  });

  return { added, skipped };
}

export function applyPublishedListImport(year: number, entries: PublishedListEntry[]): {
  updated: number;
  created: number;
  added: number;
  skipped: number;
} {
  const grouped = new Map<number, PublishedListEntry[]>();
  for (const entry of entries) {
    if (!isImportableEntry(entry)) {
      continue;
    }

    const bucket = grouped.get(entry.issueNumber) ?? [];
    bucket.push(entry);
    grouped.set(entry.issueNumber, bucket);
  }

  let updated = 0;
  let created = 0;
  let added = 0;
  let skipped = 0;

  updateStore((store) => {
    let nextId = Math.max(0, ...store.issues.map((item) => item.id)) + 1;

    for (const [issueNumber, issueEntries] of [...grouped.entries()].sort((left, right) => left[0] - right[0])) {
      const existing = store.issues.find((issue) => parseJournalNumber(issue.numberLabel) === issueNumber);
      const knownKeys = new Set(
        (existing?.materials ?? [])
          .map((material) => normalizeMaterialKey(material.title))
          .filter(Boolean)
      );

      const newcomers: IssueMaterial[] = [];
      for (const entry of issueEntries) {
        const key = normalizeMaterialKey(entry.title);
        if (!key || knownKeys.has(key)) {
          skipped += 1;
          continue;
        }

        knownKeys.add(key);
        newcomers.push({
          title: entry.title,
          author: entry.author,
          section: entry.section,
          isPrimary: 0
        });
      }

      if (!newcomers.length && existing) {
        continue;
      }

      if (existing) {
        const primaryCount = existing.materials.filter((material) => material.isPrimary === 1).length;
        const merged = [
          ...existing.materials,
          ...newcomers.map((material, index) => ({
            ...material,
            isPrimary: primaryCount + index < MAX_PRIMARY_ISSUE_MATERIALS ? 1 : 0
          }))
        ];
        existing.materials = sanitizeIssueMaterials(merged);
        added += newcomers.length;
        updated += 1;
        continue;
      }

      const materials = sanitizeIssueMaterials(
        newcomers.map((material, index) => ({
          ...material,
          isPrimary: index < MAX_PRIMARY_ISSUE_MATERIALS ? 1 : 0
        }))
      );
      const numberLabel = `№ ${issueNumber} (${year})`;
      const firstTitle = materials[0]?.title ?? "vypusk";
      store.issues.push({
        id: nextId,
        numberLabel,
        publishDate: `${year}-${String(issueNumber).padStart(2, "0")}-01`,
        slug: slugify(`${numberLabel}-${firstTitle}`, { lower: true, strict: true, locale: "ru" }),
        materials,
        coverImage: "",
        isPublished: 0,
        isFeatured: 0,
        createdAt: new Date().toISOString()
      });
      nextId += 1;
      created += 1;
      added += newcomers.length;
    }
  });

  return { updated, created, added, skipped };
}

export function verifyAdmin(login: string, password: string): { id: number; login: string; role: AdminRole } | null {
  const row = readStore().admins.find((admin) => admin.login === login);

  if (!row) {
    return null;
  }

  if (!bcrypt.compareSync(password, row.passwordHash)) {
    return null;
  }

  return { id: row.id, login: row.login, role: row.role ?? "admin" };
}

export function getAdminById(id: number): { id: number; login: string; role: AdminRole } | null {
  const row = readStore().admins.find((admin) => admin.id === id);
  if (!row) {
    return null;
  }

  return { id: row.id, login: row.login, role: row.role ?? "admin" };
}
