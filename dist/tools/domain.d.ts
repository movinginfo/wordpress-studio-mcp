/**
 * tools/domain.ts
 *
 * Custom domain mapping for WordPress Studio local sites.
 *
 * Allows a local Studio site to be accessed via a real domain name
 * (e.g. http://testmysite.com) instead of http://localhost:8883.
 *
 * How it works:
 *   1. Hosts file  — adds "127.0.0.1 testmysite.com" so the OS resolves
 *                    the domain to this machine (requires admin on Windows).
 *   2. Studio CLI  — runs `studio site set --domain testmysite.com` so Studio's
 *                    built-in proxy routes port 80 → localhost:port and passes
 *                    absoluteUrl to the PHP-WASM WordPress server.
 *   3. WP database — search-replaces localhost:port → testmysite.com so all
 *                    stored URLs (posts, uploads, home, siteurl) are correct.
 *   4. wp-config   — writes WP_HOME / WP_SITEURL constants as a fallback.
 *
 * Reference: https://github.com/Automattic/studio
 *   apps/cli/lib/hosts-file.ts
 *   apps/cli/lib/site-utils.ts
 *   apps/cli/lib/proxy-server.ts
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerDomainTools(server: McpServer): void;
//# sourceMappingURL=domain.d.ts.map