export type PageKey = "home" | "about" | "contacts" | "subscribe";

export interface IssueMaterial {
  title: string;
  isPrimary: number;
  author: string;
  section: string;
}

export interface JournalIssue {
  id: number;
  numberLabel: string;
  publishDate: string;
  slug: string;
  materials: IssueMaterial[];
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

export interface PublishedMaterial {
  id: number;
  issueNumber: number;
  year: number;
  numberLabel: string;
  section: string;
  title: string;
  author: string;
}

export interface PublishedMaterialRow {
  numberLabel: string;
  slug?: string;
  section: string;
  title: string;
  author: string;
  sortYear: number;
  sortIssue: number;
  sortOrder: number;
}

export interface PageContent {
  id: number;
  pageKey: PageKey;
  title: string;
  lead: string;
  body: string;
  extras?: Record<string, string>;
}

export type AdminRole = "admin" | "user";

export interface AdminRecord {
  id: number;
  login: string;
  passwordHash: string;
  role: AdminRole;
  createdAt: string;
}

export interface DataStore {
  admins: AdminRecord[];
  settings: Record<string, string>;
  pages: PageContent[];
  issues: JournalIssue[];
  publishedLists: PublishedListItem[];
  publishedMaterials: PublishedMaterial[];
  contactMessages: ContactMessage[];
}
