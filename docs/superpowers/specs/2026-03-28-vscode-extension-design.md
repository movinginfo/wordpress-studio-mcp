# VS Code Extension — WordPress Studio MCP
**Date:** 2026-03-28
**Status:** Approved
**Scope:** New project — `vscode-wordpress-studio-mcp`

---

## Goal

Register the existing `wordpress-studio-mcp` stdio MCP server as a GitHub Copilot MCP provider inside VS Code, so Copilot Chat gets all 61 tools (filesystem, SQLite DB, WP-CLI, REST API, Xdebug, etc.) the same way Claude Code does today.

---

## Approach

**`contributes.mcpServers` + auto-detect on first run.**

VS Code 1.99+ reads `contributes.mcpServers` from any installed extension, resolves `${config:...}` variable substitution, and spawns the stdio process automatically. The extension only needs to:
1. Declare the server statically in `package.json`
2. Ensure the `wordpressStudioMcp.serverPath` setting is populated on first activation

---

## Project Structure

New project at `C:\Work\vscode-wordpress-studio-mcp\` (separate from the MCP server repo).

```
vscode-wordpress-studio-mcp/
├── package.json          VS Code extension manifest + contributes
├── src/
│   └── extension.ts     Activation + path detection (~120 lines)
├── tsconfig.json
├── .vscodeignore
└── README.md
```

---

## `package.json` — Key Sections

```json
{
  "name": "vscode-wordpress-studio-mcp",
  "displayName": "WordPress Studio MCP",
  "description": "Registers wordpress-studio-mcp as a GitHub Copilot MCP provider — 61 tools for WordPress Studio sites",
  "publisher": "movinginfo",
  "version": "0.1.0",
  "engines": { "vscode": "^1.99.0" },
  "categories": ["AI", "Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "mcpServers": {
      "wordpress-studio": {
        "command": "node",
        "args": ["${config:wordpressStudioMcp.serverPath}"],
        "env": {}
      }
    },
    "commands": [
      {
        "command": "wordpressStudioMcp.configurePath",
        "title": "WordPress Studio MCP: Configure Server Path"
      }
    ],
    "configuration": {
      "title": "WordPress Studio MCP",
      "properties": {
        "wordpressStudioMcp.serverPath": {
          "type": "string",
          "default": "",
          "description": "Absolute path to dist/index.js of the wordpress-studio-mcp server"
        }
      }
    }
  }
}
```

---

## Activation Logic (`src/extension.ts`)

```
activate()
  │
  ├─ read wordpressStudioMcp.serverPath from user settings
  │
  ├─ [set + file exists] → done, VS Code starts the MCP server automatically
  │
  ├─ [not set OR file missing] → scan candidate paths for dist/index.js
  │
  │   Windows candidates:
  │     C:\Work\Wordpress Studio MCP Plugin for Claude Code\dist\index.js
  │     %USERPROFILE%\wordpress-studio-mcp\dist\index.js
  │     %USERPROFILE%\Work\wordpress-studio-mcp\dist\index.js
  │     %USERPROFILE%\Documents\wordpress-studio-mcp\dist\index.js
  │
  │   macOS/Linux candidates:
  │     ~/wordpress-studio-mcp/dist/index.js
  │     ~/Work/wordpress-studio-mcp/dist/index.js
  │     ~/projects/wordpress-studio-mcp/dist/index.js
  │     ~/dev/wordpress-studio-mcp/dist/index.js
  │
  ├─ [auto-detected] → silently write path to user settings → done
  │
  └─ [not found] → show one-time notification:
        "WordPress Studio MCP: server not found — locate dist/index.js?"
        [Browse…]  →  file picker (filter: index.js)
                   →  validate file exists
                   →  save to wordpressStudioMcp.serverPath (global user settings)
        [Dismiss]  →  do nothing; command palette re-triggers anytime
```

**Command:** `WordPress Studio MCP: Configure Server Path`
Same folder-picker flow. Registers on `activate()`, available from command palette at any time.

---

## Error Cases

| Situation | Behaviour |
|---|---|
| Path set, `dist/index.js` missing | Warning: "dist/index.js not found — run `npm run build`" |
| Node.js not on PATH | VS Code's MCP error surface handles this natively |
| MCP server crashes on start | VS Code shows MCP server error in Output panel |
| User clicks Dismiss on first-run prompt | Silent; command palette available to configure later |

---

## Build & Distribution

- TypeScript compiled with `tsc` (CommonJS output, `"module": "commonjs"` for VS Code extensions)
- Packaged with `vsce package` → produces `vscode-wordpress-studio-mcp-0.1.0.vsix`
- Install locally: `code --install-extension vscode-wordpress-studio-mcp-0.1.0.vsix`
- Publish: `vsce publish` (requires Marketplace PAT)

**`devDependencies`:**
```json
{
  "@types/vscode": "^1.99.0",
  "@types/node": "^22.0.0",
  "typescript": "^5.3.3",
  "@vscode/vsce": "^3.0.0"
}
```

---

## Data Flow (End-to-End)

```
User opens VS Code
  → Extension activates (onStartupFinished)
  → Auto-detects / confirms dist/index.js path
  → VS Code reads contributes.mcpServers
  → Resolves ${config:wordpressStudioMcp.serverPath}
  → Spawns: node <path>/dist/index.js  (stdio)
  → MCP server starts, registers 61 tools
  → Copilot Chat sees all tools
  → User asks: "@workspace list my Studio sites"
  → Copilot calls studio_registry tool
  → Result returned inline in chat
```

---

## Out of Scope

- Sidebar / tree view UI (not requested)
- Bundling `dist/` inside the `.vsix` (chosen: auto-detect external install)
- Writing `.vscode/mcp.json` (chosen: extension-level global registration)
