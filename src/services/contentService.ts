import bcrypt from "bcryptjs";
import slugify from "slugify";
import { readStore, updateStore } from "../db";
import type { ContactMessage, IssueMaterial, JournalIssue, PageContent, PageKey, PublishedListItem } from "../types";
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
    .replace(/<(p|div|ul|ol|li|b|strong|i|em|u)\b[^>]*>/gi, "<$1>")
    .replace(/&nbsp;/gi, " ")
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();
}

export function formatAudienceHtml(value: unknown): string {
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

export function updatePageContent(pageKey: PageKey, title: string, lead: string, body: string): void {
  updateStore((store) => {
    const page = store.pages.find((item) => item.pageKey === pageKey);
    if (!page) {
      throw new Error(`Page not found: ${pageKey}`);
    }
    page.title = title;
    page.lead = lead;
    page.body = body;
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

export function verifyAdmin(login: string, password: string): { id: number; login: string } | null {
  const row = readStore().admins.find((admin) => admin.login === login);

  if (!row) {
    return null;
  }

  if (!bcrypt.compareSync(password, row.passwordHash)) {
    return null;
  }

  return { id: row.id, login: row.login };
}
