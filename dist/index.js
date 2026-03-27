#!/usr/bin/env node
/**
 * WordPress Studio MCP Extension Server
 * ──────────────────────────────────────
 * Hybrid MCP stdio server for WordPress Studio 1.7.7.
 * Complements the built-in `studio mcp` server with:
 *   • Filesystem tools  (read/write theme/plugin files, wp-config, error log)
 *   • SQLite DB tools   (query, execute, export Studio's .ht.sqlite)
 *   • WP-CLI helpers    (plugin/theme/user management, search-replace, cache flush)
 *   • Site registry     (full registry, daemon status, health check, disk usage)
 *
 * Transport:  stdio  (Claude Code, Cursor, Windsurf, Codex, etc.)
 *
 * Environment variables:
 *   STUDIO_HOME        Override ~/.studio              (default: ~/.studio)
 *   STUDIO_SITES_ROOT  Override site root directory    (default: ~/Studio/sites)
 *
 * Project location:
 *   c:\Work\Wordpress Studio MCP Plugin for Claude Code\
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFilesystemTools } from "./tools/filesystem.js";
import { registerDatabaseTools } from "./tools/database.js";
import { registerWpCliTools } from "./tools/wpcli.js";
import { registerSiteRegistryTools } from "./tools/site-registry.js";
import { registerRestApiTools } from "./tools/rest-api.js";
import { registerBlueprintTools } from "./tools/blueprints.js";
import { registerVipDesignTools } from "./tools/vip-design.js";
import { STUDIO_HOME, STUDIO_SITES_ROOT } from "./studio-config.js";
// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "wordpress-studio-mcp-extension",
    version: "0.1.7",
});
// ─── Register all tool groups ─────────────────────────────────────────────────
registerSiteRegistryTools(server); // studio_registry, studio_auth_status, studio_daemon_status …
registerFilesystemTools(server); // fs_read_file, fs_write_file, fs_list_dir, fs_find_files …
registerDatabaseTools(server); // db_query, db_execute, db_list_tables, db_export_sql …
registerWpCliTools(server); // wpcli_plugin_list, wpcli_run, wpcli_search_replace …
registerRestApiTools(server); // wpcom_api_get, wp_rest_get, wpcom_mcp_call, wpcom_theme_context …
registerBlueprintTools(server); // studio_blueprint_list, studio_blueprint_generate, studio_blueprint_apply
registerVipDesignTools(server); // vip_design_tokens, vip_design_theme_json
// ─── Startup banner (stderr — does not pollute the MCP stdio stream) ──────────
const PROJECT_ROOT = "c:\\Work\\Wordpress Studio MCP Plugin for Claude Code";
const pad = (s, n) => s.slice(0, n).padEnd(n);
process.stderr.write("\n" +
    "┌─────────────────────────────────────────────────────────────┐\n" +
    "│  WordPress Studio MCP Extension  v0.1.7                     │\n" +
    `│  Project:     ${pad(PROJECT_ROOT, 45)}│\n` +
    `│  Studio home: ${pad(STUDIO_HOME, 45)}│\n` +
    `│  Sites root:  ${pad(STUDIO_SITES_ROOT, 45)}│\n` +
    "└─────────────────────────────────────────────────────────────┘\n\n");
// ─── Connect stdio transport and start serving ────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map