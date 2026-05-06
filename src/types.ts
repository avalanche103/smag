export type PageKey = "home" | "about" | "payment" | "contacts";

export interface JournalIssue {
  id: number;
  numberLabel: string;
  publishDate: string;
  slug: string;
  title: string;
  teaser: string;
  summary: string;
  coverImage: string;
  isPublished: number;
  isFeatured: number;
  createdAt: string;
}

export interface SiteSetting {
  key: string;
  value: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
  isRead: number;
}

export interface PublishedListItem {
  id: number;
  title: string;
  periodLabel: string;
  filePath: string;
  createdAt: string;
  isVisible: number;
}

export interface PageContent {
  id: number;
  pageKey: PageKey;
  title: string;
  lead: string;
  body: string;
}

export interface AdminRecord {
  id: number;
  login: string;
  passwordHash: string;
  createdAt: string;
}

export interface DataStore {
  admins: AdminRecord[];
  settings: Record<string, string>;
  pages: PageContent[];
  issues: JournalIssue[];
  publishedLists: PublishedListItem[];
  contactMessages: ContactMessage[];
}
