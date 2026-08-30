import tls from "node:tls";
import { readFileSync, existsSync } from "node:fs";

function parseEnvFile(filePath) {
  const result = {};
  if (!existsSync(filePath)) return result;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return result;
}

function checkCert(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        resolve(cert);
      }
    );
    socket.on("error", reject);
  });
}

const deployEnv = parseEnvFile(".env.deploy");
const panelHost = deployEnv.DEPLOY_HOST || "vh134.hoster.by";
const user = deployEnv.DEPLOY_USER || "h215910";
const password = deployEnv.DEPLOY_PASS || deployEnv.DEPLOY_PASSWORD || "";
const domain = deployEnv.DEPLOY_DOMAIN || "stroydelo.by";
const email = "prof.dialogi@yandex.by";

if (!password) {
  console.error("[smag] ERROR: DEPLOY_PASS is missing in .env.deploy");
  process.exit(1);
}

for (const host of [domain, `www.${domain}`]) {
  try {
    const cert = await checkCert(host);
    console.log(`[smag] ${host}: valid_to=${cert.valid_to}, subject=${cert.subject?.CN}, alt=${cert.subjectaltname || "n/a"}`);
  } catch (error) {
    console.error(`[smag] ${host}: certificate check failed`, error.message);
  }
}

async function ispmgr(params) {
  const query = new URLSearchParams({
    authinfo: `${user}:${password}`,
    out: "xml",
    sok: "ok",
    ...params
  });
  const response = await fetch(`https://${panelHost}:1500/ispmgr?${query.toString()}`);
  const body = await response.text();
  if (!response.ok || body.includes('level="error"') || body.includes("<error>")) {
    throw new Error(body.slice(0, 2500));
  }
  return body;
}

console.log(`[smag] Issuing Let's Encrypt for ${domain} and www.${domain} ...`);
await ispmgr({
  func: "letsencrypt.generate",
  domain_name: domain,
  domain: `${domain} www.${domain}`,
  email,
  crtname: `${domain}_le`,
  name: `${domain}_csr`,
  username: user,
  keylen: "2048",
  wildcard: "off",
  dns_check: "off",
  skip_check_a_record: "off",
  enable_cert: "on"
});

console.log("[smag] Enabling SSL certificate on site ...");
await ispmgr({
  func: "webdomain.edit",
  name: domain,
  ssl_cert: `${domain}_le`,
  redirect: "on",
  redirect_http: "on",
  clicked_button: "ok"
});

console.log("[smag] SSL setup finished.");
