#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════════
#  WordPress Studio MCP Extension — One-Command Setup
#  Project: c:\Work\Wordpress Studio MCP Plugin for Claude Code\
#
#  Run from PowerShell (no Admin required):
#    cd "c:\Work\Wordpress Studio MCP Plugin for Claude Code"
#    .\setup.ps1
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ProjectRoot = "c:\Work\Wordpress Studio MCP Plugin for Claude Code"
$DistEntry   = "$ProjectRoot\dist\index.js"
$StudioHome  = "$env:USERPROFILE\.studio"
$SitesRoot   = "C:\Users\Користувач\Studio\sites"

function Write-Step { param([string]$n, [string]$msg) Write-Host "$n  $msg" -ForegroundColor Yellow }
function Write-OK   { param([string]$msg) Write-Host "     $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "     ⚠  $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   WordPress Studio MCP Extension — Setup                         ║" -ForegroundColor Cyan
Write-Host "║   c:\Work\Wordpress Studio MCP Plugin for Claude Code\           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Node.js ────────────────────────────────────────────────────────────────
Write-Step "1/7" "Checking Node.js v22+..."
try {
    $v = node --version
    if ([version]($v -replace 'v','') -lt [version]"22.0.0") {
        Write-Warn "Node.js $v found but v22+ is required. Install from https://nodejs.org"
        exit 1
    }
    Write-OK "Node.js $v ✓"
} catch {
    Write-Warn "Node.js not found. Install from https://nodejs.org"
    exit 1
}

# ── 2. Studio CLI ─────────────────────────────────────────────────────────────
Write-Step "2/7" "Checking Studio CLI..."
try {
    $sv = studio --version
    Write-OK "Studio CLI $sv ✓"
} catch {
    Write-Warn "Studio CLI not in PATH."
    Write-Host "     Enable in Studio desktop: Menu → Settings → Studio CLI → Save" -ForegroundColor Yellow
    Write-Host "     Then restart this terminal and run setup.ps1 again." -ForegroundColor Yellow
    exit 1
}

# ── 3. npm install ────────────────────────────────────────────────────────────
Write-Step "3/7" "Installing npm dependencies..."
Set-Location $ProjectRoot
npm install --silent
Write-OK "Dependencies installed ✓"

# ── 4. TypeScript build ───────────────────────────────────────────────────────
Write-Step "4/7" "Building TypeScript → dist/..."
npm run build
if (-not (Test-Path $DistEntry)) {
    Write-Warn "Build failed — $DistEntry not found."
    exit 1
}
Write-OK "Build successful ✓  ($DistEntry)"

# ── 5. Register MCP servers ───────────────────────────────────────────────────
Write-Step "5/7" "Registering MCP servers in Claude Code..."

# Part A — Remote WordPress.com MCP (HTTP + OAuth 2.1)
Write-Host "     A) wordpress-com (remote, OAuth 2.1)..." -ForegroundColor Cyan
claude mcp add --transport http --scope user wordpress-com `
    -- https://public-api.wordpress.com/wpcom/v2/mcp/v1
if ($LASTEXITCODE -eq 0) { Write-OK "wordpress-com registered ✓" }
else { Write-Warn "Could not register wordpress-com — add manually (see .mcp.json)" }

# Part B — Studio built-in MCP
Write-Host "     B) wordpress-studio (built-in, stdio)..." -ForegroundColor Cyan
claude mcp add --scope user wordpress-studio -- studio mcp
if ($LASTEXITCODE -eq 0) { Write-OK "wordpress-studio registered ✓" }
else { Write-Warn "Could not register wordpress-studio — add manually (see .mcp.json)" }

# Part C — Hybrid extension MCP
Write-Host "     C) wordpress-studio-ext (extension, stdio)..." -ForegroundColor Cyan
claude mcp add --scope user wordpress-studio-ext `
    --env "STUDIO_HOME=$StudioHome" `
    --env "STUDIO_SITES_ROOT=$SitesRoot" `
    -- node $DistEntry
if ($LASTEXITCODE -eq 0) { Write-OK "wordpress-studio-ext registered ✓" }
else { Write-Warn "Could not register wordpress-studio-ext — add manually (see .mcp.json)" }

# ── 6. WordPress.com authentication ──────────────────────────────────────────
Write-Step "6/7" "Checking WordPress.com authentication..."
$authOut = studio auth status 2>&1
if ($authOut -match "Logged in|authenticated") {
    Write-OK "Already authenticated to WordPress.com ✓"
} else {
    Write-Host "     Not authenticated — opening browser for OAuth login..." -ForegroundColor Yellow
    studio auth login
}

# ── 7. Verify ─────────────────────────────────────────────────────────────────
Write-Step "7/7" "Verifying registered MCP servers..."
Write-Host ""
claude mcp list
Write-Host ""

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Setup complete!  Restart Claude Code to activate all MCPs.      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  After restart, verify with:  /mcp" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🌐  wordpress-com          Remote WordPress.com   (14 tools)" -ForegroundColor White
Write-Host "  🖥   wordpress-studio       Local Studio built-in  (13 tools)" -ForegroundColor White
Write-Host "  🔧  wordpress-studio-ext   Hybrid extension       (27 tools)" -ForegroundColor White
Write-Host ""
Write-Host "  Total: 54 tools across 3 MCP servers." -ForegroundColor Cyan
Write-Host ""
