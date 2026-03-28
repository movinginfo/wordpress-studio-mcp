/**
 * tools/abilities.ts
 *
 * WordPress Abilities API + MCP Adapter bridge.
 *
 * The WordPress MCP Adapter (https://github.com/WordPress/mcp-adapter) exposes
 * all registered WordPress plugin/theme/core "abilities" as MCP tools via a
 * REST endpoint at /wp-json/mcp/mcp-adapter-default-server.
 *
 * This file adds four tools to our Studio MCP server:
 *
 *   wp_mcp_adapter_setup   — install abilities-api + mcp-adapter plugins on a
 *                            Studio site (downloads from GitHub, activates, sets
 *                            up Application Password for auth).
 *
 *   wp_abilities_discover  — list all abilities with mcp.public=true registered
 *                            in a WordPress site. Uses the HTTP MCP endpoint when
 *                            the adapter is installed, falls back to WP-CLI eval.
 *
 *   wp_abilities_info      — return full schema (parameters, return type,
 *                            description) for a specific ability.
 *
 *   wp_abilities_call      — execute an ability with arbitrary parameters and
 *                            return the result.
 *
 * Authentication:
 *   HTTP calls use WordPress Application Passwords (Basic Auth).
 *   The setup tool creates one and stores it in ~/.studio/mcp-app-passwords.json.
 *
 * Reference:
 *   https://github.com/WordPress/mcp-adapter
 *   https://github.com/WordPress/abilities-api
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerAbilitiesTools(server: McpServer): void;
//# sourceMappingURL=abilities.d.ts.map