#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Install mkcert and configure HTTPS for a WordPress Studio local site.

.DESCRIPTION
    Downloads mkcert, installs the local CA into Windows certificate store,
    generates a trusted TLS certificate for the given domain, and writes
    the cert/key into the WordPress Studio certificates directory.

.PARAMETER Domain
    The local domain to secure, e.g. "i-help.us" or "mysite.local"

.PARAMETER StudioCertDir
    Path to Studio certificates directory.
    Defaults to: $env:USERPROFILE\.studio\certificates\domains

.PARAMETER MkcertVersion
    mkcert release version to download. Defaults to "v1.4.4"

.EXAMPLE
    .\setup-https-windows.ps1 -Domain "i-help.us"

.EXAMPLE
    .\setup-https-windows.ps1 -Domain "mysite.local" -MkcertVersion "v1.4.4"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Domain,

    [string]$StudioCertDir = "$env:USERPROFILE\.studio\certificates\domains",

    [string]$MkcertVersion = "v1.4.4"
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Write-OK([string]$msg) {
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "    [!!] $msg" -ForegroundColor Yellow
}

function Write-Fail([string]$msg) {
    Write-Host "    [ERROR] $msg" -ForegroundColor Red
}

# ── Banner ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  WordPress Studio — HTTPS Setup for Windows" -ForegroundColor White
Write-Host "  Domain : $Domain" -ForegroundColor White
Write-Host "  CertDir: $StudioCertDir" -ForegroundColor White
Write-Host ""

# ── Step 1: Check / Install mkcert ──────────────────────────────────────────
Write-Step "Checking for mkcert..."

$mkcertPath = "C:\Windows\System32\mkcert.exe"
$mkcertExists = Test-Path $mkcertPath

if (-not $mkcertExists) {
    # Try PATH as well
    $found = Get-Command mkcert -ErrorAction SilentlyContinue
    if ($found) {
        $mkcertPath = $found.Source
        $mkcertExists = $true
    }
}

if ($mkcertExists) {
    $ver = & $mkcertPath --version 2>&1
    Write-OK "mkcert already installed: $ver"
} else {
    Write-Warn "mkcert not found — downloading $MkcertVersion..."

    $url = "https://github.com/FiloSottile/mkcert/releases/download/$MkcertVersion/mkcert-$MkcertVersion-windows-amd64.exe"
    $tmpFile = "$env:TEMP\mkcert.exe"

    Write-Host "    Downloading from: $url" -ForegroundColor Gray

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $tmpFile -UseBasicParsing
    } catch {
        Write-Fail "Download failed: $_"
        Write-Host "    Please download manually from:" -ForegroundColor Yellow
        Write-Host "    https://github.com/FiloSottile/mkcert/releases" -ForegroundColor Yellow
        exit 1
    }

    Copy-Item $tmpFile $mkcertPath -Force
    Remove-Item $tmpFile -ErrorAction SilentlyContinue

    $ver = & $mkcertPath --version 2>&1
    Write-OK "mkcert installed: $ver"
}

# ── Step 2: Install local CA into Windows trust store ───────────────────────
Write-Step "Installing mkcert CA into Windows certificate store..."

try {
    & $mkcertPath -install 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    Write-OK "CA installed — Chrome and Edge will now trust mkcert certificates"
} catch {
    Write-Fail "CA install failed: $_"
    Write-Host "    Try running: mkcert -install   in an elevated terminal" -ForegroundColor Yellow
    exit 1
}

# ── Step 3: Ensure cert directory exists ────────────────────────────────────
Write-Step "Preparing certificate directory..."

if (-not (Test-Path $StudioCertDir)) {
    New-Item -ItemType Directory -Path $StudioCertDir -Force | Out-Null
    Write-OK "Created: $StudioCertDir"
} else {
    Write-OK "Directory exists: $StudioCertDir"
}

# ── Step 4: Generate certificate ────────────────────────────────────────────
Write-Step "Generating TLS certificate for: $Domain"

$certFile = Join-Path $StudioCertDir "$Domain.crt"
$keyFile  = Join-Path $StudioCertDir "$Domain.key"

try {
    & $mkcertPath `
        -cert-file $certFile `
        -key-file  $keyFile `
        $Domain 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

    if ((Test-Path $certFile) -and (Test-Path $keyFile)) {
        Write-OK "Certificate : $certFile"
        Write-OK "Private key : $keyFile"
    } else {
        Write-Fail "Cert files not found after generation!"
        exit 1
    }
} catch {
    Write-Fail "Certificate generation failed: $_"
    exit 1
}

# ── Step 5: Verify cert ─────────────────────────────────────────────────────
Write-Step "Verifying certificate..."

try {
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certFile)
    Write-OK "Subject  : $($cert.Subject)"
    Write-OK "Issuer   : $($cert.Issuer)"
    Write-OK "Valid from: $($cert.NotBefore.ToString('yyyy-MM-dd'))"
    Write-OK "Valid to  : $($cert.NotAfter.ToString('yyyy-MM-dd'))"
} catch {
    Write-Warn "Could not parse cert for display (not critical): $_"
}

# ── Done ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ✅  HTTPS setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "   1. Restart WordPress Studio (stop → start the site)" -ForegroundColor Gray
Write-Host "   2. Open https://$Domain in Chrome" -ForegroundColor Gray
Write-Host "   3. You should see a padlock — no certificate warning" -ForegroundColor Gray
Write-Host ""
Write-Host "  If Chrome still shows ERR_CERT_AUTHORITY_INVALID:" -ForegroundColor Yellow
Write-Host "   • Fully close and reopen Chrome (all windows)" -ForegroundColor Gray
Write-Host "   • Run: mkcert -install   in an Admin terminal and restart Chrome" -ForegroundColor Gray
Write-Host ""
