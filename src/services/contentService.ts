import bcrypt from "bcryptjs";
import { readStore, updateStore } from "../db";
import type { ContactMessage, JournalIssue, PageContent, PageKey, PublishedListItem } from "../types";

export function getSettings(): Record<string, string> {
  return readStore().settings;
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
      Object.assign(existing, issue);
      return;
    }

    const nextId = Math.max(0, ...store.issues.map((item) => item.id)) + 1;
    store.issues.push({
      ...issue,
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
