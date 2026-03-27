# WordPress Studio MCP Plugin for Claude Code

A hybrid [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that connects **Claude Code** to [WordPress Studio 1.7.7](https://developer.wordpress.com/studio/) — giving Claude direct access to your local WordPress sites: filesystem, SQLite database, WP-CLI, and site registry.

Works alongside the Studio built-in MCP and the remote WordPress.com MCP for a total of **54 tools** across 3 servers.

---

## Overview

```
Claude Code
│
├── 🌐 wordpress-com          REMOTE   OAuth 2.1 PKCE  →  public-api.wordpress.com
│                                                          14 tools (posts, stats, plugins…)
│
├── 🖥  wordpress-studio       LOCAL    stdio            →  studio mcp  (built-in)
│                                                          13 tools (site lifecycle, WP-CLI, preview…)
│
└── 🔧 wordpress-studio-ext   LOCAL    stdio            →  node dist/index.js  (this project)
                                                           27 tools (filesystem, SQLite, WP-CLI helpers…)
```

---

## Features

### Site Registry & Status (6 tools)
- Full site list from `~/.studio/cli.json` — names, paths, ports, auto-login URLs
- WordPress.com OAuth token status check
- Studio daemon health via named pipe / Unix socket
- Per-site disk usage reporting
- HTTP health check with response time and WP headers
- Raw config dump with secrets always redacted

### Filesystem (6 tools)
- Read any file inside a Studio site (theme, plugin, config) — 2 MB limit
- Write / create files with automatic parent directory creation
- List directories (flat or recursive up to depth 4)
- Glob search within a site, e.g. `**/*.php`
- Read `wp-config.php` with passwords and secret keys redacted
- Read `wp-content/debug.log` (last N lines)

### SQLite Database (5 tools)
- List all tables in the site's `.ht.sqlite` database
- Inspect column schema, types, and constraints
- Execute read-only SELECT queries (enforced)
- Execute write SQL — INSERT / UPDATE / DELETE
- Export full SQL dump (schema + INSERT rows)

### WP-CLI Helpers (11 tools)
- Plugin list, install, deactivate/delete
- Theme list, activate
- User list, create administrator
- Database search-replace (dry-run by default)
- Cache, rewrite, and transient flush
- WordPress core update
- Raw WP-CLI passthrough — any command

---

## Prerequisites

| Requirement | Minimum | Install |
|---|---|---|
| [Node.js](https://nodejs.org) | v22.0.0 | https://nodejs.org |
| [WordPress Studio](https://developer.wordpress.com/studio/) | 1.7.7 | Download from developer.wordpress.com |
| Studio CLI | enabled | Studio → Settings → Studio CLI → Save |
| [Claude Code](https://claude.ai/code) | latest | https://claude.ai/code |

---

## Quick Start

```powershell
git clone https://github.com/YOUR_USERNAME/wordpress-studio-mcp.git
cd wordpress-studio-mcp
.\setup.ps1
```

Restart Claude Code, then type `/mcp` — all 3 servers should show as connected.

---

## Manual Setup

### 1. Install and build

```powershell
npm install
npm run build
```

### 2. Register MCP servers

```powershell
# Remote WordPress.com (HTTP + OAuth 2.1)
claude mcp add --transport http --scope user wordpress-com `
    -- https://public-api.wordpress.com/wpcom/v2/mcp/v1

# Studio built-in (stdio)
claude mcp add --scope user wordpress-studio -- studio mcp

# This extension (stdio) — update the path to match your clone location
claude mcp add --scope user wordpress-studio-ext `
    --env "STUDIO_HOME=$env:USERPROFILE\.studio" `
    --env "STUDIO_SITES_ROOT=$env:USERPROFILE\Studio\sites" `
    -- node "C:\path\to\wordpress-studio-mcp\dist\index.js"
```

### 3. Authenticate to WordPress.com

```powershell
studio auth login
```

### 4. Verify

```powershell
claude mcp list
```

---

## Project Structure

```
wordpress-studio-mcp/
│
├── src/
│   ├── index.ts                  MCP server entry (stdio transport)
│   ├── studio-config.ts          Reads ~/.studio/cli.json, resolves site paths
│   └── tools/
│       ├── site-registry.ts      studio_registry, studio_auth_status …
│       ├── filesystem.ts         fs_read_file, fs_write_file …
│       ├── database.ts           db_query, db_execute, db_export_sql …
│       └── wpcli.ts              wpcli_plugin_list, wpcli_run …
│
├── dist/                         Compiled JS (after npm run build)
├── .mcp.json                     Claude Code MCP config (all 3 servers)
├── setup.ps1                     One-command Windows setup
├── package.json
└── tsconfig.json
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `STUDIO_HOME` | `~/.studio` | Studio config directory |
| `STUDIO_SITES_ROOT` | `~/Studio/sites` | Root directory for local sites |

---

## Key Paths (Windows)

```
%USERPROFILE%\
├── .studio\
│   ├── cli.json           Site registry (id, name, path, port, phpVersion…)
│   ├── shared.json        OAuth token, locale, selected skills
│   └── app.json           Electron app data
│
└── Studio\
    └── sites\
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

## Example Prompts

```
# List all local Studio sites
"Show me all my local WordPress Studio sites"

# Create a site and install WooCommerce
"Create a new Studio site called 'my-shop', start it, then install and activate WooCommerce"

# Inspect a theme file
"Read the functions.php from the active theme on my 'my-shop' site"

# Query the database
"Show me all published posts from the 'my-shop' site database"

# Check the error log
"Show me the last 50 lines of the WordPress debug log for site 'my-shop'"

# URL migration (dry run)
"Dry-run search-replace http://my-shop.wp.local → https://myshop.com on site my-shop"

# WordPress.com stats (remote)
"Show me traffic stats for mysite.wordpress.com for the last 7 days"

# Screenshot
"Take a screenshot of my running 'my-shop' site"
```

---

## Complete Tool Reference

### Part A — `wordpress-com` (14 tools, remote HTTP)

| Tool | Description |
|---|---|
| `wpcom-mcp-content-authoring` | Create/update/delete posts, pages, comments, media, categories, tags |
| `wpcom-mcp-posts-search` | Search posts across WordPress.com sites |
| `wpcom-mcp-post-get` | Get a single post by ID or URL |
| `wpcom-mcp-site-settings` | Read all site configuration settings |
| `wpcom-mcp-site-statistics` | Views, visitors, top content, referrers, geo, devices |
| `wpcom-mcp-site-plugins` | Installed plugins list |
| `wpcom-mcp-site-editor-context` | Theme presets (colors, fonts), registered blocks |
| `wpcom-mcp-user-sites` | All your WordPress.com sites |
| `wpcom-mcp-user-profile` | Your profile data |
| `wpcom-mcp-user-connections` | Social/service integrations |
| `wpcom-mcp-user-notifications` | Notification settings |
| `wpcom-mcp-user-notifications-inbox` | Notification inbox with filters |
| `wpcom-mcp-site-users` | Site user list with roles |
| `wpcom-mcp-user-security` | 2FA, sessions, application passwords |

### Part B — `wordpress-studio` (13 tools, local stdio)

| Tool | Description |
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
| `wp_cli` | Run any WP-CLI command |
| `validate_blocks` | Validate Gutenberg block markup |
| `take_screenshot` | Screenshot a running site |

### Part C — `wordpress-studio-ext` (27 tools, this project)

**Site Registry & Status**

| Tool | Description |
|---|---|
| `studio_registry` | Full site list with paths, ports, auto-login URLs |
| `studio_auth_status` | WordPress.com OAuth token status |
| `studio_daemon_status` | Check if Studio daemon is running |
| `studio_disk_usage` | Disk size per site directory |
| `studio_site_health` | HTTP health check on a running site |
| `studio_config_dump` | Raw Studio config files (secrets redacted) |

**Filesystem**

| Tool | Description |
|---|---|
| `fs_read_file` | Read any file in a site (max 2 MB) |
| `fs_write_file` | Write/create a file (creates parent dirs) |
| `fs_list_dir` | List directory, optionally recursive |
| `fs_find_files` | Glob search within a site |
| `fs_read_wp_config` | Read `wp-config.php` (passwords redacted) |
| `fs_read_error_log` | Read `debug.log` (last N lines) |

**SQLite Database**

| Tool | Description |
|---|---|
| `db_list_tables` | List all tables in `.ht.sqlite` |
| `db_describe_table` | Column schema, types, constraints |
| `db_query` | SELECT queries (read-only, enforced) |
| `db_execute` | Write SQL — INSERT / UPDATE / DELETE |
| `db_export_sql` | Full SQL dump (schema + INSERT rows) |

**WP-CLI Helpers**

| Tool | Description |
|---|---|
| `wpcli_plugin_list` | List plugins with status and version |
| `wpcli_plugin_install` | Install + activate from wordpress.org |
| `wpcli_plugin_deactivate` | Deactivate (optionally delete) a plugin |
| `wpcli_theme_list` | List installed themes |
| `wpcli_theme_activate` | Activate a theme |
| `wpcli_user_list` | List users with roles |
| `wpcli_create_admin` | Create an administrator user |
| `wpcli_search_replace` | DB search-replace (dry-run by default) |
| `wpcli_cache_flush` | Flush cache, rewrites, and transients |
| `wpcli_core_update` | Update WordPress core |
| `wpcli_run` | Raw WP-CLI passthrough — any command |

---

## Security

- All filesystem operations are sandboxed to `STUDIO_SITES_ROOT` — path traversal is blocked.
- `wp-config.php` passwords, secret keys, and salts are always redacted before returning.
- Studio config dumps redact all token, password, key, secret, and salt fields.
- `db_query` enforces SELECT / WITH only — write operations go through `db_execute` explicitly.
- No credentials are ever logged or returned in plain text.

---

## OAuth 2.1 Flow (Part A — handled automatically by Claude Code)

```
1. POST  /oauth2-1/register     → dynamic client_id  (public client, no secret)
2. GET   /oauth2-1/authorize    → browser consent     (PKCE, code_challenge S256)
3. POST  /oauth2-1/token        → access_token        (code + code_verifier)
4. POST  /wpcom/v2/mcp/v1       → Authorization: Bearer {access_token}
```

Token refresh is handled automatically by Claude Code.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `studio: command not found` | Studio → Settings → Studio CLI → Save, restart terminal |
| `SQLite DB not found` | Start the site first: `studio site start` or `site_start` tool |
| `wordpress-com` returns 401 | Run `studio auth login` to refresh the OAuth token |
| Build fails | Check Node.js version: `node --version` (needs v22+) |
| Extension fails to start | `npm run build` then `node dist/index.js` to see errors |
| Servers not showing in `/mcp` | Restart Claude Code |

---

## Development

```powershell
# Watch mode (no build step needed)
npm run dev

# Production build
npm run build

# Clean build artifacts
npm run clean
```

---

## License

[MIT](LICENSE)

---

## Contributing

Issues and pull requests are welcome. Please open an issue first to discuss any significant changes.
