/**
 * studio-config.ts
 *
 * Reads and parses WordPress Studio 1.7.7 config files from ~/.studio/
 * Mirrors the Zod schemas from apps/cli/src/lib/cli-config/core.ts
 */

import fs   from "node:fs";
import path from "node:path";
import os   from "node:os";

// ─── Paths ────────────────────────────────────────────────────────────────────

/** ~/.studio  (or STUDIO_HOME env override) */
export const STUDIO_HOME = process.env.STUDIO_HOME
  ? process.env.STUDIO_HOME
  : path.join(os.homedir(), ".studio");

/** Root directory where Studio keeps local sites (or STUDIO_SITES_ROOT env override) */
export const STUDIO_SITES_ROOT = process.env.STUDIO_SITES_ROOT
  ? process.env.STUDIO_SITES_ROOT
  : path.join(os.homedir(), "Studio", "sites");

export const CLI_CONFIG_PATH    = path.join(STUDIO_HOME, "cli.json");
export const SHARED_CONFIG_PATH = path.join(STUDIO_HOME, "shared.json");
export const APP_CONFIG_PATH    = path.join(STUDIO_HOME, "app.json");

/** Windows named-pipe / Unix socket for the Studio process daemon */
export const DAEMON_SOCKET = process.platform === "win32"
  ? "\\\\.\\pipe\\studio-daemon.sock"
  : path.join(STUDIO_HOME, "pm2", "daemon.sock");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiteData {
  id: string;
  name: string;
  path: string;         // absolute path on disk
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

// ─── Readers ─────────────────────────────────────────────────────────────────

function readJson<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Returns the parsed CLI config (site registry) or null if missing */
export function readCliConfig(): CliConfig | null {
  return readJson<CliConfig>(CLI_CONFIG_PATH);
}

/** Returns the parsed shared config (auth token etc.) or null if missing */
export function readSharedConfig(): SharedConfig | null {
  return readJson<SharedConfig>(SHARED_CONFIG_PATH);
}

/** Returns all known sites, falling back to scanning STUDIO_SITES_ROOT */
export function getSites(): SiteData[] {
  const cfg = readCliConfig();
  if (cfg?.sites && cfg.sites.length > 0) {
    return cfg.sites;
  }

  // Fallback: scan the sites root directory
  if (!fs.existsSync(STUDIO_SITES_ROOT)) return [];

  return fs.readdirSync(STUDIO_SITES_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map((d, i) => ({
      id:         d.name,
      name:       d.name,
      path:       path.join(STUDIO_SITES_ROOT, d.name),
      port:       8881 + i,
      phpVersion: "8.2",
    }));
}

/** Find a single site by name, id, or absolute path */
export function findSite(nameOrPathOrId: string): SiteData | undefined {
  const sites  = getSites();
  const needle = nameOrPathOrId.toLowerCase();
  return sites.find(
    s =>
      s.id.toLowerCase()   === needle ||
      s.name.toLowerCase() === needle ||
      s.path.toLowerCase() === needle ||
      s.path.toLowerCase().endsWith(path.sep + needle)
  );
}

/**
 * Resolve the SQLite database file for a site.
 * Studio uses the sqlite-database-integration plugin (v2.2.17) which stores
 * the DB at: {sitePath}/wp-content/database/.ht.sqlite
 */
export function getSqlitePath(sitePath: string): string {
  return path.join(sitePath, "wp-content", "database", ".ht.sqlite");
}

/** Safety guard — ensure the given file path is within STUDIO_SITES_ROOT */
export function assertUnderSitesRoot(filePath: string): void {
  const real = path.resolve(filePath);
  const root = path.resolve(STUDIO_SITES_ROOT);
  if (!real.startsWith(root + path.sep) && real !== root) {
    throw new Error(
      `Access denied: path "${filePath}" is outside STUDIO_SITES_ROOT "${root}"`
    );
  }
}
