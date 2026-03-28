#!/usr/bin/env bash
# ============================================================
#  WordPress Studio — HTTPS Setup for macOS
#  Installs mkcert, trusts the local CA, and generates a
#  browser-trusted TLS certificate for a Studio local domain.
#
#  Usage:
#    chmod +x setup-https-macos.sh
#    ./setup-https-macos.sh webpage.com
#    ./setup-https-macos.sh mysite.local
# ============================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
DOMAIN="${1:-}"
STUDIO_CERT_DIR="${HOME}/.studio/certificates/domains"

# ── Colors ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'
BOLD='\033[1m'

step()  { echo -e "\n${CYAN}==> $1${RESET}"; }
ok()    { echo -e "    ${GREEN}[OK]${RESET} $1"; }
warn()  { echo -e "    ${YELLOW}[!!]${RESET} $1"; }
fail()  { echo -e "    ${RED}[ERROR]${RESET} $1"; exit 1; }

# ── Validate args ────────────────────────────────────────────────────────────
if [[ -z "$DOMAIN" ]]; then
    echo -e "${RED}Usage: $0 <domain>${RESET}"
    echo    "  Example: $0 webpage.com"
    echo    "  Example: $0 mysite.local"
    exit 1
fi

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  WordPress Studio — HTTPS Setup for macOS${RESET}"
echo    "  Domain  : $DOMAIN"
echo    "  CertDir : $STUDIO_CERT_DIR"
echo ""

# ── Step 1: Check for Homebrew ───────────────────────────────────────────────
step "Checking for Homebrew..."

if ! command -v brew &>/dev/null; then
    warn "Homebrew not found — installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for Apple Silicon
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    ok "Homebrew installed"
else
    ok "Homebrew found: $(brew --version | head -1)"
fi

# ── Step 2: Install mkcert ───────────────────────────────────────────────────
step "Checking for mkcert..."

if command -v mkcert &>/dev/null; then
    ok "mkcert already installed: $(mkcert --version)"
else
    warn "mkcert not found — installing via Homebrew..."
    brew install mkcert nss
    ok "mkcert installed: $(mkcert --version)"
fi

# ── Step 3: Install local CA into macOS / browser trust stores ───────────────
step "Installing mkcert CA into system trust store..."

# nss is needed for Firefox support; install if not present
if ! brew list nss &>/dev/null 2>&1; then
    echo "    Installing nss (for Firefox support)..."
    brew install nss || warn "nss install failed — Firefox may not trust the cert"
fi

mkcert -install
ok "CA installed — Chrome, Safari, and Firefox will now trust mkcert certificates"

# ── Step 4: Ensure cert directory exists ─────────────────────────────────────
step "Preparing certificate directory..."

mkdir -p "$STUDIO_CERT_DIR"
ok "Directory ready: $STUDIO_CERT_DIR"

# ── Step 5: Generate certificate ─────────────────────────────────────────────
step "Generating TLS certificate for: $DOMAIN"

CERT_FILE="${STUDIO_CERT_DIR}/${DOMAIN}.crt"
KEY_FILE="${STUDIO_CERT_DIR}/${DOMAIN}.key"

mkcert \
    -cert-file "$CERT_FILE" \
    -key-file  "$KEY_FILE" \
    "$DOMAIN"

if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    ok "Certificate : $CERT_FILE"
    ok "Private key : $KEY_FILE"
else
    fail "Cert files not found after generation!"
fi

# ── Step 6: Verify certificate details ───────────────────────────────────────
step "Verifying certificate..."

if command -v openssl &>/dev/null; then
    SUBJECT=$(openssl x509 -in "$CERT_FILE" -noout -subject 2>/dev/null | sed 's/subject=//')
    ISSUER=$(openssl x509 -in "$CERT_FILE" -noout -issuer 2>/dev/null | sed 's/issuer=//')
    DATES=$(openssl x509 -in "$CERT_FILE" -noout -dates 2>/dev/null)
    ok "Subject : $SUBJECT"
    ok "Issuer  : $ISSUER"
    echo "$DATES" | while read -r line; do
        ok "$line"
    done
else
    warn "openssl not found — skipping cert verification display"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✅  HTTPS setup complete!${RESET}"
echo ""
echo    "  Next steps:"
echo    "   1. Restart WordPress Studio (stop → start the site)"
echo    "   2. Open https://$DOMAIN in Chrome or Safari"
echo    "   3. You should see a padlock — no certificate warning"
echo ""
echo -e "${YELLOW}  If Chrome still shows NET::ERR_CERT_INVALID:${RESET}"
echo    "   • Fully close and reopen Chrome (Cmd+Q, then reopen)"
echo    "   • Run: mkcert -install   and restart the browser"
echo    "   • Check: Security > Certificate Trust Settings in macOS Keychain Access"
echo ""
