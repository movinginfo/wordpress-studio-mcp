/**
 * tools/rest-api.ts
 *
 * MCP tools for the WordPress REST API — both remote (WordPress.com) and local (Studio sites).
 *
 * ─── Three API namespaces ─────────────────────────────────────────────────────
 *
 *  /rest/v1.1/     Original WordPress.com REST API
 *                  https://developer.wordpress.com/docs/api/rest-api-reference/
 *
 *  /wp/v2/         WordPress core REST API (same as self-hosted, different base URL on .com)
 *                  https://developer.wordpress.org/rest-api/
 *
 *  /wpcom/v2/      WordPress.com extensions / MCP endpoints
 *                  https://developer.wordpress.com/docs/api/namespaces-versions/
 *
 * ─── Authentication ───────────────────────────────────────────────────────────
 *
 *  WordPress.com   OAuth2 Bearer token read from ~/.studio/shared.json
 *                  (the same token Studio uses — no separate login needed)
 *
 *  Local Studio    WP Application Password passed as Basic auth header, OR
 *                  unauthenticated for public GET endpoints
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerRestApiTools(server: McpServer): void;
//# sourceMappingURL=rest-api.d.ts.map