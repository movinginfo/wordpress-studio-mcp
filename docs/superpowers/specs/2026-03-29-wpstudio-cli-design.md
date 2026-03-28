# wpstudio CLI — Design Spec
**Date:** 2026-03-29
**Status:** Approved
**Scope:** Add `src/cli.ts` to existing `wordpress-studio-mcp` project

---

## Goal

Add a `wpstudio` CLI command to the existing project so all 61 MCP tools can be called directly from any terminal — VS Code integrated terminal, PowerShell, bash — without an AI client. Human-readable output by default; `--json` flag for scripting.

---

## Approach

**MCP SDK Client over stdio.** The CLI spawns `dist/index.js` as a child process and communicates via the MCP SDK's `Client` + `StdioClientTransport`. Zero changes to the existing server or tool files.

---

## Project Changes

### `package.json` additions only

```json
"bin": {
  "wordpress-studio-mcp": "dist/index.js",
  "wpstudio": "dist/cli.js"
},
"scripts": {
  "cli": "tsx src/cli.ts"
}
```

### New file: `src/cli.ts`

Single new file, ~250 lines. No changes to any existing file.

---

## Subcommand Naming

MCP tool names use `snake_case`. CLI subcommands use `kebab-case` (drop the prefix group when unambiguous):

| MCP Tool | CLI Subcommand |
|---|---|
| `studio_registry` | `wpstudio sites` or `wpstudio studio-registry` |
| `studio_site_health` | `wpstudio health --site mysite` |
| `studio_disk_usage` | `wpstudio disk --site mysite` |
| `wpcli_plugin_list` | `wpstudio wpcli-plugin-list --site mysite` |
| `wpcli_run` | `wpstudio wpcli-run --site mysite --cmd "cache flush"` |
| `db_query` | `wpstudio db-query --site mysite --sql "SELECT..."` |
| `fs_read_file` | `wpstudio fs-read-file --site mysite --path wp-config.php` |
| `studio_xdebug_enable` | `wpstudio xdebug-enable --site mysite --confirmed true` |
| `studio_site_set_domain` | `wpstudio set-domain --site mysite --domain example.com` |
| `marketing_skills_list` | `wpstudio marketing-skills-list` |

**General rule:** `wpstudio <tool-name-with-hyphens> [--param value ...]`

The CLI converts the subcommand back to the MCP tool name: `hyphens → underscores`, tries exact match first, then prefix-scans the full tool list.

---

## Argument Parsing

No external CLI framework. Pure `process.argv` parsing (~40 lines):

```
wpstudio <subcommand> [--key value] [--key value] [--json] [--help]
```

Rules:
- `--key value` → `{ key: value }` passed as tool args
- `--key` with no following value (next token starts with `--` or is end) → `{ key: true }`
- `--json` → output raw JSON instead of formatted text
- `--help` or no subcommand → show usage
- `--version` → print version from package.json

Boolean coercion: string `"true"` / `"false"` → `true` / `false` before passing to MCP tool.
Number coercion: strings that parse as finite numbers → `number`.

---

## Built-in Commands (no MCP call)

| Command | Output |
|---|---|
| `wpstudio` | Usage guide + tool category list |
| `wpstudio list` | All 61 tools with one-line descriptions |
| `wpstudio list --category sites` | Filter by category keyword |
| `wpstudio help <tool>` | Tool description + required/optional params |
| `wpstudio --version` | `wpstudio v0.1.15 (wordpress-studio-mcp)` |

`list` and `help` fetch tool schemas live from the MCP server via `Client.listTools()` — always accurate, never stale.

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
  ├─ resolve server path
  │   __dirname/../dist/index.js  (relative to cli.js location)
  │
  ├─ spawn: node dist/index.js  (stdio)
  │
  ├─ Client.connect(StdioClientTransport)
  │   → MCP initialize handshake
  │
  ├─ Client.callTool("db_query", { site: "i-help.us", sql: "..." })
  │   → MCP tools/call request
  │   ← MCP tools/call response: { content: [{ type: "text", text: "..." }] }
  │
  ├─ extract text content from response
  │
  ├─ format output
  │   default: pretty-print (tables, indented text, colors via chalk-free ANSI)
  │   --json: JSON.stringify(rawResult, null, 2)
  │
  └─ process.exit(0)
```

---

## Output Formatting

The MCP tool response is always `{ content: [{ type: "text", text: string }] }`. The text is already human-readable markdown/plain text (as written in each tool's return). The CLI:

1. Prints the text directly — most tools already format well
2. For `--json`: prints `JSON.stringify(result.content[0].text)` or the full raw MCP response object

No complex table-rendering library needed. The existing tools return well-formatted text strings. A thin wrapper is sufficient.

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Unknown subcommand | `Error: unknown tool "xyz". Run "wpstudio list" to see all tools.` → exit 1 |
| Missing required arg | MCP server returns error text → print it → exit 1 |
| Server not built (`dist/cli.js` missing) | Caught at spawn → `Error: server not found — run npm run build` → exit 1 |
| MCP server crashes | Stderr from child printed to stderr → exit 1 |
| `Ctrl+C` during call | SIGINT handler → kill child process → exit 0 |
| Node < 22 | `node --version` check on startup → warn and continue (server will fail with its own error) |

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
PS> wpstudio sites
  Site             Port   Status   URL
  ───────────────  ─────  ───────  ──────────────────────
  i-help.us        8881   running  https://i-help.us
  myshop           8882   stopped  http://localhost:8882

PS> wpstudio wpcli-plugin-list --site i-help.us
  Name              Status   Version
  ────────────────  ───────  ───────
  akismet           active   5.3.3
  woocommerce       active   8.5.1

PS> wpstudio db-query --site i-help.us --sql "SELECT option_name, option_value FROM wp_options WHERE option_name IN ('siteurl','blogname') "
  option_name  option_value
  ───────────  ─────────────────────
  siteurl      https://i-help.us
  blogname     My WordPress Site

PS> wpstudio db-query --site i-help.us --sql "SELECT option_name FROM wp_options LIMIT 3" --json
{
  "rows": [
    { "option_name": "siteurl" },
    { "option_name": "blogname" },
    { "option_name": "blogdescription" }
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
  SITE REGISTRY
    sites                  Full site list — ports, URLs, status
    studio-auth-status     WordPress.com OAuth token status
    ...

  DATABASE
    db-query               Execute a SELECT query
    db-execute             Execute INSERT/UPDATE/DELETE
    ...
```

---

## Out of Scope

- Interactive REPL mode
- Streaming output (MCP responses are not streamed)
- Config file for default `--site` (can be added later)
- Shell completion scripts (can be added later)
