$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Read-EnvFile {
    param([string]$Path)
    $result = @{}
    if (-not (Test-Path $Path)) { return $result }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        $result[$key] = $value
    }
    return $result
}

$deployEnv = Read-EnvFile ".env.deploy"
$hostName = if ($deployEnv["DEPLOY_HOST"]) { $deployEnv["DEPLOY_HOST"] } else { "vh134.hoster.by" }
$user = if ($deployEnv["DEPLOY_USER"]) { $deployEnv["DEPLOY_USER"] } else { "h215910" }
$port = if ($deployEnv["DEPLOY_PORT"]) { $deployEnv["DEPLOY_PORT"] } else { "22" }
$domain = $deployEnv["DEPLOY_DOMAIN"]
$remotePath = $deployEnv["DEPLOY_PATH"]

if (-not $domain -and -not $remotePath) {
    Write-Host "[smag] ERROR: Set DEPLOY_DOMAIN (or DEPLOY_PATH) in .env.deploy" -ForegroundColor Red
    Write-Host "       Copy .env.deploy.example -> .env.deploy and fill in your domain."
    exit 1
}

if (-not $remotePath) {
    $remotePath = "~/www/$domain"
}

$sshTarget = "${user}@${hostName}"
$sshArgs = @("-p", $port, "-o", "StrictHostKeyChecking=accept-new")
$archiveName = "smag-deploy.tar.gz"
$archivePath = Join-Path $env:TEMP $archiveName

Write-Host "[smag] Creating archive..."
if (Test-Path $archivePath) { Remove-Item $archivePath -Force }

$excludePatterns = @(
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
    "*.pdf"
)

$tarExclude = $excludePatterns | ForEach-Object { "--exclude=$_" }
& tar -czf $archivePath @tarExclude -C (Get-Location) .
if ($LASTEXITCODE -ne 0) {
    Write-Host "[smag] ERROR: tar failed. Windows 10+ includes tar; check that you are in the project root." -ForegroundColor Red
    exit 1
}

Write-Host "[smag] Uploading archive..."
$scpArgs = @("-P", $port, "-o", "StrictHostKeyChecking=accept-new", $archivePath, "${sshTarget}:/tmp/$archiveName")
& scp @scpArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[smag] ERROR: scp failed. Check SSH access (password or key)." -ForegroundColor Red
    Write-Host "       Tip: ssh-copy-id -p $port ${sshTarget}"
    exit 1
}

$remoteScript = @"
set -e
mkdir -p '$remotePath'
cd '$remotePath'
mkdir -p data/backups
stamp=`$(date -u +%Y-%m-%dT%H-%M-%SZ)
pre_dir="data/backups/pre-deploy-`$stamp"
mkdir -p "`$pre_dir"
if [[ -f data/content.json ]]; then cp -a data/content.json "`$pre_dir/content.json"; echo "[smag] Pre-deploy backup: `$pre_dir/content.json"; fi
if [[ -d data/uploads ]]; then cp -a data/uploads "`$pre_dir/uploads"; echo "[smag] Pre-deploy uploads copied"; fi
ls -1dt data/backups/pre-deploy-* 2>/dev/null | tail -n +11 | xargs -r rm -rf
tar -xzf /tmp/$archiveName
chmod +x scripts/remote-install.sh scripts/remote-backup.sh 2>/dev/null || chmod +x scripts/remote-install.sh
bash scripts/remote-install.sh '$remotePath'
rm -f /tmp/$archiveName
"@

Write-Host "[smag] Extracting and installing on server..."
$remoteScript | & ssh @sshArgs $sshTarget "bash -s"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[smag] ERROR: remote install failed." -ForegroundColor Red
    exit 1
}

if (Test-Path ".env.production") {
    Write-Host "[smag] Uploading .env.production ..."
    & scp @("-P", $port, "-o", "StrictHostKeyChecking=accept-new", ".env.production", "${sshTarget}:${remotePath}/.env.production")
    & ssh @sshArgs $sshTarget "cd '$remotePath' && cp -n .env.production .env 2>/dev/null || cp .env.production .env"
}

Write-Host "[smag] Ensuring daily backup cron ..."
$cronRemote = @"
set -e
SITE='$remotePath'
# expand ~ if present
SITE=`$(bash -lc "cd '$remotePath' && pwd")
CRON_LINE="15 3 * * * `$SITE/scripts/remote-backup.sh >> `$SITE/data/backups/cron.log 2>&1"
chmod +x "`$SITE/scripts/remote-backup.sh" 2>/dev/null || true
mkdir -p "`$SITE/data/backups"
(crontab -l 2>/dev/null | grep -v 'scripts/remote-backup.sh' || true; echo "`$CRON_LINE") | crontab -
echo "[smag] Cron installed"
"@
$cronRemote | & ssh @sshArgs $sshTarget "bash -s"

Write-Host ""
Write-Host "[smag] Deploy finished." -ForegroundColor Green
Write-Host "Next steps in ISPmanager (https://vh134.hoster.by:1500/):"
Write-Host "  1. Sites -> your domain -> Edit"
Write-Host "  2. Handler: Node.js, start file: dist/server.js, mode: port"
Write-Host "  3. Save to restart the app"
Write-Host "  4. Check SITE_URL and SESSION_SECRET in .env.production on the server"
