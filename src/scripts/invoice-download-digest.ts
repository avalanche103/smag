import { env } from "../config/env";
import { getPageContent, getPageExtra } from "../services/contentService";
import { isMailConfigured, sendInvoiceDownloadDigestEmail } from "../services/mailService";
import {
  minskDateYmd,
  minskTimeHm,
  readDayEntries,
  totalsForEntries
} from "../utils/invoiceDownloadLog";
import { resolveIpGeoBatch } from "../utils/ipGeo";

async function main(): Promise<void> {
  const dateYmd = minskDateYmd();
  const entries = readDayEntries(dateYmd);
  if (!entries.length) {
    console.log(`[smag] No invoice downloads for ${dateYmd}; skip email.`);
    return;
  }

  if (!isMailConfigured()) {
    throw new Error("SMTP не настроен. Укажите SMTP_HOST, SMTP_USER, SMTP_PASS и MAIL_FROM.");
  }

  const page = getPageContent("subscribe");
  const label1 = getPageExtra(page, "invoiceLabel1") || "Счёт 1";
  const label2 = getPageExtra(page, "invoiceLabel2") || "Счёт 2";
  const totals = totalsForEntries(entries);

  const geoMap = await resolveIpGeoBatch(entries.map((entry) => entry.ip));
  const events = entries.map((entry) => {
    const geo = geoMap.get(entry.ip)?.label || "не определено";
    return {
      time: minskTimeHm(entry.at),
      label: entry.label || (entry.invoiceKey === "invoice1" ? label1 : label2),
      geo,
      ip: entry.ip
    };
  });

  const geoCounts = new Map<string, number>();
  for (const event of events) {
    geoCounts.set(event.geo, (geoCounts.get(event.geo) || 0) + 1);
  }
  const geoSummary = [...geoCounts.entries()]
    .map(([place, count]) => ({ place, count }))
    .sort((a, b) => b.count - a.count || a.place.localeCompare(b.place, "ru"));

  await sendInvoiceDownloadDigestEmail({
    to: env.mailTo,
    dateYmd,
    label1,
    label2,
    count1: totals.invoice1,
    count2: totals.invoice2,
    total: totals.total,
    events,
    geoSummary
  });

  console.log(`[smag] Invoice digest sent to ${env.mailTo} for ${dateYmd} (${totals.total} downloads).`);
}

main().catch((error) => {
  console.error("[smag] Invoice digest failed:", error);
  process.exit(1);
});
