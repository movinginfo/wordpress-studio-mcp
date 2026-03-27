# WordPress Studio MCP

> Give Claude direct access to your local WordPress sites — read files, query databases, run WP-CLI, call the WordPress REST API, and inspect site status. Part of a four-component AI-powered WordPress development stack.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v22.5%2B-green.svg)](https://nodejs.org)
[![WordPress Studio](https://img.shields.io/badge/WordPress%20Studio-1.7.7-3858e9.svg)](https://developer.wordpress.com/studio/)
[![MCP](https://img.shields.io/badge/MCP-stdio-orange.svg)](https://modelcontextprotocol.io)
[![GitHub](https://img.shields.io/badge/GitHub-movinginfo%2Fwordpress--studio--mcp-black.svg)](https://github.com/movinginfo/wordpress-studio-mcp)

---

## Contents

- [The Complete WordPress AI Stack](#the-complete-wordpress-ai-stack)
- [Install — Claude Desktop](#install--claude-desktop)
- [Install — Claude Code IDE](#install--claude-code-ide)
- [wordpress-studio-mcp Tools (42)](#wordpress-studio-mcp--42-tools--this-project)
- [wordpress-studio Tools (13)](#wordpress-studio--13-tools--automattic-wp-studio1777)
- [WP-CLI Reference](#wp-cli-reference)
- [wordpress.com MCP Tools (17)](#wordpresscom-mcp--17-tools--automattic-remote-http)
- [wordpress.com Plugin Commands](#wordpresscom-plugin--commands--automattic-skills)
- [Environment Variables](#environment-variables)
- [Key Paths](#key-paths)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## The Complete WordPress AI Stack

Four components work together. Install all four for the full experience.

```
Claude Desktop / Claude Code
│
├── 🌐 wordpress-com            REMOTE  HTTP + OAuth 2.1  →  public-api.wordpress.com
│   Automattic · auto-installed with plugin                   17 tools — content authoring,
│                                                              site settings, stats, users,
│                                                              security, subscriptions
│
├── 🎨 wordpress.com            PLUGIN  skills only        →  Claude Code plugin system
│   Automattic · v0.0.1                                        4 commands — /design-site
│   Marketplace: claude-plugins-official                       /preview-designs  /quick-build
│                                                              /site-specification
│
├── 🖥  wordpress-studio         LOCAL   stdio              →  npx wp-studio@latest mcp
│   Automattic · wp-studio@1.7.7                               13 tools — site lifecycle,
│                                                              WP-CLI, preview, screenshot
│
└── 🔧 wordpress-studio-mcp     LOCAL   stdio              →  node dist/index.js
    This project · github.com/movinginfo/wordpress-studio-mcp  42 tools — filesystem,
                                                               SQLite DB, WP-CLI helpers,
                                                               site registry, REST API,
                                                               theme design tokens
```

**Total: 4 commands + 72 MCP tools** covering the full WordPress development lifecycle.

---

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 22.5.0 | Built-in `node:sqlite` — no Python or native build |
| [WordPress Studio](https://developer.wordpress.com/studio/) | 1.7.7 | Provides local site runtime and CLI |
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

Verify:

```powershell
node "C:\Work\wordpress-studio-mcp\dist\index.js"
# Shows startup banner on stderr, then waits — press Ctrl+C to exit
```

### Step 2 — Edit `claude_desktop_config.json`

```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

Full working config:

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

### Step 3 — Install the wordpress.com plugin

Claude Desktop → **Settings → Connectors → Browse plugins** → search **"wordpress.com"** → Install.

This adds the `/design-site`, `/preview-designs`, `/quick-build`, `/site-specification` commands and the remote `wordpress-com` MCP (17 tools) with automatic OAuth 2.1 login.

### Step 4 — Restart and verify

Fully quit Claude Desktop (system tray → Quit) and reopen. Click the **⊕ plug icon** in the chat input:

```
✓ wordpress-studio-mcp    42 tools
✓ wordpress-studio        13 tools
✓ wordpress-com           17 tools   (after plugin install)
```

---

## Install — Claude Code IDE

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

Open Claude Code → **Plugins panel → Browse → "wordpress.com"** → Install.

Or from the terminal:

```powershell
claude plugins install wordpress.com
```

### Step 4 — Verify

```powershell
claude mcp list
```

Type `/mcp` inside Claude Code — all servers should show green. Type `/` to see available commands.

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

## Tool Reference

### `wordpress-studio-mcp` · 42 tools · this project

#### Site Registry & Status

| Tool | Description |
|---|---|
| `studio_registry` | Full site list from `~/.studio/cli.json` — paths, ports, auto-login URLs |
| `studio_auth_status` | WordPress.com OAuth token status (no token value returned) |
| `studio_daemon_status` | Check if Studio process daemon is running via named pipe |
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

#### WordPress.com Remote API

Requires WordPress.com OAuth token in `~/.studio/shared.json` (sign in through Studio Desktop).

| Tool | Description |
|---|---|
| `wpcom_api_get` | Authenticated GET to any WordPress.com API endpoint (`/rest/v1.1/`, `/wp/v2/`, `/wpcom/v2/`) |
| `wpcom_api_post` | POST / PUT / PATCH / DELETE — requires `confirmed: true` |
| `wpcom_site_info` | Site metadata: URL, name, description, plan, jetpack status |
| `wpcom_posts` | List posts with filters: status, type, author, search, per_page, page |
| `wpcom_stats` | Traffic summary: views, visitors, likes, comments for a date range |
| `wpcom_media` | List media library items with MIME-type and date filters |

#### Local Site WP REST API

Calls the WordPress REST API directly on a running Studio site (`http://localhost:{port}/wp-json/`). Supports WordPress Application Passwords for write access.

| Tool | Description |
|---|---|
| `wp_rest_get` | GET any endpoint on a local site, e.g. `/wp/v2/posts` |
| `wp_rest_request` | POST / PUT / PATCH / DELETE — requires `confirmed: true` |
| `wp_rest_routes` | List all registered REST routes and their supported methods |
| `wp_rest_posts` | List posts via `/wp/v2/posts` with status, search, per_page filters |
| `wp_rest_users` | List users via `/wp/v2/users` |
| `wp_rest_taxonomies` | List categories (`/wp/v2/categories`) or tags (`/wp/v2/tags`) |
| `wp_rest_settings` | Read site settings via `/wp/v2/settings` (requires auth) |

#### Theme Design Tokens

Use these before generating block content to align with the site's visual design — use preset slugs (e.g. `has-primary-color`, `has-large-font-size`) instead of hard-coded hex/px values.

| Tool | Description |
|---|---|
| `wpcom_theme_context` | WordPress.com: active theme, color palette, font sizes/families, gradients, spacing scale, per-block style overrides. Operations: `active`, `presets`, `styles`, `blocks`, `all` |
| `wp_theme_json` | Local Studio site: reads `theme.json` from the active block theme. Resolves active theme via SQLite — site does not need to be running. Sections: `all`, `colors`, `fonts`, `spacing`, `blocks`, `raw` |

**Recommended sequence before content generation:**
```
wp_theme_json (section: colors)  → get palette slugs
wp_theme_json (section: fonts)   → get font size slugs
wp_theme_json (section: blocks)  → get per-block overrides
→ use slugs in block attributes, not hard-coded hex/px
```

---

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

---

## WP-CLI Reference

WP-CLI is the command-line interface for WordPress. Use it through the `wpcli_run` tool (any command) or the specific helper tools above. In Studio, WP-CLI runs via PHP-WASM — no separate WP-CLI install is required.

Docs: [developer.wordpress.com/docs/developer-tools/studio/cli](https://developer.wordpress.com/docs/developer-tools/studio/cli/)

### Common commands via `wpcli_run`

#### Site information
```
wp core version                          # WordPress version
wp core verify-checksums                 # Verify core file integrity
wp option get siteurl                    # Get site URL
wp option get blogname                   # Get site name
wp option list --search="active_plugins" # See active plugins
```

#### Plugins
```
wp plugin list                           # All plugins with status
wp plugin install woocommerce --activate # Install + activate
wp plugin activate contact-form-7        # Activate installed plugin
wp plugin deactivate akismet             # Deactivate
wp plugin delete hello-dolly            # Delete plugin files
wp plugin update --all                   # Update all plugins
```

#### Themes
```
wp theme list                            # All themes with status
wp theme install astra --activate        # Install + activate
wp theme activate twentytwentyfour       # Switch active theme
wp theme delete twentytwentyOne          # Delete theme files
```

#### Users
```
wp user list                             # All users
wp user create john john@example.com --role=editor --user_pass=password
wp user update 1 --user_pass=newpassword # Change admin password
wp user delete 3 --reassign=1           # Delete user, reassign content
wp user add-role 2 administrator         # Add role to user
```

#### Content
```
wp post list --post_type=post --post_status=publish   # Published posts
wp post list --post_type=page                         # All pages
wp post create --post_title="Hello" --post_status=publish --post_type=post
wp post delete 42 --force                             # Permanently delete
wp post meta get 42 _thumbnail_id                     # Get post meta
```

#### Database
```
wp db query "SELECT ID, post_title FROM wp_posts WHERE post_status='publish'"
wp db export backup.sql                  # Export full DB to SQL
wp db import backup.sql                  # Import from SQL
wp db size                               # DB size breakdown
wp db tables                             # List all tables
wp search-replace "http://old.local" "https://new.com" --dry-run
wp search-replace "http://old.local" "https://new.com" --precise
```

#### Cache and performance
```
wp cache flush                           # Flush object cache
wp transient delete --all                # Delete all transients
wp rewrite flush                         # Flush rewrite rules
wp cron event list                       # List scheduled events
wp cron event run wp_scheduled_delete    # Run a cron event manually
```

#### Debug and maintenance
```
wp eval "echo phpversion();"             # Run PHP inline
wp eval-file debug-script.php           # Run a PHP file
wp maintenance-mode activate             # Enable maintenance mode
wp maintenance-mode deactivate           # Disable maintenance mode
wp error_log                             # Read error log
wp doctor check --all                    # Site health diagnostics
```

#### WooCommerce (when installed)
```
wp wc product list                       # List products
wp wc order list --status=processing    # Processing orders
wp wc tool run clear_transients          # Clear WC transients
```

### Search-replace workflow (URL migration)

Always dry-run first, then apply:

```
# 1. Dry run — preview changes
"Dry-run search-replace http://mysite.local → https://mysite.com on site mysite"

# 2. Review output, then apply
"Apply the search-replace http://mysite.local → https://mysite.com on site mysite"

# 3. Flush caches after migration
"Flush all caches on site mysite"
```

---

## `wordpress.com` MCP · 17 tools · Automattic (remote HTTP)

The remote WordPress.com MCP connects to `public-api.wordpress.com` via OAuth 2.1 (PKCE). It manages **hosted WordPress.com sites** — not local Studio sites.

Docs: [developer.wordpress.com/docs/mcp/tools-reference](https://developer.wordpress.com/docs/mcp/tools-reference/)

### Write / Delete Tools

All write and delete operations go through a single unified tool: **`wpcom-mcp-content-authoring`**

**Safety protocol:** Every write operation requires a mandatory confirmation step. The agent must describe the action, ask for explicit confirmation, and include `user_confirmed: true` in params. Write operations are never auto-executed.

#### Content Authoring operations

| Operation | Description | Reversible |
|---|---|---|
| `posts.create` | Create a new post (draft by default) | — |
| `posts.update` | Update an existing post (live immediately if published) | Partial |
| `posts.delete` | Move post to trash (30-day recovery) | Yes |
| `pages.create` | Create a new page (draft by default) | — |
| `pages.update` | Update an existing page (live immediately if published) | Partial |
| `pages.delete` | Move page to trash (30-day recovery) | Yes |
| `comments.create` | Add a comment to a post | — |
| `comments.update` | Update comment content or status | Partial |
| `comments.delete` | Move comment to trash | Yes |
| `media.update` | Update media metadata (alt text, caption, title) | Partial |
| `media.delete` | Move media to trash — may break content referencing it | Yes |
| `categories.create` | Create a new category (supports parent hierarchy) | — |
| `categories.update` | Update category (slug change breaks URLs immediately) | Partial |
| `categories.delete` | **Permanently** delete — no trash, cannot be undone | **No** |
| `tags.create` | Create a new tag | — |
| `tags.update` | Update tag (slug change breaks URLs immediately) | Partial |
| `tags.delete` | **Permanently** delete — no trash, cannot be undone | **No** |

**Usage pattern:**
```
action: "list"     → discover all available operations
action: "describe" → get the full input schema for an operation
action: "execute"  → run the operation (requires user_confirmed: true)
```

**Tip:** Before creating content, fetch `theme.presets` from `wpcom-mcp-site-editor-context` first — use preset slugs (e.g., `has-primary-color`, `has-large-font-size`) instead of hard-coded hex/px values so content adapts to theme changes.

---

### Read-Only Tools

#### `wpcom-mcp-site-editor-context`
Query the active theme's design tokens: color palette, font sizes, font families, gradients, spacing scale, and per-block style overrides. Use before creating content to align with the site's visual design.

| Operation | Description |
|---|---|
| `theme.active` | Get active theme stylesheet slug and name |
| `theme.presets` | Color palette, font sizes, font families, gradients, spacing scale |
| `theme.styles` | Per-block and per-element style overrides from `theme.json` |
| `blocks.allowed` | Registered block types with style variations, filtered by namespace |

**Recommended sequence:** `theme.active` → `theme.presets` → `blocks.allowed` → create content

#### `wpcom-mcp-posts-search`
Search posts across sites by query, type, status, author, category, tag, date range, and custom fields. Returns ID, title, content, excerpt, permalink, author, categories, tags.

#### `wpcom-mcp-post-get`
Retrieve a single post by ID or URL. Optionally include comments in the response.

#### `wpcom-mcp-site-comments-search`
Search comments within a site. Filter by status (approved/pending/spam/trash), post ID, author, date range. Returns threaded comment structure.

#### `wpcom-mcp-site-plugins`
List installed plugins with status, version, author, update availability. Filter by active/inactive/all.

#### `wpcom-mcp-site-settings`
Get site configuration: general settings, writing, reading, discussion, media sizes, permalink structure, privacy. Control which sections are included to reduce response size.

#### `wpcom-mcp-site-statistics`
Site traffic data: views, visitors, top posts/pages, referrers, geographic breakdown, device types. Supports day/week/month/year periods up to 365 periods back.

#### `wpcom-mcp-user-sites`
List all your WordPress.com sites with filtering (search, status, privacy, custom domain) and optional metrics (views, posts, storage, health score).

#### `wpcom-mcp-site-users`
List users on a specific site with roles, permissions, optional email, last login, and post counts.

#### `wpcom-mcp-user-profile`
Your WordPress.com profile: basic info, preferences, account stats, plan/subscriptions, social engagement, activity metrics. Request only the sections you need.

#### `wpcom-mcp-user-connections`
Social integrations (Twitter/X, Facebook, LinkedIn, etc.): status, capabilities, last tested.

#### `wpcom-mcp-user-notifications`
Notification channel settings (email, push, timeline) and registered devices.

#### `wpcom-mcp-user-notifications-inbox`
Notification inbox: filter by type (like/follow/comment/mention/achievement), unread only, or date range.

#### `wpcom-mcp-user-security`
2FA status, active sessions, application passwords, login history (up to 90 days).

#### `wpcom-mcp-user-subscriptions`
Plans and billing: subscription details, billing history, payment methods, storage/bandwidth usage.

#### `wpcom-mcp-user-achievements`
Badges, feats, progress tracking, trophy case.

---

## `wordpress.com` Plugin · Commands · Automattic (skills)

Install: Claude Code → **Plugins panel → Browse → "wordpress.com"**

No MCP server — pure Claude agent workflows using the Studio CLI and filesystem tools.

### `/site-specification`

Extracts a structured specification from a plain-English site description. Output:

```json
{
  "siteBrief": {
    "siteName":      "Bean & Brew",
    "siteType":      "restaurant",
    "primaryGoal":   "Drive in-store visits and online orders",
    "audience":      "Local coffee enthusiasts, remote workers",
    "tone":          "warm, artisanal, community-focused",
    "brandKeywords": ["cozy", "handcrafted", "local", "sustainable"]
  },
  "layoutNotes": [
    "Hero with full-bleed café atmosphere photo",
    "Menu section with three categories",
    "Location and hours with embedded map"
  ],
  "typography": {
    "primaryFont":  "Playfair Display",
    "secondaryFont": "Lato",
    "fontImport":   "https://fonts.googleapis.com/css2?family=..."
  }
}
```

**Typography inference by site type:**

| Site Type | Primary Font | Goal |
|---|---|---|
| SaaS / Tech | Satoshi, Plus Jakarta Sans | Signups, demos |
| E-commerce | Brand-matched | Purchases |
| Professional Services | Serif + clean body | Credibility |
| Restaurant / Food | Playfair Display | Visits, orders |
| Creative / Portfolio | Distinctive display | Showcase work |
| Blog / Media | Readable body font | Engagement, reads |
| Non-profit | Warm, approachable | Awareness, donations |

### `/preview-designs`

Generates three distinct HTML design directions (`design-1.html`, `design-2.html`, `design-3.html`) opened in browser. Each has inline CSS, Google Fonts, no external dependencies, WCAG 4.5:1 contrast, and `prefers-reduced-motion` support. Color temperature, typographic voice, and hero layout vary across the three options.

### `/design-site`

Full multi-phase AI orchestration from brief to deployed WordPress block theme:

| Phase | What happens |
|---|---|
| **0.5** | Validates Studio CLI, creates or selects local site |
| **0** | Detects new vs redesign, optionally imports existing content |
| **1** | Extracts site spec, defines 3 aesthetic directions |
| **2** | Parallel subagents generate style tiles → design tokens locked into `design-tokens.json` |
| **3** | Three page layout variations using locked tokens |
| **4** | Full HTML mockups for every planned page with realistic content |
| **5** | Approved mockup → complete WordPress block theme → deployed to Studio site |

Design tokens are immutable once set. Core blocks only — no `wp:html` fallbacks. Theme slug must match `^[a-z0-9-]+$`.

### `/quick-build`

Fastest path: description → deployed site.

```
User:  /quick-build "SaaS landing page, dark mode, modern"

→  /site-specification extracts spec
→  /preview-designs generates 3 options
→  user picks one
→  full block theme built (theme.json, style.css, functions.php, templates)
→  theme activated on local Studio site
```

---

## Example Prompts

```
# Full site build
/quick-build "coffee shop website, warm rustic feel, three menu sections"

# Design exploration
/preview-designs "portfolio site for a UI designer, clean minimal"

# Site inspection
Show me all my local WordPress Studio sites and their disk usage

# Theme editing
Read the functions.php from the active theme on site "my-shop"
Find all PHP files in the active theme on site "my-shop"

# Database
Show me all published posts from the "my-shop" SQLite database
Export the full "my-shop" database as a SQL dump

# Plugins
Install WooCommerce on site "my-shop" and activate it
List all active plugins on site "my-shop" with their versions

# Debugging
Show the last 100 lines of the PHP error log for site "my-shop"
Run wp doctor check on site "my-shop"

# URL migration
Dry-run search-replace http://my-shop.local → https://myshop.com on site "my-shop"

# WordPress.com (hosted sites)
Show me traffic stats for mysite.wordpress.com for the last 30 days
Search for all draft posts on mysite.wordpress.com
List all active plugins on mysite.wordpress.com

# Local REST API
List all available REST API routes on site "my-shop"
Get all published posts from site "my-shop" via the REST API
Show site settings for "my-shop" using Application Password user:password
Create a draft post on "my-shop" via wp_rest_request (requires confirmation)

# Theme design tokens
Show me the color palette and font sizes from the active theme on site "my-shop"
Get all theme.json design tokens from site "my-shop" before I write block content
What colors are available in the active WordPress.com theme on mysite.wordpress.com?
```

---

## Environment Variables

| Variable | Default (Windows) | Description |
|---|---|---|
| `STUDIO_HOME` | `%USERPROFILE%\.studio` | Studio config directory (`cli.json`, `shared.json`) |
| `STUDIO_SITES_ROOT` | `%USERPROFILE%\Studio\sites` | Root folder for local site files |

Find your actual paths:

```powershell
ls "$env:USERPROFILE\.studio"       # should contain cli.json, shared.json
ls "$env:USERPROFILE\Studio\sites"  # your local sites
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
│   ├── cli.json                        Local site registry
│   ├── shared.json                     WordPress.com OAuth token, locale
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
│       ├── wpcli.ts              wpcli_plugin_list, wpcli_run …
│       └── rest-api.ts           wpcom_api_get, wp_rest_get, wpcom_theme_context, wp_theme_json …
│
├── dist/                         Compiled JS — generated by npm run build
├── .claude-plugin/
│   ├── plugin.json               Claude Code plugin metadata
│   └── marketplace.json          Marketplace registration
├── .mcp.json                     MCP definition for Claude Code plugin system
├── setup.ps1                     One-command Windows setup
├── package.json
└── tsconfig.json
```

---

## Security

- **Path sandboxing** — all filesystem tools verify the resolved path is inside `STUDIO_SITES_ROOT`. Directory traversal is blocked at the server level.
- **Secrets redaction** — `wp-config.php` passwords, keys, and salts are stripped before output. Config dumps redact all fields matching `password`, `token`, `key`, `secret`, or `salt`.
- **Read-only SQL** — `db_query` rejects any statement not starting with `SELECT` or `WITH`. Writes go through `db_execute` explicitly.
- **No native binaries** — uses Node.js built-in `node:sqlite` (stable since v22.5). No Python, no `node-gyp`.
- **WordPress.com write safety** — `wpcom-mcp-content-authoring` requires `user_confirmed: true` in every write/delete call. Permanent deletions (categories, tags) additionally require `confirm_permanent_delete: true`.
- **REST API write safety** — `wpcom_api_post` and `wp_rest_request` require `confirmed: true` in every mutating call. No write operations are auto-executed.
- **Application Passwords** — local REST API auth uses WordPress Application Passwords (WordPress 5.6+). Generate in WP Admin → Users → Profile → Application Passwords. Never pass plain login passwords.

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
| `wp-studio mcp` fails | Run `npx wp-studio@latest --version` to verify the package downloads |
| `wpcli_run` returns empty | Make sure the site is running: `studio_site_health` or `site_start` |
| wordpress.com MCP returns 401 | Re-authenticate: Studio Desktop → WordPress.com → Log in again |
| `wp_rest_*` returns 401 | Generate an Application Password in WP Admin → Users → Profile |
| `wp_rest_*` connection refused | Site must be running — use `site_start` or `studio_site_health` first |
| `/quick-build` can't find Studio | Run `studio --version` in terminal — CLI must be in PATH |

---

## Development

```powershell
npm run dev    # watch mode — tsx, no build step
npm run build  # compile TypeScript → dist/
npm run clean  # remove dist/
```

---

## Related

- [wordpress.com Claude plugin](https://github.com/Automattic/claude-code-wordpress.com) — official Automattic skills plugin
- [WordPress Studio](https://developer.wordpress.com/studio/) — local WordPress development environment
- [wp-studio CLI](https://www.npmjs.com/package/wp-studio) — official Studio CLI npm package (v1.7.7)
- [Studio CLI docs](https://developer.wordpress.com/docs/developer-tools/studio/cli/) — full CLI reference
- [WordPress.com MCP tools reference](https://developer.wordpress.com/docs/mcp/tools-reference/) — full remote MCP API
- [WP-CLI overview](https://developer.wordpress.com/docs/developer-tools/wp-cli/overview/) — WP-CLI on WordPress.com
- [Model Context Protocol](https://modelcontextprotocol.io) — MCP specification

---

## License

[MIT](LICENSE) © 2026 movinginfo
