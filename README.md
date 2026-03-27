# WordPress Studio MCP

> Give Claude direct access to your local WordPress sites — read files, query databases, run WP-CLI, and inspect site status. Works alongside the official Automattic plugins for a complete AI-powered WordPress development workflow.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v22.5%2B-green.svg)](https://nodejs.org)
[![WordPress Studio](https://img.shields.io/badge/WordPress%20Studio-1.7.7-3858e9.svg)](https://developer.wordpress.com/studio/)
[![MCP](https://img.shields.io/badge/MCP-stdio-orange.svg)](https://modelcontextprotocol.io)
[![GitHub](https://img.shields.io/badge/GitHub-movinginfo%2Fwordpress--studio--mcp-black.svg)](https://github.com/movinginfo/wordpress-studio-mcp)

---

## The Complete WordPress AI Stack

This MCP plugin is one piece of a three-part ecosystem. All three components are free and work together:

```
Claude Desktop / Claude Code
│
├── 🎨  wordpress.com            PLUGIN  skills only  →  Automattic official
│       Marketplace: claude-plugins-official            /design-site
│       Author: Automattic  v0.0.1                      /preview-designs
│                                                        /quick-build
│                                                        /site-specification
│
├── 🖥   wordpress-studio         MCP     stdio        →  npx wp-studio@latest mcp
│       Official Studio CLI MCP (Automattic)             13 tools — site lifecycle,
│       wp-studio@1.7.7 on npm                           WP-CLI, previews, screenshots
│
└── 🔧  wordpress-studio-mcp      MCP     stdio        →  node dist/index.js
        This project                                     27 tools — filesystem,
        github.com/movinginfo/wordpress-studio-mcp       SQLite DB, WP-CLI helpers,
                                                         site registry
```

**Total: 4 commands + 40 MCP tools** covering the full local WordPress development lifecycle.

---

## How the Three Components Work Together

### Build a new site from scratch

```
User: /quick-build  "coffee shop website, warm rustic feel, three menu sections"

wordpress.com plugin (/quick-build + /site-specification)
  └─ Extracts site spec  →  siteBrief, layoutNotes, typography
  └─ Runs /preview-designs  →  generates 3 HTML mockups (design-1.html … design-3.html)
  └─ User picks a design
  └─ Task agent builds full WordPress block theme

wordpress-studio MCP (site_create → site_start → wp_cli)
  └─ Creates local Studio site
  └─ Starts the dev server
  └─ Activates the generated theme

wordpress-studio-mcp (fs_read_file, db_query, wpcli_plugin_install)
  └─ Reads/edits theme files directly
  └─ Queries the SQLite DB to verify posts/options
  └─ Installs and activates plugins
```

### Iterate on an existing site

```
User: "Add a WooCommerce shop to my site, fix the broken styles in style.css"

wordpress-studio-mcp
  └─ fs_read_file      →  reads the current style.css
  └─ fs_write_file     →  writes the fixed version
  └─ wpcli_plugin_install  →  installs WooCommerce
  └─ db_query          →  checks wp_options for active plugins
  └─ fs_read_error_log →  tails debug.log to spot any PHP errors

wordpress-studio MCP
  └─ take_screenshot   →  captures the result
  └─ preview_create    →  deploys to a shareable WordPress.com URL
```

---

## wordpress.com Plugin — Skill Reference

Install from Claude Code: **Settings → Connectors → Browse → search "wordpress.com"**

The official Automattic plugin adds four AI-powered commands. No MCP server — these are pure Claude agent workflows that use the Studio CLI and filesystem tools.

### `/site-specification`

Extracts a structured site specification from a plain-English description. Returns a confirmed JSON object used by the other commands.

**Output schema:**

```json
{
  "siteBrief": {
    "siteName": "Bean & Brew",
    "siteType": "restaurant",
    "primaryGoal": "Drive in-store visits and online orders",
    "audience": "Local coffee enthusiasts, remote workers",
    "tone": "warm, artisanal, community-focused",
    "brandKeywords": ["cozy", "handcrafted", "local", "sustainable"]
  },
  "layoutNotes": [
    "Hero with full-bleed café atmosphere photo",
    "Menu section with three categories",
    "About story with team photos",
    "Location and hours with embedded map"
  ],
  "typography": {
    "primaryFont": "Playfair Display",
    "secondaryFont": "Lato",
    "usage": "Display for headings, Lato for body and UI",
    "fontImport": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@300;400;700"
  }
}
```

**Inference rules by site type:**

| Site Type | Typography | Primary Goal |
|---|---|---|
| SaaS / Tech | Satoshi, Plus Jakarta Sans | Signups, demos |
| E-commerce | Brand-matched | Purchases |
| Professional Services | Serif + clean body | Credibility |
| Restaurant / Food | Playfair Display | Visits, orders |
| Creative / Portfolio | Distinctive display | Showcase work |
| Blog / Media | Readable body font | Engagement, reads |
| Non-profit | Warm, approachable | Awareness, donations |

---

### `/design-site`

Full multi-phase AI orchestration from brief to deployed WordPress theme.

| Phase | What happens |
|---|---|
| **0.5** | Validates Studio CLI, creates or selects local site |
| **0** | Detects new vs. redesign, optionally imports existing content |
| **1** | Extracts site spec via `/site-specification`, defines 3 aesthetic directions |
| **2** | Parallel subagents generate style tiles — design tokens locked into `design-tokens.json` |
| **3** | Three page layout variations generated using locked tokens |
| **4** | Full HTML mockups for every planned page with realistic content |
| **5** | Approved mockup converted to complete WordPress block theme, deployed to Studio site |

**Key rules:** no emojis in designs, core blocks only (no `wp:html`), theme slug must match `^[a-z0-9-]+$`, design tokens are immutable once set.

---

### `/preview-designs`

Generates three visually distinct design directions as standalone HTML files, each with inline CSS and Google Fonts. No external dependencies.

**Each direction includes:** name, vision statement, hero composition, color strategy, typography pairing, layout philosophy, motion personality.

**Diversity rules:** vary color temperature, typographic voice, and hero layout across the three options. Output: `design-1.html`, `design-2.html`, `design-3.html` opened in browser.

---

### `/quick-build`

Fastest path from description to deployed site. Runs `/site-specification` → `/preview-designs` → theme generation → Studio deployment in one command.

```
User:  /quick-build "SaaS landing page for a project management tool, dark mode, modern"

→  site spec extracted
→  3 design previews generated
→  user picks one
→  full block theme built (theme.json, style.css, functions.php, templates)
→  theme activated on local Studio site
```

---

## This Project — `wordpress-studio-mcp` · 27 Tools

### Requirements

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 22.5.0 | Built-in `node:sqlite` — no Python or native compilation |
| [WordPress Studio](https://developer.wordpress.com/studio/) | 1.7.7 | Provides local site runtime |
| [Claude Desktop](https://claude.ai/download) or [Claude Code](https://claude.ai/code) | latest | |

---

## Install — Claude Desktop

### Step 1 — Clone and build

```powershell
git clone https://github.com/movinginfo/wordpress-studio-mcp.git "C:\Work\wordpress-studio-mcp"
cd "C:\Work\wordpress-studio-mcp"
npm install
npm run build
```

Verify the build:

```powershell
node "C:\Work\wordpress-studio-mcp\dist\index.js"
# Shows startup banner then waits — press Ctrl+C to exit
```

### Step 2 — Edit `claude_desktop_config.json`

```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

Add both MCP servers:

```json
{
  "mcpServers": {
    "wordpress-studio-mcp": {
      "command": "node",
      "args": [
        "C:\\Work\\wordpress-studio-mcp\\dist\\index.js"
      ],
      "env": {
        "STUDIO_HOME": "C:\\Users\\YourName\\.studio",
        "STUDIO_SITES_ROOT": "C:\\Users\\YourName\\Studio\\sites"
      }
    },
    "wordpress-studio": {
      "command": "npx",
      "args": ["-y", "wp-studio@latest", "mcp"]
    }
  }
}
```

> Replace `YourName` with your Windows username. If you already have other entries in `mcpServers`, add these two alongside them.

### Step 3 — Install the wordpress.com plugin

Open Claude Desktop → **Settings → Connectors → Browse plugins** → search **"wordpress.com"** → Install.

This adds the `/design-site`, `/preview-designs`, `/quick-build`, and `/site-specification` commands.

### Step 4 — Restart and verify

Fully quit Claude Desktop (system tray → Quit) and reopen.

Click the **⊕ plug icon** in the chat input — you should see:

```
✓ wordpress-studio-mcp    27 tools
✓ wordpress-studio        13 tools
```

And in the sidebar under **Plugins**:

```
✓ wordpress.com   (Automattic)
```

---

## Install — Claude Code (IDE / CLI)

### Step 1 — Clone and build

```powershell
git clone https://github.com/movinginfo/wordpress-studio-mcp.git "C:\Work\wordpress-studio-mcp"
cd "C:\Work\wordpress-studio-mcp"
npm install
npm run build
```

### Step 2 — Register MCP servers

```powershell
# This extension — 27 tools
claude mcp add --scope user wordpress-studio-mcp `
    --env "STUDIO_HOME=C:\Users\$env:USERNAME\.studio" `
    --env "STUDIO_SITES_ROOT=C:\Users\$env:USERNAME\Studio\sites" `
    -- node "C:\Work\wordpress-studio-mcp\dist\index.js"

# Official Studio MCP — 13 tools
claude mcp add --scope user wordpress-studio `
    -- npx -y wp-studio@latest mcp
```

### Step 3 — Install the wordpress.com plugin

```powershell
# From the Claude Code CLI
claude plugins install wordpress.com
```

Or in the IDE: open the **Plugins** panel → Browse → search **"wordpress.com"** → Install.

### Step 4 — Verify

```powershell
claude mcp list
```

Then type `/mcp` inside Claude Code — both servers should show green. Type `/` to see the available commands including `/quick-build`, `/design-site`, etc.

### Alternative — edit `~/.claude/settings.json` directly

```powershell
notepad "$env:USERPROFILE\.claude\settings.json"
```

Add inside `mcpServers`:

```json
{
  "mcpServers": {
    "wordpress-studio-mcp": {
      "command": "node",
      "args": ["C:\\Work\\wordpress-studio-mcp\\dist\\index.js"],
      "env": {
        "STUDIO_HOME": "C:\\Users\\YourName\\.studio",
        "STUDIO_SITES_ROOT": "C:\\Users\\YourName\\Studio\\sites"
      },
      "type": "stdio"
    },
    "wordpress-studio": {
      "command": "npx",
      "args": ["-y", "wp-studio@latest", "mcp"],
      "type": "stdio"
    }
  }
}
```

---

## Environment Variables

| Variable | Default (Windows) | Description |
|---|---|---|
| `STUDIO_HOME` | `%USERPROFILE%\.studio` | Studio config directory (`cli.json`, `shared.json`) |
| `STUDIO_SITES_ROOT` | `%USERPROFILE%\Studio\sites` | Root folder where Studio stores local site files |

Find your actual paths:

```powershell
ls "$env:USERPROFILE\.studio"       # should contain cli.json
ls "$env:USERPROFILE\Studio\sites"  # list of your local sites
```

---

## Tool Reference

### `wordpress-studio` · 13 tools · Automattic (`wp-studio@1.7.7`)

| Tool | Description |
|---|---|
| `site_create` | Create a new local Studio site |
| `site_list` | List all local sites with status |
| `site_info` | Detailed info for a specific site |
| `site_start` | Start a local site server |
| `site_stop` | Stop a local site server |
| `site_delete` | Delete a site (optionally including files) |
| `preview_create` | Deploy to WordPress.com for a shareable preview link |
| `preview_list` | List active preview environments |
| `preview_update` | Redeploy changes to an existing preview |
| `preview_delete` | Remove a preview environment |
| `wp_cli` | Run any WP-CLI command on a local site |
| `validate_blocks` | Validate Gutenberg block markup |
| `take_screenshot` | Screenshot a running site (desktop 1040 px + mobile 390 px) |

### `wordpress-studio-mcp` · 27 tools · this project

#### Site Registry & Status

| Tool | Description |
|---|---|
| `studio_registry` | Full site list from `~/.studio/cli.json` — paths, ports, auto-login URLs |
| `studio_auth_status` | WordPress.com OAuth token status (no token value returned) |
| `studio_daemon_status` | Check if Studio process daemon is running |
| `studio_disk_usage` | Disk size for one or all site directories |
| `studio_site_health` | HTTP health check — status code, response time, WP headers |
| `studio_config_dump` | Raw Studio config files — all secrets redacted |

#### Filesystem

| Tool | Description |
|---|---|
| `fs_read_file` | Read any file inside a site (max 2 MB) |
| `fs_write_file` | Write or create a file — parent directories created automatically |
| `fs_list_dir` | List a directory, optionally recursive (up to depth 4) |
| `fs_find_files` | Glob search within a site, e.g. `**/*.php` or `wp-content/themes/**` |
| `fs_read_wp_config` | Read `wp-config.php` — passwords and secret keys always redacted |
| `fs_read_error_log` | Read `wp-content/debug.log` — last N lines (default: 100) |

#### SQLite Database

| Tool | Description |
|---|---|
| `db_list_tables` | List all tables in the site's `.ht.sqlite` database |
| `db_describe_table` | Column names, types, constraints, and CREATE SQL |
| `db_query` | Execute a SELECT query — read-only, enforced server-side |
| `db_execute` | Execute a write statement — INSERT / UPDATE / DELETE |
| `db_export_sql` | Full SQL dump — schema + INSERT rows for all tables |

#### WP-CLI Helpers

| Tool | Description |
|---|---|
| `wpcli_plugin_list` | List installed plugins with status and version |
| `wpcli_plugin_install` | Install and optionally activate a plugin from wordpress.org |
| `wpcli_plugin_deactivate` | Deactivate a plugin, optionally delete it |
| `wpcli_theme_list` | List all installed themes |
| `wpcli_theme_activate` | Activate a theme by slug |
| `wpcli_user_list` | List all users with login, email, and roles |
| `wpcli_create_admin` | Create a new administrator user |
| `wpcli_search_replace` | Database search-replace — dry-run by default, confirm to apply |
| `wpcli_cache_flush` | Flush object cache, rewrite rules, and all transients |
| `wpcli_core_update` | Update WordPress core to latest or a specific version |
| `wpcli_run` | Run any WP-CLI command — full passthrough via `studio wp` |

---

## Example Prompts

```
# Full workflow — design to deployed site
/quick-build "portfolio site for a freelance photographer, minimal dark aesthetic"

# Design iteration
/preview-designs "redesign the hero for more urgency and contrast"

# Site inspection
Show me all my local WordPress Studio sites and their disk usage

# Theme development
Read the functions.php from the active theme on site "my-shop"
Find all PHP files in the active theme on site "my-shop"

# Database
Show me all published posts from the "my-shop" database
Export the full "my-shop" database as a SQL dump

# Plugins
Install WooCommerce on site "my-shop" and activate it
List all active plugins on site "my-shop"

# Debugging
Show the last 100 lines of the error log for site "my-shop"
Flush all caches on site "my-shop"

# Migration
Dry-run search-replace from http://my-shop.local to https://myshop.com on site "my-shop"
```

---

## Key Paths

```
Windows
│
├── %APPDATA%\Claude\
│   └── claude_desktop_config.json     ← Claude Desktop MCP config
│
├── %USERPROFILE%\.claude\
│   └── settings.json                  ← Claude Code CLI MCP config
│
├── %USERPROFILE%\.studio\
│   ├── cli.json                        Site registry
│   ├── shared.json                     OAuth token, locale
│   └── app.json                        Electron app data
│
└── %USERPROFILE%\Studio\sites\
    └── {site-name}\
        ├── wp-config.php
        └── wp-content\
            ├── database\
            │   └── .ht.sqlite          SQLite database (db_* tools)
            ├── plugins\
            ├── themes\
            └── debug.log               PHP error log (fs_read_error_log)
```

---

## Project Structure

```
wordpress-studio-mcp/
├── src/
│   ├── index.ts                  MCP server entry point (stdio transport)
│   ├── studio-config.ts          Reads ~/.studio/cli.json, path safety guard
│   └── tools/
│       ├── site-registry.ts      studio_registry, studio_daemon_status …
│       ├── filesystem.ts         fs_read_file, fs_write_file, fs_find_files …
│       ├── database.ts           db_query, db_execute, db_export_sql …
│       └── wpcli.ts              wpcli_plugin_list, wpcli_run …
│
├── dist/                         Compiled JS — generated by npm run build
│
├── .claude-plugin/
│   ├── plugin.json               Claude Code plugin metadata
│   └── marketplace.json          Claude Code marketplace registration
│
├── .mcp.json                     MCP definition for Claude Code plugin system
├── setup.ps1                     Automated Windows setup script
├── package.json
├── tsconfig.json
└── LICENSE
```

---

## Security

- **Path sandboxing** — filesystem tools verify the resolved path is inside `STUDIO_SITES_ROOT`. Directory traversal is blocked at the server level.
- **Secrets redaction** — `wp-config.php` passwords, keys, and salts are stripped before output. Config dumps redact all fields matching `password`, `token`, `key`, `secret`, or `salt`.
- **Read-only SQL enforcement** — `db_query` rejects any statement not starting with `SELECT` or `WITH`. Write access is explicit via `db_execute`.
- **No native binaries** — uses Node.js built-in `node:sqlite` (stable since v22.5). No Python, no `node-gyp`, no compiled `.node` files.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Servers not in Connectors | Fully quit Claude Desktop (system tray → Quit) and reopen |
| Red dot next to server name | Click it to read the error — usually a wrong path in `args` |
| `Cannot find module 'dist/index.js'` | Run `npm run build` in the project directory |
| `SQLite DB not found` | Start the site first: use `site_start` tool or run `studio site start` |
| `studio: command not found` | Studio Desktop → Settings → Studio CLI → Save, restart terminal |
| Node.js version error | Run `node --version` — needs ≥ 22.5.0 |
| `wp-studio mcp` fails | Run `npx wp-studio@latest --version` to verify the package installs |
| `/quick-build` can't find Studio | Ensure the Studio CLI is enabled and `studio --version` works in your terminal |

---

## Development

```powershell
# Development mode — runs TypeScript directly, no build needed
npm run dev

# Production build
npm run build

# Clean dist/
npm run clean
```

---

## Related

- [wordpress.com Claude plugin](https://github.com/Automattic/claude-code-wordpress.com) — official Automattic plugin (skills: `/design-site`, `/quick-build`, `/preview-designs`)
- [WordPress Studio](https://developer.wordpress.com/studio/) — local WordPress development environment
- [wp-studio CLI](https://www.npmjs.com/package/wp-studio) — official Studio CLI npm package (v1.7.7) by Automattic
- [Studio CLI docs](https://developer.wordpress.com/docs/developer-tools/studio/cli/) — full CLI command reference
- [Model Context Protocol](https://modelcontextprotocol.io) — MCP specification

---

## License

[MIT](LICENSE) © 2026 movinginfo
