/**
 * tools/wpcli.ts
 *
 * MCP tools that delegate WP-CLI commands to the Studio CLI (`studio wp …`).
 * Studio 1.7.7 bundles WP-CLI inside PHP-WASM — no separate WP-CLI install needed.
 *
 * These complement (not replace) the built-in `wp_cli` tool from `studio mcp`
 * by adding plugin/theme management shortcuts, user helpers, and batch operations.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerWpCliTools(server: McpServer): void;
//# sourceMappingURL=wpcli.d.ts.map