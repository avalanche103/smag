import { execSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "ssh2";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(rootDir);

function parseEnvFile(filePath) {
  const result = {};
  if (!existsSync(filePath)) {
    return result;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx < 1) {
      continue;
    }
    result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return result;
}

function sshExec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
            return;
          }
          reject(new Error(`Remote command failed (${code}): ${stderr || stdout}`));
        })
        .on("data", (data) => {
          stdout += data.toString();
          process.stdout.write(data);
        });
      stream.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
    });
  });
}

function sshUpload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }

      const readStream = createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);

      writeStream.on("close", () => resolve());
      writeStream.on("error", reject);
      readStream.on("error", reject);
      readStream.pipe(writeStream);
    });
  });
}

function shellSingleQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function connect(config) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", reject)
      .connect(config);
  });
}

async function resolveRemotePath(conn, remotePath, domain) {
  const homeResult = await sshExec(conn, "bash -lc 'echo $HOME'");
  const home = homeResult.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
  let resolved = remotePath || `~/www/${domain}`;

  if (resolved.startsWith("~/")) {
    resolved = `${home}/${resolved.slice(2)}`;
  } else if (!resolved.startsWith("/")) {
    resolved = `${home}/www/${domain}`;
  }

  await sshExec(conn, `bash -lc "mkdir -p ${shellSingleQuote(resolved)}"`);
  return resolved;
}

const deployEnv = parseEnvFile(".env.deploy");
const host = deployEnv.DEPLOY_HOST || "vh134.hoster.by";
const user = deployEnv.DEPLOY_USER || "h215910";
const port = Number(deployEnv.DEPLOY_PORT || 22);
const password = deployEnv.DEPLOY_PASS || deployEnv.DEPLOY_PASSWORD || "";
const domain = deployEnv.DEPLOY_DOMAIN || "";
let remotePath = deployEnv.DEPLOY_PATH || "";

if (!domain && !remotePath) {
  console.error("[smag] ERROR: Set DEPLOY_DOMAIN in .env.deploy");
  process.exit(1);
}

if (!password) {
  console.error("[smag] ERROR: Set DEPLOY_PASS in .env.deploy");
  process.exit(1);
}

if (!remotePath) {
  remotePath = `~/www/${domain}`;
}

const archiveName = "smag-deploy.tar.gz";
const archivePath = path.join(tmpdir(), archiveName);
const excludePatterns = [
  "node_modules",
  "dist",
  ".git",
  ".env",
  ".env.deploy",
  "data/sessions",
  "data/backups",
  "data/audit.log",
  "data/content.json",
  "data/uploads",
  "data/*.sqlite",
  "Stroitelstvo_*.pdf",
  "YEAR.pdf",
  "HALF.pdf",
  "Перечень_*.pdf"
];

console.log("[smag] Creating archive...");
if (existsSync(archivePath)) {
  unlinkSync(archivePath);
}

const tarArgs = ["-czf", archivePath, ...excludePatterns.flatMap((item) => ["--exclude", item]), "-C", rootDir, "."];
execSync(`tar ${tarArgs.map((item) => (/\s/.test(item) ? `"${item}"` : item)).join(" ")}`, {
  stdio: "inherit",
  shell: true
});

const sshConfig = {
  host,
  port,
  username: user,
  password,
  readyTimeout: 30000
};

console.log(`[smag] Connecting to ${user}@${host}:${port} ...`);
const conn = await connect(sshConfig);

try {
  console.log("[smag] Uploading archive...");
  await sshUpload(conn, archivePath, `/tmp/${archiveName}`);

  const resolvedRemotePath = await resolveRemotePath(conn, remotePath, domain);
  console.log(`[smag] Remote path: ${resolvedRemotePath}`);

  const remoteScript = [
    "set -e",
    `cd ${shellSingleQuote(resolvedRemotePath)}`,
    'mkdir -p data/backups',
    'stamp=$(date -u +%Y-%m-%dT%H-%M-%S-%3NZ 2>/dev/null || date -u +%Y-%m-%dT%H-%M-%SZ)',
    'pre_dir="data/backups/pre-deploy-$stamp"',
    'mkdir -p "$pre_dir"',
    'if [[ -f data/content.json ]]; then cp -a data/content.json "$pre_dir/content.json"; echo "[smag] Pre-deploy backup: $pre_dir/content.json"; fi',
    'if [[ -d data/uploads ]]; then cp -a data/uploads "$pre_dir/uploads"; echo "[smag] Pre-deploy uploads copied"; fi',
    // keep last 10 pre-deploy dirs
    'ls -1dt data/backups/pre-deploy-* 2>/dev/null | tail -n +11 | xargs -r rm -rf',
    `tar -xzf /tmp/${archiveName}`,
    "chmod +x scripts/remote-install.sh scripts/remote-backup.sh 2>/dev/null || chmod +x scripts/remote-install.sh",
    `bash scripts/remote-install.sh ${shellSingleQuote(resolvedRemotePath)}`,
    `rm -f /tmp/${archiveName}`
  ].join("\n");

  console.log("[smag] Extracting and installing on server...");
  await sshExec(conn, `bash -s <<'EOF'\n${remoteScript}\nEOF`);

  if (existsSync(".env.production")) {
    console.log("[smag] Uploading .env.production ...");
    await sshUpload(conn, path.join(rootDir, ".env.production"), `${resolvedRemotePath}/.env.production`);
    await sshExec(
      conn,
      `bash -lc "cd ${shellSingleQuote(resolvedRemotePath)} && cp .env.production .env"`
    );
  }

  // Ensure daily backup cron (idempotent)
  try {
    console.log("[smag] Ensuring daily backup cron ...");
    await sshExec(
      conn,
      `bash -s <<'EOF'
set -e
SITE=${shellSingleQuote(resolvedRemotePath)}
CRON_LINE="15 3 * * * $SITE/scripts/remote-backup.sh >> $SITE/data/backups/cron.log 2>&1"
chmod +x "$SITE/scripts/remote-backup.sh" 2>/dev/null || true
mkdir -p "$SITE/data/backups"
(crontab -l 2>/dev/null | grep -v 'scripts/remote-backup.sh' || true; echo "$CRON_LINE") | crontab -
echo "[smag] Cron installed: $CRON_LINE"
EOF`
    );
  } catch (error) {
    console.warn("[smag] Could not install backup cron:", error instanceof Error ? error.message : error);
  }

  if (password && domain) {
    console.log("[smag] Restarting site in ISPmanager ...");
    const restartParams = new URLSearchParams({
      authinfo: `${user}:${password}`,
      func: "webdomain.edit",
      name: domain,
      sok: "ok",
      clicked_button: "ok",
      out: "xml"
    });
    try {
      const restartResponse = await fetch(`https://${host}:1500/ispmgr?${restartParams.toString()}`);
      const restartBody = await restartResponse.text();
      if (restartBody.includes('level="error"') || restartBody.includes("<error>")) {
        console.warn("[smag] Could not auto-restart via ISPmanager. Save the site manually.");
      } else {
        console.log("[smag] Site restarted.");
      }
    } catch {
      console.warn("[smag] Could not auto-restart via ISPmanager.");
    }

    try {
      await sshExec(
        conn,
        `bash -s <<'EOF'
set +e
PIDFILE="$HOME/.pm2/pids/${domain}-0.pid"
if [[ -f "$PIDFILE" ]]; then
  OLD=$(cat "$PIDFILE")
  echo "[smag] Stopping pid $OLD from $PIDFILE"
  kill "$OLD" 2>/dev/null
  sleep 1
  kill -9 "$OLD" 2>/dev/null
fi
pkill -f 'node dist/server.js' 2>/dev/null || true
sleep 1
pgrep -af 'node dist/server.js' || echo "[smag] Waiting for ISPmanager to respawn node"
EOF`
      );
      console.log("[smag] Node process recycle requested.");
    } catch {
      console.warn("[smag] Could not restart Node process via SSH.");
    }
  }

  console.log("");
  console.log("[smag] Deploy finished.");
} finally {
  conn.end();
  if (existsSync(archivePath)) {
    unlinkSync(archivePath);
  }
}
