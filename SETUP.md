# WordPress Studio 1.7.7 — MCP Plugin Connector for Claude Code

**Project folder:** `c:\Work\Wordpress Studio MCP Plugin for Claude Code\`

---

## Architecture

```
Claude Code
│
├── 🌐 wordpress-com          REMOTE   OAuth 2.1 PKCE  →  public-api.wordpress.com/wpcom/v2/mcp/v1
│                                                          14 tools (posts, pages, stats, plugins…)
│
├── 🖥  wordpress-studio       LOCAL    stdio            →  studio mcp  (Studio CLI built-in)
│                                                          13 tools (site lifecycle, WP-CLI, preview…)
│
└── 🔧 wordpress-studio-ext   LOCAL    stdio            →  node dist/index.js  (this project)
                                                           27 tools (filesystem, SQLite, WP-CLI helpers…)
```

---

## Quick Start

```powershell
cd "c:\Work\Wordpress Studio MCP Plugin for Claude Code"
.\setup.ps1
```

Restart Claude Code, then type `/mcp` — all 3 servers should be green.

---

## Prerequisites

| # | Requirement | Minimum | Check | Install |
|---|---|---|---|---|
| 1 | Node.js | v22.0.0 | `node --version` | https://nodejs.org |
| 2 | Studio CLI | 1.7.7 | `studio --version` | Studio → Settings → Studio CLI |
| 3 | Claude Code | latest | `claude --version` | https://claude.ai/code |

---

## Manual Setup (step by step)

### 1 — Build

```powershell
cd "c:\Work\Wordpress Studio MCP Plugin for Claude Code"
npm install
npm run build
# Output: dist/index.js
```

### 2 — Register MCP servers

```powershell
# Part A — Remote WordPress.com (HTTP + OAuth 2.1)
claude mcp add --transport http --scope user wordpress-com `
    -- https://public-api.wordpress.com/wpcom/v2/mcp/v1

# Part B — Studio built-in (stdio)
claude mcp add --scope user wordpress-studio -- studio mcp

# Part C — Hybrid extension (stdio)
claude mcp add --scope user wordpress-studio-ext `
    --env "STUDIO_HOME=C:\Users\Користувач\.studio" `
    --env "STUDIO_SITES_ROOT=C:\Users\Користувач\Studio\sites" `
    -- node "c:\Work\Wordpress Studio MCP Plugin for Claude Code\dist\index.js"
```

### 3 — Authenticate

```powershell
studio auth login   # opens browser OAuth consent page
```

### 4 — Verify

```powershell
claude mcp list   # should list all 3 servers
```

---

## File Structure

```
c:\Work\Wordpress Studio MCP Plugin for Claude Code\
│
├── src/
│   ├── index.ts                  MCP server entry point (stdio transport)
│   ├── studio-config.ts          Reads ~/.studio/cli.json, resolves site paths
│   └── tools/
│       ├── site-registry.ts      studio_registry, studio_auth_status, studio_daemon_status …
│       ├── filesystem.ts         fs_read_file, fs_write_file, fs_list_dir …
│       ├── database.ts           db_query, db_execute, db_list_tables, db_export_sql …
│       └── wpcli.ts              wpcli_plugin_list, wpcli_run, wpcli_search_replace …
│
├── dist/                         Compiled JS (after npm run build)
│   └── index.js                  ← node runs this
│
├── package.json
├── tsconfig.json
├── .mcp.json                     Claude Code MCP config (all 3 servers)
├── setup.ps1                     One-command Windows setup
└── SETUP.md                      This file
```

---

## Complete Tool Reference (54 tools)

### 🌐 Part A — wordpress-com (14 tools, remote)

| Tool | What it does |
|---|---|
| `wpcom-mcp-content-authoring` | Create / update / delete posts, pages, comments, media, categories, tags |
| `wpcom-mcp-posts-search` | Search posts across WordPress.com sites |
| `wpcom-mcp-post-get` | Get a single post by ID or URL |
| `wpcom-mcp-site-settings` | Read all site configuration settings |
| `wpcom-mcp-site-statistics` | Views, visitors, top content, referrers, geo, devices |
| `wpcom-mcp-site-plugins` | Installed plugins list |
| `wpcom-mcp-site-editor-context` | Theme presets (colors, fonts), registered blocks |
| `wpcom-mcp-user-sites` | All your WordPress.com sites |
| `wpcom-mcp-user-profile` | Your profile data |
| `wpcom-mcp-user-connections` | Social/service integrations |
| `wpcom-mcp-user-notifications` | Notification settings & inbox |
| `wpcom-mcp-user-notifications-inbox` | Notification inbox with filters |
| `wpcom-mcp-site-users` | Site user list with roles |
| `wpcom-mcp-user-security` | 2FA, sessions, application passwords |

### 🖥 Part B — wordpress-studio (13 tools, local built-in)

| Tool | What it does |
|---|---|
| `site_create` | Create a new local Studio site |
| `site_list` | List all local sites |
| `site_info` | Get details for a specific site |
| `site_start` | Start a local site server |
| `site_stop` | Stop a local site server |
| `site_delete` | Delete a site (optionally including files) |
| `preview_create` | Deploy site to WordPress.com for preview |
| `preview_list` | List active preview environments |
| `preview_update` | Redeploy changes to preview |
| `preview_delete` | Remove a preview environment |
| `wp_cli` | Run any WP-CLI command on a local site |
| `validate_blocks` | Validate Gutenberg block markup |
| `take_screenshot` | Screenshot a running site (desktop 1040×1248 / mobile 390×844) |

### 🔧 Part C — wordpress-studio-ext (27 tools, hybrid extension)

#### Site Registry & Status (6 tools)
| Tool | What it does |
|---|---|
| `studio_registry` | Full site list from `~/.studio/cli.json` with paths, ports, auto-login URLs |
| `studio_auth_status` | WordPress.com OAuth token status (no token value returned) |
| `studio_daemon_status` | Check if Studio process daemon is running via named pipe |
| `studio_disk_usage` | Disk size per site directory |
| `studio_site_health` | HTTP GET health check on running site (status, response time, WP headers) |
| `studio_config_dump` | Dump Studio config files — passwords always redacted |

#### Filesystem (6 tools)
| Tool | What it does |
|---|---|
| `fs_read_file` | Read any file in a site (theme, plugin, config) — max 2 MB |
| `fs_write_file` | Write / create any file in a site (creates parent dirs) |
| `fs_list_dir` | List directory (optionally recursive up to depth 4) |
| `fs_find_files` | Glob search within a site, e.g. `**/*.php` |
| `fs_read_wp_config` | Read `wp-config.php` with passwords redacted |
| `fs_read_error_log` | Read `wp-content/debug.log` (last N lines) |

#### SQLite Database (5 tools)
| Tool | What it does |
|---|---|
| `db_list_tables` | List all tables in site's `.ht.sqlite` database |
| `db_describe_table` | Column schema, types, constraints for a table |
| `db_query` | SELECT queries (read-only, enforced) |
| `db_execute` | Write SQL — INSERT / UPDATE / DELETE (immediate) |
| `db_export_sql` | Full SQL dump — schema + INSERT rows |

#### WP-CLI Helpers (11 tools)
| Tool | What it does |
|---|---|
| `wpcli_plugin_list` | List plugins with status & version |
| `wpcli_plugin_install` | Install + activate plugin from wordpress.org |
| `wpcli_plugin_deactivate` | Deactivate (optionally delete) a plugin |
| `wpcli_theme_list` | List installed themes |
| `wpcli_theme_activate` | Activate a theme |
| `wpcli_user_list` | List all users with roles |
| `wpcli_create_admin` | Create an administrator user |
| `wpcli_search_replace` | DB search-replace — dry-run by default |
| `wpcli_cache_flush` | Flush cache, rewrites, and transients |
| `wpcli_core_update` | Update WordPress core |
| `wpcli_run` | Raw WP-CLI passthrough — any command |

---

## Key Paths

```
C:\Users\Користувач\
├── .studio\
│   ├── cli.json           Site registry  (id, name, path, port, phpVersion …)
│   ├── shared.json        OAuth token, locale, selected skills
│   ├── app.json           Electron app data
│   └── server-files\      WP-CLI .phar, PHP-WASM binary, SQLite plugin
│
└── Studio\
    └── sites\             ← STUDIO_SITES_ROOT
        └── {site-name}\
            ├── wp-config.php
            └── wp-content\
                ├── database\
                │   └── .ht.sqlite     ← SQLite DB (db_* tools)
                ├── plugins\
                ├── themes\
                └── debug.log          ← Error log (fs_read_error_log)
```

---

## OAuth 2.1 Flow (Part A — handled automatically by Claude Code)

```
1. POST  /oauth2-1/register     → dynamic client_id  (no secret, public client)
2. GET   /oauth2-1/authorize    → browser consent     (PKCE code_challenge S256)
3. POST  /oauth2-1/token        → access_token        (code + code_verifier)
4. POST  /wpcom/v2/mcp/v1       → Authorization: Bearer {access_token}
```

Token refresh is handled automatically by Claude Code.

---

## Example Claude Code Prompts

```
# List all registered local sites
"Show me all my local Studio sites using studio_registry"

# Create a site and install WooCommerce
"Create a new Studio site called 'my-shop', start it, then install and activate WooCommerce"

# Read a theme file
"Read the functions.php from the 'mytheme' theme on my 'my-shop' site"

# Query the database
"Show me all published posts from the 'my-shop' site database"

# Check an error log
"Show me the last 50 lines of the WordPress error log for site 'my-shop'"

# Search-replace dry run
"Dry-run search-replace http://my-shop.wp.local → https://myshop.com on site my-shop"

# WordPress.com stats (remote)
"Show me traffic statistics for mysite.wordpress.com for the last 7 days"
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `studio: command not found` | Studio → Settings → Studio CLI → Save, restart terminal |
| `SQLite DB not found` | Start the site first: `site_start` or `studio site start` |
| `wordpress-com` returns 401 | `studio auth login` to refresh OAuth token |
| Extension fails to start | `npm run build` → `node dist/index.js` to see stderr |
| Servers not showing | Restart Claude Code, then `/mcp` |
