/**
 * tools/database.ts
 *
 * MCP tools for querying / exporting the SQLite database that WordPress Studio
 * uses via the sqlite-database-integration plugin (v2.2.17).
 *
 * DB location per site: {sitePath}/wp-content/database/.ht.sqlite
 *
 * Uses Node.js built-in node:sqlite (stable since Node v23.4, available in v24).
 * No native build or Python required.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerDatabaseTools(server: McpServer): void;
//# sourceMappingURL=database.d.ts.map