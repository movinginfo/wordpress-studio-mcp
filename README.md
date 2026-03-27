# WordPress Studio MCP Plugin for Claude Code

A hybrid [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that connects **Claude Desktop** and **Claude Code** to [WordPress Studio 1.7.7](https://developer.wordpress.com/studio/) — giving Claude direct access to your local WordPress sites: filesystem, SQLite database, WP-CLI helpers, and site registry.

Pairs with the official [`wp-studio`](https://www.npmjs.com/package/wp-studio) CLI MCP for a total of **40 tools** across 2 servers.

---

## Architecture

```
Claude Desktop  /  Claude Code
│
├── 🖥  wordpress-studio      LOCAL  stdio  →  npx wp-studio@latest mcp  (Automattic official)
│                                              13 tools — site lifecycle, WP-CLI, preview, screenshot
│
└── 🔧 wordpress-studio-mcp   LOCAL  stdio  →  node dist/index.js  (this project)
                                               27 tools — filesystem, SQLite DB, WP-CLI helpers, registry
```

---

## Features (27 tools)

### Site Registry & Status
- Full site list from `~/.studio/cli.json` — names, paths, ports, auto-login URLs
- WordPress.com OAuth token status check (no token value returned)
- Studio daemon health via named pipe
- Per-site disk usage
- HTTP health check with response time and WP headers
- Raw config dump — passwords and keys always redacted

### Filesystem
- Read any file inside a Studio site (theme, plugin, config) — 2 MB limit
- Write / create files with automatic parent directory creation
- List directories (flat or recursive up to depth 4)
- Glob search within a site, e.g. `**/*.php`
- Read `wp-config.php` with passwords and secret keys redacted
- Read `wp-content/debug.log` (last N lines)

### SQLite Database
- Uses Node.js built-in `node:sqlite` — no Python or native build required
- List all tables in the site's `.ht.sqlite` database
- Inspect column schema, types, and constraints
- Read-only SELECT queries (enforced)
- Write SQL — INSERT / UPDATE / DELETE
- Full SQL dump (schema + INSERT rows)

### WP-CLI Helpers
- Plugin list, install, deactivate / delete
- Theme list, activate
- User list, create administrator
- Database search-replace (dry-run by default)
- Cache, rewrite, and transient flush
- WordPress core update
- Raw WP-CLI passthrough — any command

---

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | v22.5.0 | Needed for built-in `node:sqlite` |
| [WordPress Studio](https://developer.wordpress.com/studio/) | 1.7.7 | Provides local site runtime |
| Studio CLI (`wp-studio`) | 1.7.7 | `npm i -g wp-studio` or enabled in Studio settings |
| [Claude Desktop](https://claude.ai/download) or [Claude Code](https://claude.ai/code) | latest | |

---

## Setup

### 1. Clone and build

```powershell
git clone https://github.com/movinginfo/wordpress-studio-mcp.git
cd wordpress-studio-mcp
npm install
npm run build
```

### 2a. Claude Desktop — edit `claude_desktop_config.json`

Location: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "wordpress-studio-mcp": {
      "command": "node",
      "args": [
        "C:\\path\\to\\wordpress-studio-mcp\\dist\\index.js"
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

Restart Claude Desktop — both servers will appear as **Connectors**.

### 2b. Claude Code CLI — register via `claude mcp add`

```powershell
# This extension
claude mcp add --scope user wordpress-studio-mcp `
    --env "STUDIO_HOME=$env:USERPROFILE\.studio" `
    --env "STUDIO_SITES_ROOT=$env:USERPROFILE\Studio\sites" `
    -- node "C:\path\to\wordpress-studio-mcp\dist\index.js"

# Official Studio MCP (wp-studio)
claude mcp add --scope user wordpress-studio `
    -- npx -y wp-studio@latest mcp
```

Verify with `/mcp` inside Claude Code.

---

## `claude_desktop_config.json` — full reference

```json
{
  "preferences": {
    "coworkScheduledTasksEnabled": false,
    "ccdScheduledTasksEnabled": true,
    "sidebarMode": "code",
    "coworkWebSearchEnabled": true
  },
  "mcpServers": {
    "wordpress-studio-mcp": {
      "command": "node",
      "args": [
        "C:\\Work\\Wordpress Studio MCP Plugin for Claude Code\\dist\\index.js"
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

---

## Project Structure

```
wordpress-studio-mcp/
│
├── src/
│   ├── index.ts                  MCP server entry (stdio transport)
│   ├── studio-config.ts          Reads ~/.studio/cli.json, resolves site paths
│   └── tools/
│       ├── site-registry.ts      studio_registry, studio_auth_status, studio_daemon_status …
│       ├── filesystem.ts         fs_read_file, fs_write_file, fs_list_dir …
│       ├── database.ts           db_query, db_execute, db_export_sql …
│       └── wpcli.ts              wpcli_plugin_list, wpcli_run …
│
├── dist/                         Compiled JS (after npm run build)
├── .claude-plugin/               Claude Code plugin manifest (Connectors UI)
│   ├── plugin.json
│   └── marketplace.json
├── .mcp.json                     MCP config for Claude Code plugin system
├── setup.ps1                     One-command Windows setup
├── package.json
└── tsconfig.json
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `STUDIO_HOME` | `~/.studio` | Studio config directory (`cli.json`, `shared.json`) |
| `STUDIO_SITES_ROOT` | `~/Studio/sites` | Root directory for local WordPress sites |

---

## Key Paths (Windows)

```
%USERPROFILE%\
├── AppData\Roaming\Claude\
│   └── claude_desktop_config.json   ← Claude Desktop MCP config
│
├── .studio\
│   ├── cli.json           Site registry (id, name, path, port, phpVersion…)
│   ├── shared.json        OAuth token, locale
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

## Complete Tool Reference

### Server A — `wordpress-studio` (13 tools, official Automattic — `wp-studio@1.7.7`)

| Tool | Description |
|---|---|
| `site_create` | Create a new local Studio site |
| `site_list` | List all local sites |
| `site_info` | Details for a specific site |
| `site_start` | Start a local site server |
| `site_stop` | Stop a local site server |
| `site_delete` | Delete a site (optionally including files) |
| `preview_create` | Deploy to WordPress.com for a shareable preview |
| `preview_list` | List active preview environments |
| `preview_update` | Redeploy changes to preview |
| `preview_delete` | Remove a preview environment |
| `wp_cli` | Run any WP-CLI command on a local site |
| `validate_blocks` | Validate Gutenberg block markup |
| `take_screenshot` | Screenshot a running site (desktop + mobile) |

### Server B — `wordpress-studio-mcp` (27 tools, this project)

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
| `fs_write_file` | Write / create a file (creates parent dirs) |
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

## Example Prompts

```
# List all local Studio sites
"Show me all my local WordPress Studio sites"

# Create a site and install WooCommerce
"Create a new Studio site called 'my-shop', start it, then install and activate WooCommerce"

# Read a theme file
"Read the functions.php from the active theme on my 'my-shop' site"

# Query the database
"Show me all published posts from the 'my-shop' site database"

# Export the full database
"Export the 'my-shop' site database as a SQL dump"

# Check the error log
"Show me the last 50 lines of the WordPress debug log for site 'my-shop'"

# URL migration dry run
"Dry-run a search-replace from http://my-shop.local to https://myshop.com on site my-shop"

# Take a screenshot
"Take a screenshot of my running 'my-shop' site"

# Flush all caches
"Flush the WordPress cache, rewrites, and transients on site 'my-shop'"
```

---

## Security

- All filesystem operations are sandboxed to `STUDIO_SITES_ROOT` — path traversal is blocked.
- `wp-config.php` passwords, secret keys, and salts are always redacted before returning.
- Studio config dumps redact all token, password, key, secret, and salt fields.
- `db_query` enforces SELECT / WITH only — write operations go through `db_execute` explicitly.
- Uses Node.js built-in `node:sqlite` — no native compiled binaries required.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Server not in Connectors | Restart Claude Desktop after editing `claude_desktop_config.json` |
| `studio: command not found` | Studio → Settings → Studio CLI → Save, restart terminal |
| `SQLite DB not found` | Start the site first: `studio site start` |
| Build fails | Check Node.js version: `node --version` (needs v22.5+) |
| Extension fails to start | Run `node dist/index.js` directly to see the error |
| `wp-studio mcp` fails | Run `npx wp-studio@latest --version` to verify install |

---

## Development

```powershell
# Watch mode (tsx, no build step)
npm run dev

# Production build
npm run build

# Clean build artifacts
npm run clean
```

---

## Related

- [WordPress Studio](https://developer.wordpress.com/studio/) — local WordPress development environment
- [wp-studio CLI](https://www.npmjs.com/package/wp-studio) — official Studio CLI (v1.7.7) by Automattic
- [Studio CLI docs](https://developer.wordpress.com/docs/developer-tools/studio/cli/) — full CLI reference
- [Model Context Protocol](https://modelcontextprotocol.io) — MCP specification

---

## License

[MIT](LICENSE)

---

## Contributing

Issues and pull requests are welcome. Please open an issue first to discuss significant changes.
