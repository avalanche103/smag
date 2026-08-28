import type { JournalIssue } from "../types";

export interface PageMeta {
  title: string;
  description: string;
  canonical?: string;
  ogUrl?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function buildPageMeta(input: {
  title: string;
  description: string;
  siteUrl: string;
  path?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: PageMeta["jsonLd"];
}): PageMeta {
  const base = input.siteUrl.replace(/\/$/, "");
  const canonicalPath = input.path ?? "";
  const canonical = `${base}${canonicalPath.startsWith("/") ? canonicalPath : canonicalPath ? `/${canonicalPath}` : ""}`;
  const ogImage = input.ogImage?.startsWith("http") ? input.ogImage : input.ogImage ? `${base}${input.ogImage}` : `${base}/logo.jpg`;

  return {
    title: input.title,
    description: input.description,
    canonical,
    ogUrl: canonical,
    ogImage,
    ogType: input.ogType ?? "website",
    jsonLd: input.jsonLd
  };
}

export function buildOrganizationJsonLd(settings: Record<string, string>, siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.siteTitle,
    url: siteUrl.replace(/\/$/, ""),
    email: settings.email || undefined,
    telephone: settings.phone || undefined,
    address: settings.address
      ? {
          "@type": "PostalAddress",
          streetAddress: settings.address
        }
      : undefined
  };
}

export function buildPublicationIssueJsonLd(issue: JournalIssue, siteUrl: string): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "PublicationIssue",
    name: issue.numberLabel,
    datePublished: issue.publishDate,
    url: `${base}/issues/${issue.slug}`,
    image: issue.coverImage.startsWith("http") ? issue.coverImage : `${base}${issue.coverImage}`
  };
}
