/**
 * tools/xdebug.ts
 *
 * Xdebug integration for WordPress Studio sites.
 *
 * Studio 1.7.7 supports Xdebug via PHP-WASM (WebAssembly PHP).
 * The `enableXdebug` flag lives in ~/.studio/cli.json per site.
 *
 * Important constraints (from Studio docs):
 *   • Only ONE site may have Xdebug active at a time.
 *   • Enabling/disabling requires a site restart (stop → start).
 *   • Xdebug listens on port 9003.
 *   • Server-side path mapping:  /wordpress  →  site folder on disk.
 *
 * Tools:
 *   studio_xdebug_enable       Enable Xdebug on a site (auto-disables on others)
 *   studio_xdebug_disable      Disable Xdebug on a site
 *   studio_xdebug_status       Show which site has Xdebug on + connection info
 *   studio_xdebug_ide_config   Generate VS Code launch.json or PhpStorm guide
 *
 * Reference: https://developer.wordpress.com/docs/developer-tools/studio/xdebug/
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerXdebugTools(server: McpServer): void;
//# sourceMappingURL=xdebug.d.ts.map