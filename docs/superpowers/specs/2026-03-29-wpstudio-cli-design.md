# wpstudio CLI — Design Spec
**Date:** 2026-03-29
**Status:** Approved
**Scope:** Add `src/cli.ts` to existing `wordpress-studio-mcp` project

---

## Goal

Add a `wpstudio` CLI command to the existing project so all 71 MCP tools can be called directly from any terminal — VS Code integrated terminal, PowerShell, bash — without an AI client. Human-readable output by default; `--json` flag for scripting.

---

## Approach

**MCP SDK Client over stdio.** The CLI spawns `dist/index.js` as a child process and communicates via the MCP SDK's `Client` + `StdioClientTransport`. Zero changes to the existing server or tool files.

---

## Project Changes

### `package.json` — merge into existing `bin` field, add script

```json
"bin": {
  "wordpress-studio-mcp": "dist/index.js",   ← already exists, keep it
  "wpstudio": "dist/cli.js"                   ← add this entry
},
"scripts": {
  "cli": "tsx src/cli.ts"                     ← add for dev use
}
```

### New file: `src/cli.ts`

Single new file, ~280 lines. No changes to any existing file.

---

## ESM `__dirname` Pattern

The project uses `"type": "module"`. `__dirname` is not available in ESM. Use this pattern in `src/cli.ts`:

```typescript
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const serverPath = path.join(__dirname, "index.js");  // dist/index.js
```

---

## Version String

Read dynamically from `package.json` at runtime — never hardcoded:

```typescript
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
// output: "wpstudio v0.1.15 (wordpress-studio-mcp)"
```

---

## Subcommand Naming

MCP tool names use `snake_case`. CLI subcommands use `kebab-case`:

**Site Registry & Status**
| MCP Tool | CLI Subcommand |
|---|---|
| `studio_registry` | `wpstudio studio-registry` |
| `studio_auth_status` | `wpstudio studio-auth-status` |
| `studio_daemon_status` | `wpstudio studio-daemon-status` |
| `studio_disk_usage` | `wpstudio studio-disk-usage` |
| `studio_site_health` | `wpstudio studio-site-health --site mysite` |
| `studio_config_dump` | `wpstudio studio-config-dump` |

**Filesystem**
| MCP Tool | CLI Subcommand |
|---|---|
| `fs_read_file` | `wpstudio fs-read-file --site mysite --path wp-config.php` |
| `fs_write_file` | `wpstudio fs-write-file --site mysite --path file.php --content "..."` |
| `fs_list_dir` | `wpstudio fs-list-dir --site mysite --path /` |
| `fs_find_files` | `wpstudio fs-find-files --site mysite --pattern "*.php"` |
| `fs_read_wp_config` | `wpstudio fs-read-wp-config --site mysite` |
| `fs_read_error_log` | `wpstudio fs-read-error-log --site mysite` |

**Database**
| MCP Tool | CLI Subcommand |
|---|---|
| `db_query` | `wpstudio db-query --site mysite --sql "SELECT..."` |
| `db_execute` | `wpstudio db-execute --site mysite --sql "UPDATE..."` |
| `db_list_tables` | `wpstudio db-list-tables --site mysite` |
| `db_describe_table` | `wpstudio db-describe-table --site mysite --table wp_options` |
| `db_export_sql` | `wpstudio db-export-sql --site mysite` |

**WP-CLI**
| MCP Tool | CLI Subcommand |
|---|---|
| `wpcli_run` | `wpstudio wpcli-run --site mysite --cmd "cache flush"` |
| `wpcli_plugin_list` | `wpstudio wpcli-plugin-list --site mysite` |
| `wpcli_plugin_install` | `wpstudio wpcli-plugin-install --site mysite --plugin woocommerce` |
| `wpcli_plugin_deactivate` | `wpstudio wpcli-plugin-deactivate --site mysite --plugin woocommerce` |
| `wpcli_theme_list` | `wpstudio wpcli-theme-list --site mysite` |
| `wpcli_theme_activate` | `wpstudio wpcli-theme-activate --site mysite --theme twentytwentyfour` |
| `wpcli_user_list` | `wpstudio wpcli-user-list --site mysite` |
| `wpcli_create_admin` | `wpstudio wpcli-create-admin --site mysite --user admin2 --pass secret` |
| `wpcli_search_replace` | `wpstudio wpcli-search-replace --site mysite --search old --replace new` |
| `wpcli_cache_flush` | `wpstudio wpcli-cache-flush --site mysite` |
| `wpcli_core_update` | `wpstudio wpcli-core-update --site mysite` |

**REST API & WP.com**
| MCP Tool | CLI Subcommand |
|---|---|
| `wp_rest_get` | `wpstudio wp-rest-get --site mysite --route /wp/v2/posts` |
| `wp_rest_request` | `wpstudio wp-rest-request --site mysite --method POST --route /wp/v2/posts` |
| `wp_rest_routes` | `wpstudio wp-rest-routes --site mysite` |
| `wp_rest_posts` | `wpstudio wp-rest-posts --site mysite` |
| `wp_rest_users` | `wpstudio wp-rest-users --site mysite` |
| `wp_rest_taxonomies` | `wpstudio wp-rest-taxonomies --site mysite` |
| `wp_rest_settings` | `wpstudio wp-rest-settings --site mysite` |
| `wp_theme_json` | `wpstudio wp-theme-json --site mysite` |
| `wpcom_api_get` | `wpstudio wpcom-api-get --endpoint /sites/mine` |
| `wpcom_api_post` | `wpstudio wpcom-api-post --endpoint /sites/mine/posts` |
| `wpcom_mcp_call` | `wpstudio wpcom-mcp-call --tool list-sites` |
| `wpcom_theme_context` | `wpstudio wpcom-theme-context` |
| `wpcom_posts` | `wpstudio wpcom-posts` |
| `wpcom_site_info` | `wpstudio wpcom-site-info` |
| `wpcom_stats` | `wpstudio wpcom-stats` |
| `wpcom_media` | `wpstudio wpcom-media` |

**Blueprints**
| MCP Tool | CLI Subcommand |
|---|---|
| `studio_blueprint_list` | `wpstudio studio-blueprint-list` |
| `studio_blueprint_generate` | `wpstudio studio-blueprint-generate --site mysite` |
| `studio_blueprint_apply` | `wpstudio studio-blueprint-apply --site mysite --blueprint file.json` |

**VIP Design**
| MCP Tool | CLI Subcommand |
|---|---|
| `vip_design_tokens` | `wpstudio vip-design-tokens` |
| `vip_design_theme_json` | `wpstudio vip-design-theme-json` |

**Administration**
| MCP Tool | CLI Subcommand |
|---|---|
| `wp_config_set` | `wpstudio wp-config-set --site mysite --key WP_DEBUG --value true` |
| `wp_security_audit` | `wpstudio wp-security-audit --site mysite` |
| `wp_php_info` | `wpstudio wp-php-info --site mysite` |
| `wpcli_db_backup` | `wpstudio wpcli-db-backup --site mysite` |
| `wpcli_cron_list` | `wpstudio wpcli-cron-list --site mysite` |
| `wpcli_update_all` | `wpstudio wpcli-update-all --site mysite` |

**Domain & HTTPS**
| MCP Tool | CLI Subcommand |
|---|---|
| `studio_site_set_domain` | `wpstudio studio-site-set-domain --site mysite --domain example.com` |
| `studio_site_remove_domain` | `wpstudio studio-site-remove-domain --site mysite` |
| `studio_domain_list` | `wpstudio studio-domain-list` |
| `studio_site_use_mkcert` | `wpstudio studio-site-use-mkcert --site mysite --domain example.com --confirmed true` |

**WordPress Abilities**
| MCP Tool | CLI Subcommand |
|---|---|
| `wp_mcp_adapter_setup` | `wpstudio wp-mcp-adapter-setup --site mysite --confirmed true` |
| `wp_abilities_discover` | `wpstudio wp-abilities-discover --site mysite` |
| `wp_abilities_info` | `wpstudio wp-abilities-info --site mysite --ability my-plugin/my-ability` |
| `wp_abilities_call` | `wpstudio wp-abilities-call --site mysite --ability my-plugin/my-ability` |

**Xdebug**
| MCP Tool | CLI Subcommand |
|---|---|
| `studio_xdebug_enable` | `wpstudio studio-xdebug-enable --site mysite --confirmed true` |
| `studio_xdebug_disable` | `wpstudio studio-xdebug-disable --site mysite` |
| `studio_xdebug_status` | `wpstudio studio-xdebug-status` |
| `studio_xdebug_ide_config` | `wpstudio studio-xdebug-ide-config --site mysite --ide vscode` |

**Marketing Skills**
| MCP Tool | CLI Subcommand |
|---|---|
| `marketing_skills_list` | `wpstudio marketing-skills-list` |
| `marketing_skills_install` | `wpstudio marketing-skills-install --skills all --scope global` |
| `marketing_skills_status` | `wpstudio marketing-skills-status` |
| `marketing_skills_context` | `wpstudio marketing-skills-context` |

**General rule:** subcommand = MCP tool name with `_` replaced by `-`. The dispatcher converts hyphens back to underscores and does an exact match against the live tool list from `Client.listTools()`.

---

## Argument Parsing

No external CLI framework. Pure `process.argv` parsing:

```
wpstudio <subcommand> [--key value] [--key value] [--json] [--help]
```

Rules:
- `--key value` → `{ key: value }` passed as tool args
- `--key` alone (next token starts with `--` or is end) → `{ key: true }`
- `--json` → output raw MCP response JSON (see Output section)
- `--help` after a subcommand → same as `wpstudio help <subcommand>`
- No subcommand → show usage

Type coercion before passing to MCP:
- `"true"` / `"false"` → `true` / `false`
- Strings that parse as finite numbers → `number`
- Everything else → `string`

---

## Built-in Commands (no MCP call for list/help/version)

| Command | Output |
|---|---|
| `wpstudio` | Usage guide + tool category list |
| `wpstudio list` | All 71 tools with one-line descriptions (fetched via `Client.listTools()`) |
| `wpstudio help <tool>` | Tool description + params (fetched via `Client.listTools()`) |
| `wpstudio --version` | `wpstudio v<version> (wordpress-studio-mcp)` — read from package.json |

**Category grouping for `wpstudio list`:** derived from tool name prefix using a hardcoded prefix-to-category map. The map is sorted by **descending prefix length** before lookup so that longer prefixes win over shorter ones (e.g. `studio_xdebug_` wins over `studio_`, `wpcli_db_` wins over `wpcli_`):

```typescript
const CATEGORY_MAP: Record<string, string> = {
  // Longer prefixes MUST come first — sorted by descending length at lookup time
  "studio_blueprint_":  "BLUEPRINTS",
  "studio_site_":       "DOMAIN & HTTPS",   // set_domain, remove_domain, use_mkcert
  "studio_domain_":     "DOMAIN & HTTPS",
  "studio_xdebug_":     "XDEBUG",
  "wpcli_db_":          "ADMINISTRATION",   // wpcli_db_backup
  "wpcli_cron_":        "ADMINISTRATION",   // wpcli_cron_list
  "wpcli_update_":      "ADMINISTRATION",   // wpcli_update_all
  "wp_rest_":           "REST API",
  "wp_theme_":          "REST API",
  "wp_config_":         "ADMINISTRATION",
  "wp_security_":       "ADMINISTRATION",
  "wp_php_":            "ADMINISTRATION",
  "wp_mcp_":            "ABILITIES",
  "wp_abilities_":      "ABILITIES",
  "wpcom_":             "WORDPRESS.COM",
  "studio_":            "SITE REGISTRY & STATUS",  // catch-all for studio_ after longer prefixes
  "fs_":                "FILESYSTEM",
  "db_":                "DATABASE",
  "wpcli_":             "WP-CLI",
  "vip_":               "VIP DESIGN",
  "marketing_":         "MARKETING",
};

// Lookup: sort keys by length descending, return first match
function getCategory(toolName: string): string {
  const keys = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);
  return keys.find(k => toolName.startsWith(k))
    ? CATEGORY_MAP[keys.find(k => toolName.startsWith(k))!]
    : "OTHER";
}
```

**`wpstudio help <tool>`:** applies same kebab-to-underscore conversion as the main dispatcher. `wpstudio help` with no tool name → same as `wpstudio list`.

---

## `--json` Output Contract

With `--json`, print the full raw MCP response object as JSON:

```json
{
  "content": [
    { "type": "text", "text": "option_name\n───────────\nsiteurl\nblogname" }
  ]
}
```

This is the actual shape of every MCP tool response. It is pipeable to `jq`:

```bash
wpstudio db-query --site i-help.us --sql "SELECT option_name FROM wp_options LIMIT 3" --json | jq '.content[0].text'
```

Without `--json`, print `result.content[0].text` directly (plain text, already formatted by the tool).

**Guard for empty content:** if `result.content` is empty or `result.content[0]` is not a text block, fall back to `JSON.stringify(result, null, 2)` rather than throwing:

```typescript
const block = result.content?.[0];
const output = (block?.type === "text" && block.text)
  ? block.text
  : JSON.stringify(result, null, 2);
```

---

## Data Flow

```
wpstudio db-query --site i-help.us --sql "SELECT option_name FROM wp_options LIMIT 5"
  │
  ├─ parse argv
  │   subcommand = "db-query"  →  tool = "db_query"
  │   args = { site: "i-help.us", sql: "SELECT option_name FROM wp_options LIMIT 5" }
  │   json = false
  │
  ├─ resolve server path (ESM pattern)
  │   import.meta.url → fileURLToPath → dirname → join("index.js")
  │   = C:\Work\...\dist\index.js
  │
  ├─ check dist/index.js exists → error if missing
  │
  ├─ spawn: node dist/index.js  (stdio child process)
  │
  ├─ Client.connect(new StdioClientTransport({ command: "node", args: [serverPath] }))
  │   → MCP initialize handshake
  │
  ├─ Client.callTool("db_query", { site: "i-help.us", sql: "..." })
  │   → MCP tools/call request / response
  │
  ├─ format output
  │   default:  print result.content[0].text
  │   --json:   JSON.stringify(result, null, 2)
  │
  ├─ Client.close() → child process exits
  │
  └─ process.exit(0)
```

---

## Long-running Tools

Some tools (`wpcli_search_replace`, `wpcli_update_all`, `studio_blueprint_apply`) can take 30–120 seconds. During the wait:

- Print `⏳ Running <tool-name>…` to stderr immediately after the MCP call starts
- No timeout set on `Client.callTool()` — the MCP SDK default (none) is used; the server's own timeout governs
- On completion: if `process.stderr.isTTY`, overwrite the spinner with `\r\x1b[K` before printing the result; if not a TTY (piped output), let the spinner line stand and print the result on the next line

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Unknown subcommand | `Error: unknown tool "xyz". Run "wpstudio list" to see all tools.` → exit 1 |
| Missing required arg | MCP server returns error text → print it → exit 1 |
| `dist/index.js` missing | `Error: server not built — run npm run build` → exit 1 |
| MCP server crashes on start | Stderr from child process printed to stderr → exit 1 |
| MCP callTool returns `isError: true` | Print `result.content[0].text` to stderr → exit 1 |
| `Ctrl+C` during call | SIGINT handler → kill child process → exit 130 (Unix convention: 128 + 2) |

---

## Installation

```powershell
# One-time global install (dev machine)
cd "C:\Work\Wordpress Studio MCP Plugin for Claude Code"
npm link

# Or global install from npm (once published)
npm install -g wordpress-studio-mcp

# Verify
wpstudio --version
wpstudio list
```

---

## Example Session

```powershell
PS> wpstudio studio-registry
  Site             Port   Status   URL
  ───────────────  ─────  ───────  ──────────────────────
  i-help.us        8881   running  https://i-help.us
  myshop           8882   stopped  http://localhost:8882

PS> wpstudio wpcli-plugin-list --site i-help.us
  Name              Status   Version
  ────────────────  ───────  ───────
  akismet           active   5.3.3
  woocommerce       active   8.5.1

PS> wpstudio db-query --site i-help.us --sql "SELECT option_name FROM wp_options LIMIT 3"
  option_name
  ───────────
  siteurl
  blogname
  blogdescription

PS> wpstudio db-query --site i-help.us --sql "SELECT option_name FROM wp_options LIMIT 3" --json
{
  "content": [
    { "type": "text", "text": "option_name\n───────────\nsiteurl\nblogname\nblogdescription" }
  ]
}

PS> wpstudio help db-query
  db_query — Execute a read-only SQL SELECT query on the site's SQLite database.

  Required:
    --site   Site name or ID
    --sql    SQL SELECT statement

  Optional:
    --limit  Max rows to return (default: 100)

PS> wpstudio list
  SITE REGISTRY & STATUS
    studio-registry          Full site list — ports, URLs, status
    studio-auth-status       WordPress.com OAuth token status
    ...

  DATABASE
    db-query                 Execute a SELECT query
    db-execute               Execute INSERT/UPDATE/DELETE
    ...
```

---

## Out of Scope

- Interactive REPL mode
- Streaming output
- Default `--site` config file
- Shell tab-completion scripts
