/**
 * studio-config.ts
 *
 * Reads and parses WordPress Studio 1.7.7 config files from ~/.studio/
 * Mirrors the Zod schemas from apps/cli/src/lib/cli-config/core.ts
 */
/** ~/.studio  (or STUDIO_HOME env override) */
export declare const STUDIO_HOME: string;
/** Root directory where Studio keeps local sites (or STUDIO_SITES_ROOT env override) */
export declare const STUDIO_SITES_ROOT: string;
export declare const CLI_CONFIG_PATH: string;
export declare const SHARED_CONFIG_PATH: string;
export declare const APP_CONFIG_PATH: string;
/** Windows named-pipe / Unix socket for the Studio process daemon */
export declare const DAEMON_SOCKET: string;
export interface SiteData {
    id: string;
    name: string;
    path: string;
    port: number;
    phpVersion: string;
    running?: boolean;
    url?: string;
    customDomain?: string;
    enableHttps?: boolean;
    autoStart?: boolean;
    adminUsername?: string;
    adminPassword?: string;
    adminEmail?: string;
    wpVersion?: string;
}
export interface CliConfig {
    version: 1;
    sites: SiteData[];
    snapshots?: unknown[];
    aiProvider?: "wpcom" | "anthropic-claude" | "anthropic-api-key";
    anthropicApiKey?: string;
}
export interface SharedConfig {
    version: 1;
    authToken?: {
        token_type: string;
        access_token: string;
        refresh_token?: string;
        expires_at?: number;
    };
    locale?: string;
    selectedSkills?: string[];
}
/** Returns the parsed CLI config (site registry) or null if missing */
export declare function readCliConfig(): CliConfig | null;
/** Returns the parsed shared config (auth token etc.) or null if missing */
export declare function readSharedConfig(): SharedConfig | null;
/** Returns all known sites, falling back to scanning STUDIO_SITES_ROOT */
export declare function getSites(): SiteData[];
/** Find a single site by name, id, or absolute path */
export declare function findSite(nameOrPathOrId: string): SiteData | undefined;
/**
 * Resolve the SQLite database file for a site.
 * Studio uses the sqlite-database-integration plugin (v2.2.17) which stores
 * the DB at: {sitePath}/wp-content/database/.ht.sqlite
 */
export declare function getSqlitePath(sitePath: string): string;
/** Safety guard — ensure the given file path is within STUDIO_SITES_ROOT */
export declare function assertUnderSitesRoot(filePath: string): void;
//# sourceMappingURL=studio-config.d.ts.map