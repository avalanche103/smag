export interface IpGeoInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  label: string;
}

function isPrivateIp(ip: string): boolean {
  if (!ip || ip === "::1" || ip === "127.0.0.1") {
    return true;
  }
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }
  const match = /^172\.(\d+)\./.exec(ip);
  if (match) {
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function formatLabel(country: string, region: string, city: string): string {
  const parts = [country, region, city].filter(Boolean);
  return parts.length ? parts.join(", ") : "не определено";
}

async function lookupOne(ip: string): Promise<IpGeoInfo> {
  if (isPrivateIp(ip)) {
    return { ip, country: "", region: "", city: "", label: "локальная сеть" };
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city&lang=ru`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) {
      return { ip, country: "", region: "", city: "", label: "не определено" };
    }
    const data = (await response.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
    };
    if (data.status !== "success") {
      return { ip, country: "", region: "", city: "", label: "не определено" };
    }
    const country = data.country?.trim() || "";
    const region = data.regionName?.trim() || "";
    const city = data.city?.trim() || "";
    return { ip, country, region, city, label: formatLabel(country, region, city) };
  } catch {
    return { ip, country: "", region: "", city: "", label: "не определено" };
  }
}

/** Resolve unique IPs; caches within one call. Soft rate-limit for free API. */
export async function resolveIpGeoBatch(ips: string[]): Promise<Map<string, IpGeoInfo>> {
  const unique = [...new Set(ips.map((ip) => ip.trim()).filter(Boolean))];
  const result = new Map<string, IpGeoInfo>();

  for (const ip of unique) {
    result.set(ip, await lookupOne(ip));
    // ip-api free tier: ~45 req/min — small pause between lookups
    if (unique.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }

  return result;
}
