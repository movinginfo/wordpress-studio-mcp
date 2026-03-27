# WordPress Studio MCP

> Connect Claude to your local WordPress sites — read files, query databases, run WP-CLI commands, and inspect site status directly from Claude Desktop or Claude Code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v22.5%2B-green.svg)](https://nodejs.org)
[![WordPress Studio](https://img.shields.io/badge/WordPress%20Studio-1.7.7-3858e9.svg)](https://developer.wordpress.com/studio/)
[![MCP](https://img.shields.io/badge/MCP-stdio-orange.svg)](https://modelcontextprotocol.io)
[![GitHub](https://img.shields.io/badge/GitHub-movinginfo%2Fwordpress--studio--mcp-black.svg)](https://github.com/movinginfo/wordpress-studio-mcp)

---

## What it does

This project adds **27 MCP tools** to Claude that give it direct, sandboxed access to any local WordPress site managed by [WordPress Studio 1.7.7](https://developer.wordpress.com/studio/):

| Category | Tools | Examples |
|---|---|---|
| **Site Registry** | 6 | List sites, check daemon, disk usage, health check |
| **Filesystem** | 6 | Read/write theme & plugin files, search with glob |
| **SQLite Database** | 5 | Query, execute SQL, export dump |
| **WP-CLI Helpers** | 11 | Install plugins, manage users, search-replace |

Pairs with the official [`wp-studio`](https://www.npmjs.com/package/wp-studio) package to add **13 more tools** (site lifecycle, previews, screenshots) — **40 tools total** across 2 MCP servers.

---

## Requirements

| Requirement | Version | How to get |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 22.5.0 | [nodejs.org](https://nodejs.org) — needed for built-in `node:sqlite` |
| [WordPress Studio](https://developer.wordpress.com/studio/) | 1.7.7 | [developer.wordpress.com/studio](https://developer.wordpress.com/studio/) |
| [Claude Desktop](https://claude.ai/download) **or** [Claude Code](https://claude.ai/code) | latest | See install guides below |

> **Windows only** — paths in this guide use Windows conventions. macOS/Linux paths follow the same pattern with forward slashes and `~/` home prefix.

---

## Install — Claude Desktop

Claude Desktop reads MCP servers from `claude_desktop_config.json`.

### Step 1 — Clone and build

Open **PowerShell** and run:

```powershell
git clone https://github.com/movinginfo/wordpress-studio-mcp.git "C:\Work\wordpress-studio-mcp"
cd "C:\Work\wordpress-studio-mcp"
npm install
npm run build
```

You should see `dist/index.js` created. Verify:

```powershell
node "C:\Work\wordpress-studio-mcp\dist\index.js"
# Expected output: startup banner on stderr, then waits for MCP input
# Press Ctrl+C to exit
```

### Step 2 — Edit `claude_desktop_config.json`

Open the config file:

```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

Add the two servers under `mcpServers` (create the file if it does not exist):

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

> Replace `YourName` with your actual Windows username.
> If you already have other servers in `mcpServers`, just add the two new entries alongside them.

### Step 3 — Restart Claude Desktop

Fully quit Claude Desktop (system tray → Quit) and reopen it.

### Step 4 — Verify

Click the **plug icon** (⊕) in the bottom-left corner of the chat input.
You should see both servers listed as Connectors:

```
✓ wordpress-studio-mcp    27 tools
✓ wordpress-studio        13 tools
```

If a server shows a red dot, click it to see the error — most commonly a wrong path in `args`.

---

## Install — Claude Code (IDE / CLI)

Claude Code reads MCP servers from `~/.claude/settings.json`.

### Step 1 — Clone and build

```powershell
git clone https://github.com/movinginfo/wordpress-studio-mcp.git "C:\Work\wordpress-studio-mcp"
cd "C:\Work\wordpress-studio-mcp"
npm install
npm run build
```

### Step 2 — Register servers with `claude mcp add`

Open a terminal where the `claude` CLI is available and run:

```powershell
# Server A — this extension (27 tools)
claude mcp add --scope user wordpress-studio-mcp `
    --env "STUDIO_HOME=C:\Users\$env:USERNAME\.studio" `
    --env "STUDIO_SITES_ROOT=C:\Users\$env:USERNAME\Studio\sites" `
    -- node "C:\Work\wordpress-studio-mcp\dist\index.js"

# Server B — official Studio MCP via wp-studio (13 tools)
claude mcp add --scope user wordpress-studio `
    -- npx -y wp-studio@latest mcp
```

### Step 3 — Verify

```powershell
claude mcp list
```

Expected output:

```
wordpress-studio-mcp   node C:\Work\wordpress-studio-mcp\dist\index.js
wordpress-studio       npx -y wp-studio@latest mcp
```

Then open Claude Code and type `/mcp` — both servers should show as connected with green status.

### Alternative — edit `settings.json` directly

If `claude mcp add` is not available, edit `~/.claude/settings.json` manually:

```powershell
notepad "$env:USERPROFILE\.claude\settings.json"
```

Add inside `mcpServers`:

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

Both `STUDIO_HOME` and `STUDIO_SITES_ROOT` are optional — the defaults work for a standard Studio install.

| Variable | Default (Windows) | Description |
|---|---|---|
| `STUDIO_HOME` | `%USERPROFILE%\.studio` | Directory containing Studio config files (`cli.json`, `shared.json`) |
| `STUDIO_SITES_ROOT` | `%USERPROFILE%\Studio\sites` | Root folder where Studio stores local site files |

To find your actual paths:

```powershell
# Studio config directory
ls "$env:USERPROFILE\.studio"

# Sites root
ls "$env:USERPROFILE\Studio\sites"
```

---

## Project Structure

```
wordpress-studio-mcp/
├── src/
│   ├── index.ts                  Entry point — creates MCP server, registers all tools
│   ├── studio-config.ts          Reads ~/.studio/cli.json, resolves site paths, path safety guard
│   └── tools/
│       ├── site-registry.ts      studio_registry, studio_auth_status, studio_daemon_status …
│       ├── filesystem.ts         fs_read_file, fs_write_file, fs_list_dir, fs_find_files …
│       ├── database.ts           db_query, db_execute, db_list_tables, db_export_sql …
│       └── wpcli.ts              wpcli_plugin_list, wpcli_run, wpcli_search_replace …
│
├── dist/                         Compiled output — generated by `npm run build`
│
├── .claude-plugin/
│   ├── plugin.json               Claude Code plugin metadata
│   └── marketplace.json          Claude Code marketplace registration
│
├── .mcp.json                     MCP server definition (used by Claude Code plugin system)
├── setup.ps1                     Automated Windows setup script
├── package.json
├── tsconfig.json
└── LICENSE
```

---

## Tool Reference

### Server A — `wordpress-studio` · 13 tools · official Automattic (`wp-studio@1.7.7`)

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

### Server B — `wordpress-studio-mcp` · 27 tools · this project

#### Site Registry & Status

| Tool | Description |
|---|---|
| `studio_registry` | Full site list from `~/.studio/cli.json` — paths, ports, auto-login URLs |
| `studio_auth_status` | WordPress.com OAuth token status (no token value returned) |
| `studio_daemon_status` | Check if Studio process daemon is running via named pipe |
| `studio_disk_usage` | Disk size for one or all site directories |
| `studio_site_health` | HTTP GET health check — status code, response time, WP headers |
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
| `db_describe_table` | Column names, types, constraints, and CREATE SQL for a table |
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
List all my local WordPress Studio sites

Create a new Studio site called "my-shop", start it,
then install and activate WooCommerce

Read the functions.php file from the active theme on site "my-shop"

Show me all published posts from the "my-shop" database

Export the full "my-shop" database as a SQL dump

Show the last 100 lines of the WordPress error log for site "my-shop"

Dry-run a search-replace from http://my-shop.local to https://myshop.com on site "my-shop"

Take a screenshot of the running "my-shop" site

Install the WooCommerce Stripe plugin on "my-shop" and activate it

Flush all caches on site "my-shop"
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

## Security

- **Path sandboxing** — all filesystem tools verify the resolved path starts with `STUDIO_SITES_ROOT`. Directory traversal is blocked.
- **Secrets redaction** — `wp-config.php` passwords, secret keys, and salts are stripped before any output. Studio config dumps redact all fields matching `password`, `token`, `key`, `secret`, or `salt`.
- **Read-only enforcement** — `db_query` rejects any statement that does not start with `SELECT` or `WITH`. Write access is explicit via `db_execute`.
- **No native binaries** — uses Node.js built-in `node:sqlite` (stable since v22.5). No Python, no `node-gyp`, no prebuilt `.node` files.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Servers not in Connectors after config edit | Fully quit Claude Desktop (system tray → Quit) and reopen |
| Red dot next to server name | Click the dot to read the error — usually a wrong file path |
| `Cannot find module 'dist/index.js'` | Run `npm run build` in the project directory |
| `SQLite DB not found` | Start the site first: use `site_start` tool or `studio site start` |
| `studio: command not found` | Studio Desktop → Settings → Studio CLI → Save, then restart terminal |
| Node.js version error | Run `node --version` — needs ≥ 22.5.0 for `node:sqlite` |
| `wp-studio mcp` fails | Run `npx wp-studio@latest --version` to verify the package downloads |

---

## Development

```powershell
# Development mode — runs TypeScript directly via tsx, no build needed
npm run dev

# Production build — compiles TypeScript to dist/
npm run build

# Remove dist/ folder
npm run clean
```

---

## Related

- [WordPress Studio](https://developer.wordpress.com/studio/) — local WordPress development environment by Automattic
- [wp-studio CLI](https://www.npmjs.com/package/wp-studio) — official Studio CLI npm package (v1.7.7)
- [Studio CLI docs](https://developer.wordpress.com/docs/developer-tools/studio/cli/) — full CLI reference
- [Model Context Protocol](https://modelcontextprotocol.io) — MCP specification

---

## License

[MIT](LICENSE) © 2026 movinginfo
