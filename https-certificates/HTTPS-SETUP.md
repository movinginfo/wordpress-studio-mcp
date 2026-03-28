# HTTPS Setup for WordPress Studio Local Sites

> **Applies to:** WordPress Studio 1.7.7+ · Windows 10/11 · macOS 12+

WordPress Studio uses its own internal CA ("WordPress Studio CA") to sign certificates for local sites. Chrome and other browsers do **not** trust this CA by default, which causes `ERR_CERT_INVALID` / "З'єднання не конфіденційне" warnings.

The solution is [**mkcert**](https://github.com/FiloSottile/mkcert) — a tool that creates a local CA that browsers *do* trust, and generates valid certificates for any local domain.

---

## Table of Contents

- [How it works](#how-it-works)
- [Windows](#windows)
  - [Automated script (recommended)](#windows--automated-script)
  - [Manual steps](#windows--manual-steps)
  - [Troubleshooting](#windows--troubleshooting)
- [macOS](#macos)
  - [Automated script (recommended)](#macos--automated-script)
  - [Manual steps](#macos--manual-steps)
  - [Troubleshooting](#macos--troubleshooting)
- [After setup — WordPress Studio](#after-setup--wordpress-studio)
- [FAQ](#faq)

---

## How it works

```
studio_site_use_mkcert  site:webpage.com  domain:webpage.com  confirmed:true


mkcert -install          ← Registers a local CA into the OS trust store
mkcert -cert-file …      ← Generates a cert signed by that trusted CA
Studio reads the cert    ← Serves HTTPS on your local domain
Chrome sees trusted CA   ← Green padlock ✅
```

The cert files are placed in `~/.studio/certificates/domains/` — the exact location WordPress Studio looks for custom domain certificates.

---

## Windows

### Windows — Automated script

> **Requirements:** Windows 10/11 · PowerShell 5+ · Run as Administrator

**Option A — Double-click (easiest):**

1. Put `setup-https.bat` and `setup-https-windows.ps1` in the **same folder**.
2. Double-click `setup-https.bat`.
3. Enter your domain when prompted (e.g. `i-help.us`).
4. Click **Yes** on the UAC Administrator prompt.
5. Done — the script downloads mkcert, installs the CA, and generates the cert.

**Option B — From Command Prompt or PowerShell:**

```cmd
setup-https.bat i-help.us
```

Or run the PowerShell script directly as Administrator:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
.\setup-https-windows.ps1 -Domain "i-help.us"
```

The script will:
- Download `mkcert.exe` to `C:\Windows\System32\` (no PATH changes needed)
- Run `mkcert -install` (installs CA into Windows trust store → Chrome trusts it)
- Generate `i-help.us.crt` and `i-help.us.key`
- Save them to `%USERPROFILE%\.studio\certificates\domains\`

After the script finishes: **Restart the site** in WordPress Studio (Stop → Start), then open `https://i-help.us` in Chrome — padlock appears. ✅

---

### Windows — Manual steps

#### Step 1 — Download mkcert

Paste this URL into Chrome's address bar and press Enter to download:

```
https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe
```

#### Step 2 — Install mkcert to System32

Open **PowerShell as Administrator** and run:

```powershell
Copy-Item "$env:USERPROFILE\Downloads\mkcert-v1.4.4-windows-amd64.exe" "C:\Windows\System32\mkcert.exe"
mkcert --version
```

Expected output: `v1.4.4`

#### Step 3 — Install the local CA

```powershell
mkcert -install
```

A UAC popup may appear — click **Yes**. This is what makes Chrome trust the certificate.

#### Step 4 — Generate the certificate

Replace `i-help.us` with your domain:

```powershell
mkcert `
  -cert-file "$env:USERPROFILE\.studio\certificates\domains\i-help.us.crt" `
  -key-file  "$env:USERPROFILE\.studio\certificates\domains\i-help.us.key" `
  i-help.us
```

#### Step 5 — Restart site in Studio

In the WordPress Studio UI: **Stop → Start** your site.

#### Step 6 — Open in Chrome

Navigate to `https://i-help.us` — padlock should appear. ✅

---

### Windows — Troubleshooting

| Problem | Fix |
|--------|-----|
| `winget` not found | Use the automated script or manual download method above — no winget needed |
| `mkcert` not recognized after copy | Reopen PowerShell, or use full path `C:\Windows\System32\mkcert.exe` |
| Chrome still shows `ERR_CERT_INVALID` | Close **all** Chrome windows (`Ctrl+Shift+Q`), reopen, try again |
| Chrome shows `ERR_CERT_AUTHORITY_INVALID` | Re-run `mkcert -install` in Admin terminal, restart Chrome |
| UAC prompt doesn't appear | Right-click PowerShell → "Run as administrator" |
| Script says "execution policy" error | Run: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| Wrong cert dir | Check `%USERPROFILE%\.studio\certificates\domains\` — create it manually if missing |

---

## macOS

### macOS — Automated script

> **Requirements:** macOS 12+ · Terminal · Homebrew (installed automatically if missing)

1. Open **Terminal** (`Cmd + Space` → type Terminal → Enter).

2. Make the script executable and run it:
   ```bash
   chmod +x setup-https-macos.sh
   ./setup-https-macos.sh i-help.us
   ```

3. The script will:
   - Install Homebrew if missing
   - Install `mkcert` and `nss` via Homebrew
   - Run `mkcert -install` (installs CA into macOS Keychain + Firefox)
   - Generate `i-help.us.crt` and `i-help.us.key`
   - Save them to `~/.studio/certificates/domains/`

4. **Restart the site** in WordPress Studio (Stop → Start).

5. Open `https://i-help.us` in Chrome or Safari — padlock appears. ✅

---

### macOS — Manual steps

#### Step 1 — Install Homebrew (if not installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Step 2 — Install mkcert

```bash
brew install mkcert nss
mkcert --version
```

`nss` adds Firefox support. Chrome and Safari work without it.

#### Step 3 — Install the local CA

```bash
mkcert -install
```

macOS may ask for your **login password** to modify the Keychain — this is normal.

#### Step 4 — Generate the certificate

Replace `i-help.us` with your domain:

```bash
mkcert \
  -cert-file ~/.studio/certificates/domains/i-help.us.crt \
  -key-file  ~/.studio/certificates/domains/i-help.us.key \
  i-help.us
```

#### Step 5 — Restart site in Studio

In the WordPress Studio UI: **Stop → Start** your site.

#### Step 6 — Open in Chrome or Safari

Navigate to `https://i-help.us` — padlock should appear. ✅

---

### macOS — Troubleshooting

| Problem | Fix |
|--------|-----|
| `brew: command not found` | Run the Homebrew install command in Step 1, or install manually from https://brew.sh |
| Apple Silicon (M1/M2) — `brew` not in PATH | Add to shell: `eval "$(/opt/homebrew/bin/brew shellenv)"` |
| Chrome shows `ERR_CERT_INVALID` | Quit Chrome completely (`Cmd+Q`), reopen and try again |
| Safari shows "This Connection Is Not Private" | Re-run `mkcert -install`, open **Keychain Access** and verify the mkcert CA is trusted |
| Firefox not trusting the cert | Ensure `nss` is installed (`brew install nss`), then re-run `mkcert -install` |
| Permission denied on cert directory | Run: `mkdir -p ~/.studio/certificates/domains` |

---

## After setup — WordPress Studio

After generating the certificate, WordPress Studio must be configured to use HTTPS. You can do this via the **Studio MCP tool** (if connected to Claude) or manually:

### Via Claude / Studio MCP (automatic)

Ask Claude:
> "Run mkcert HTTPS setup for i-help.us in WordPress Studio"

Claude will use the `studio_site_use_mkcert` tool to handle `cli.json`, hosts file, database URLs, and `wp-config.php` automatically.

Or run the tool directly:
```
studio_site_use_mkcert  site:i-help.us  domain:i-help.us  confirmed:true
```

### Manually

1. Open `%USERPROFILE%\.studio\cli.json` (Windows) or `~/.studio/cli.json` (macOS)
2. Find your site entry and set:
   ```json
   "customDomain": "i-help.us",
   "enableHttps": true
   ```
3. Ensure `127.0.0.1 i-help.us` exists in your hosts file:
   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   - macOS: `/etc/hosts`
4. Run a WP-CLI search-replace inside Studio:
   ```
   wp search-replace 'http://localhost:PORT' 'https://i-help.us' --all-tables
   ```
5. Add to `wp-config.php`:
   ```php
   define('WP_HOME',    'https://i-help.us');
   define('WP_SITEURL', 'https://i-help.us');
   ```
6. Stop → Start the site in Studio UI.

---

## FAQ

**Q: Do I need to redo this when the cert expires?**
A: mkcert certificates are valid for ~2 years. Re-run the script when they expire to regenerate.

**Q: Will this work for multiple domains?**
A: Yes — run the script once per domain, or pass multiple domains to mkcert:
```bash
mkcert -cert-file domain.crt -key-file domain.key domain1.com domain2.com
```

**Q: Does this affect production / real HTTPS?**
A: No. mkcert only installs a CA on your local machine. It has no effect on public certificates or production sites.

**Q: Where is the mkcert CA stored?**
- Windows: Windows Certificate Store (certmgr) → Trusted Root Certification Authorities
- macOS: Keychain Access → System Roots
- Linux: `/usr/local/share/ca-certificates/`

**Q: Is it safe to run `mkcert -install`?**
A: Yes — it only installs a CA on your own machine. No external servers are involved. The private key of the CA never leaves your computer.

**Q: Why doesn't Studio's built-in HTTPS work for real domains?**
A: Studio's CA has an X.509 Name Constraints extension that restricts it to `.local` domains only. When you enable HTTPS in Studio UI for a site named `i-help.us`, Studio automatically renames the domain to `i-helpus.wp.local` to work around this limitation. mkcert has no such constraints.

---

*WordPress Studio 1.7.7 · mkcert v1.4.4*
