# VS Code Extension — WordPress Studio MCP
**Date:** 2026-03-28
**Status:** Approved
**Scope:** New project — `vscode-wordpress-studio-mcp`

---

## Goal

Register the existing `wordpress-studio-mcp` stdio MCP server as a GitHub Copilot MCP provider inside VS Code, so Copilot Chat gets all tools (filesystem, SQLite DB, WP-CLI, REST API, Xdebug, etc.) the same way Claude Code does today.

> **Note:** Tool count changes with each server release. The `description` field in `package.json` uses "tools for WordPress Studio sites" rather than a hardcoded number.

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
│   └── extension.ts     Activation + path detection (~150 lines)
├── tsconfig.json         CommonJS output (VS Code extension requirement)
├── .vscodeignore         Excludes src/, tsconfig.json, *.map, node_modules/
└── README.md
```

---

## `package.json` — Key Sections

```json
{
  "name": "vscode-wordpress-studio-mcp",
  "displayName": "WordPress Studio MCP",
  "description": "Registers wordpress-studio-mcp as a GitHub Copilot MCP provider — tools for WordPress Studio sites",
  "publisher": "movinginfo",
  "version": "0.1.0",
  "engines": { "vscode": "^1.99.0" },
  "categories": ["AI", "Other"],
  "keywords": ["wordpress", "mcp", "copilot", "studio", "wpcli"],
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
          "description": "Absolute path to dist/index.js of the wordpress-studio-mcp server. Leave empty to auto-detect on next VS Code restart."
        }
      }
    }
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/vscode": "^1.99.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.3.3",
    "@vscode/vsce": "^3.0.0"
  }
}
```

> **No `"default": ""`** on `wordpressStudioMcp.serverPath`. Omitting the default means VS Code skips spawning `node ""` before activation runs. When the setting is absent/undefined, `contributes.mcpServers` does not attempt a spawn with an empty arg.

---

## ESM / CommonJS Boundary

The existing MCP server (`wordpress-studio-mcp`) is an **ESM module** (`"type": "module"` in its `package.json`). VS Code extensions must compile to **CommonJS**. There is no conflict: VS Code spawns `node <serverPath>` as a **child process** over stdio — the extension never `require()`s or `import()`s the server directly. The boundary is the MCP stdio protocol, not module system interop.

Extension `tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "lib": ["ES2022"]
  }
}
```

---

## Activation Logic (`src/extension.ts`)

### Activation event ordering note

`onStartupFinished` fires after all extensions activate and the workbench is fully loaded. VS Code's MCP machinery may attempt to start the server earlier. On the very first launch (no path configured, no default), the spawn will be skipped (empty/absent setting). The notification and auto-detection run during `activate()` and configure the setting for the next VS Code window/restart. This is acceptable first-launch behaviour: the user sees the notification immediately, and on next open the server is running.

### Flow

```
activate()
  │
  ├─ register command: wordpressStudioMcp.configurePath
  │
  ├─ read wordpressStudioMcp.serverPath from user settings
  │
  ├─ [set + file exists] → validate Node.js ≥ 22.0.0 → done
  │
  ├─ [set + file missing] → warn:
  │     "dist/index.js not found at <path> — run npm run build"
  │
  └─ [not set] → scan candidate paths for dist/index.js
        │
        │  Windows candidates:
        │    C:\Work\Wordpress Studio MCP Plugin for Claude Code\dist\index.js
        │    %USERPROFILE%\wordpress-studio-mcp\dist\index.js
        │    %USERPROFILE%\Work\wordpress-studio-mcp\dist\index.js
        │    %USERPROFILE%\Documents\wordpress-studio-mcp\dist\index.js
        │
        │  macOS/Linux candidates:
        │    ~/wordpress-studio-mcp/dist/index.js
        │    ~/Work/wordpress-studio-mcp/dist/index.js
        │    ~/projects/wordpress-studio-mcp/dist/index.js
        │    ~/dev/wordpress-studio-mcp/dist/index.js
        │
        ├─ [auto-detected] →
        │     show info: "WordPress Studio MCP: server found at <path> — saved to settings."
        │     [Change]  → triggers configurePath command
        │     write path to global user settings
        │     (server available on next VS Code window open — VS Code re-reads
        │      ${config:...} at spawn time, not live; restart required after first configure)
        │
        └─ [not found] → check context.globalState "promptShown" flag
              │
              ├─ [already shown] → silent (user dismissed before; command palette available)
              │
              └─ [not shown] → set promptShown = true → show notification:
                    "WordPress Studio MCP: server not found — locate dist/index.js?"
                    [Browse…]  → file picker (filters: { JavaScript: ['js'] })
                               → validate: path.basename(selected) === 'index.js' && fs.existsSync
                               → save to global user settings
                    [Dismiss]  → silent
```

### Node.js version check

After confirming the path exists, run `node --version` and parse the output. If the version is below `v22.0.0`, show a warning:

```
"WordPress Studio MCP requires Node.js ≥ 22.0.0. Found <version>.
The MCP server may fail. Download Node.js 22+ from nodejs.org."
```

This uses `child_process.execSync('node --version')` inside a try/catch.

---

## Error Cases

| Situation | Behaviour |
|---|---|
| First launch, path not set | Skip spawn (no default); notification fires during activation to configure |
| Path set, `dist/index.js` missing | Warning: "dist/index.js not found — run `npm run build`" |
| Node.js < 22.0.0 | Warning: "Node.js ≥ 22.0.0 required" with link to nodejs.org |
| Node.js not on PATH | VS Code's MCP error surface handles this natively |
| MCP server crashes on start | VS Code shows MCP server error in Output panel |
| User dismisses first-run prompt | Silent; `globalState.promptShown = true`; command palette available |
| File picker: wrong file selected | Re-validate: warn if `basename !== 'index.js'`, ask to re-select |

---

## `.vscodeignore`

```
src/
tsconfig.json
**/*.map
node_modules/
.vscode/
*.vsix
```

---

## Build & Distribution

- TypeScript compiled with `tsc` (CommonJS, targeting the VS Code extension host)
- Packaged with `vsce package` → produces `vscode-wordpress-studio-mcp-0.1.0.vsix`
- Install locally: `code --install-extension vscode-wordpress-studio-mcp-0.1.0.vsix`
- Publish: `vsce publish` (requires Marketplace PAT under `movinginfo` publisher)

---

## Data Flow (End-to-End)

```
User installs extension (.vsix or Marketplace)
  → VS Code activates extension (onStartupFinished)
  → Auto-detects or prompts for dist/index.js path
  → Writes wordpressStudioMcp.serverPath to user settings
  → On next open: VS Code reads contributes.mcpServers
  → Resolves ${config:wordpressStudioMcp.serverPath}
  → Spawns: node <path>/dist/index.js  (stdio, child process)
  → MCP server starts (ESM, Node 22+), registers all tools
  → Copilot Chat sees all tools automatically
  → User: "@workspace list my Studio sites"
  → Copilot calls studio_registry tool → result inline in chat
```

---

## Out of Scope

- Sidebar / tree view UI (not requested)
- Bundling `dist/` inside the `.vsix` (chosen: auto-detect external install)
- Writing `.vscode/mcp.json` (chosen: extension-level global registration)
