/**
 * tools/blueprints.ts
 *
 * MCP tools for WordPress Studio Blueprints — JSON recipes for reproducible sites.
 *
 * Blueprint format: same as WordPress Playground (https://playground.wordpress.net/blueprint-schema.json)
 * Studio-specific limitations: landingPage, login, extraLibraries, enableMultisite are ignored.
 *
 * Tools:
 *   studio_blueprint_list     — list the 3 built-in featured blueprints
 *   studio_blueprint_generate — snapshot an existing site into a reusable blueprint JSON
 *   studio_blueprint_apply    — apply a blueprint JSON to an existing Studio site
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerBlueprintTools(server: McpServer): void;
//# sourceMappingURL=blueprints.d.ts.map