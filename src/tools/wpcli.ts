/**
 * tools/wpcli.ts
 *
 * MCP tools that delegate WP-CLI commands to the Studio CLI (`studio wp …`).
 * Studio 1.7.7 bundles WP-CLI inside PHP-WASM — no separate WP-CLI install needed.
 *
 * These complement (not replace) the built-in `wp_cli` tool from `studio mcp`
 * by adding plugin/theme management shortcuts, user helpers, and batch operations.
 */

import { spawnSync } from "node:child_process";
import path          from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }          from "zod";
import { findSite, STUDIO_SITES_ROOT } from "../studio-config.js";

/** Run `studio wp --path <sitePath> <args…>` and return stdout/stderr */
function studioWp(
  sitePath: string,
  wpArgs: string[]
): { stdout: string; stderr: string; ok: boolean } {
  const result = spawnSync(
    "studio",
    ["wp", "--path", sitePath, ...wpArgs],
    {
      encoding:    "utf-8",
      timeout:     5 * 60 * 1000,   // 5 min — matches Studio's WP_CLI_DEFAULT_RESPONSE_TIMEOUT
      windowsHide: true,
    }
  );
  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? (result.error?.message ?? ""),
    ok:     result.status === 0,
  };
}

export function registerWpCliTools(server: McpServer): void {

  // ── wpcli_plugin_list ─────────────────────────────────────────────────────

  server.tool(
    "wpcli_plugin_list",
    "List all installed plugins for a Studio site with status, version, and update info.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const { stdout, stderr, ok } = studioWp(sitePath, ["plugin", "list", "--format=table"]);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_plugin_install ──────────────────────────────────────────────────

  server.tool(
    "wpcli_plugin_install",
    "Install (and optionally activate) a WordPress plugin from wordpress.org.",
    {
      site:     z.string().describe("Site name or absolute site path"),
      plugin:   z.string().describe("Plugin slug, e.g. 'woocommerce'"),
      activate: z.boolean().optional().default(true).describe("Activate after install (default: true)"),
      version:  z.string().optional().describe("Specific version (default: latest)"),
    },
    async ({ site, plugin, activate, version }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const args = ["plugin", "install", plugin];
      if (version)  args.push(`--version=${version}`);
      if (activate) args.push("--activate");
      const { stdout, stderr, ok } = studioWp(sitePath, args);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_plugin_deactivate ───────────────────────────────────────────────

  server.tool(
    "wpcli_plugin_deactivate",
    "Deactivate a WordPress plugin on a Studio site.",
    {
      site:        z.string().describe("Site name or absolute site path"),
      plugin:      z.string().describe("Plugin slug"),
      uninstall:   z.boolean().optional().default(false).describe("Also delete the plugin (default: false)"),
    },
    async ({ site, plugin, uninstall }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const args = ["plugin", "deactivate", plugin];
      if (uninstall) args.push("--uninstall");
      const { stdout, stderr, ok } = studioWp(sitePath, args);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_theme_list ──────────────────────────────────────────────────────

  server.tool(
    "wpcli_theme_list",
    "List all installed themes for a Studio site.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const { stdout, stderr, ok } = studioWp(sitePath, ["theme", "list", "--format=table"]);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_theme_activate ──────────────────────────────────────────────────

  server.tool(
    "wpcli_theme_activate",
    "Activate a theme on a Studio site.",
    {
      site:  z.string().describe("Site name or absolute site path"),
      theme: z.string().describe("Theme slug, e.g. 'twentytwentyfour'"),
    },
    async ({ site, theme }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const { stdout, stderr, ok } = studioWp(sitePath, ["theme", "activate", theme]);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_user_list ───────────────────────────────────────────────────────

  server.tool(
    "wpcli_user_list",
    "List all WordPress users for a Studio site.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const { stdout, stderr, ok } = studioWp(sitePath, [
        "user", "list",
        "--fields=ID,user_login,user_email,roles,user_registered",
        "--format=table",
      ]);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_create_admin ────────────────────────────────────────────────────

  server.tool(
    "wpcli_create_admin",
    "Create a new administrator user on a Studio site.",
    {
      site:     z.string().describe("Site name or absolute site path"),
      username: z.string().describe("Login username"),
      email:    z.string().email().describe("User email address"),
      password: z.string().min(8).describe("Password (min 8 chars)"),
    },
    async ({ site, username, email, password }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const { stdout, stderr, ok } = studioWp(sitePath, [
        "user", "create", username, email,
        `--user_pass=${password}`, "--role=administrator",
      ]);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_search_replace ──────────────────────────────────────────────────

  server.tool(
    "wpcli_search_replace",
    "Run a database search-replace on a Studio site (useful for URL migration). " +
    "Runs as dry-run by default — set dry_run: false to apply changes.",
    {
      site:        z.string().describe("Site name or absolute site path"),
      search:      z.string().describe("String to search, e.g. 'http://old-url.local'"),
      replace:     z.string().describe("Replacement string, e.g. 'http://new-url.local'"),
      dry_run:     z.boolean().optional().default(true).describe("Preview only (default: true)"),
      skip_tables: z.array(z.string()).optional().describe("Tables to skip, e.g. ['wp_users']"),
    },
    async ({ site, search, replace, dry_run, skip_tables }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const args = ["search-replace", search, replace];
      if (dry_run)           args.push("--dry-run");
      if (skip_tables?.length) args.push(`--skip-tables=${skip_tables.join(",")}`);
      const { stdout, stderr, ok } = studioWp(sitePath, args);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_cache_flush ─────────────────────────────────────────────────────

  server.tool(
    "wpcli_cache_flush",
    "Flush WordPress object cache, rewrite rules, and transients for a Studio site.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const cmds = [
        ["cache",     "flush"],
        ["rewrite",   "flush"],
        ["transient", "delete", "--all"],
      ];
      const results = cmds.map(args => {
        const { stdout, stderr, ok } = studioWp(sitePath, args);
        return `wp ${args.join(" ")}: ${ok ? (stdout || "✓") : stderr}`;
      });
      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    }
  );

  // ── wpcli_core_update ─────────────────────────────────────────────────────

  server.tool(
    "wpcli_core_update",
    "Update WordPress core on a Studio site.",
    {
      site:    z.string().describe("Site name or absolute site path"),
      version: z.string().optional().describe("Target WP version (default: latest)"),
    },
    async ({ site, version }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const args = ["core", "update"];
      if (version) args.push(`--version=${version}`);
      const { stdout, stderr, ok } = studioWp(sitePath, args);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );

  // ── wpcli_run ─────────────────────────────────────────────────────────────

  server.tool(
    "wpcli_run",
    "Run any arbitrary WP-CLI command on a Studio site via `studio wp`. " +
    "Pass the full WP-CLI argument string, e.g. 'option get siteurl'.",
    {
      site:    z.string().describe("Site name or absolute site path"),
      command: z.string().describe("WP-CLI arguments, e.g. 'option get siteurl'"),
    },
    async ({ site, command }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const args     = shellSplit(command);
      const { stdout, stderr, ok } = studioWp(sitePath, args);
      return { content: [{ type: "text" as const, text: ok ? stdout : stderr }], isError: !ok };
    }
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal shell splitter — handles single and double quoted strings */
function shellSplit(cmd: string): string[] {
  const tokens: string[] = [];
  let cur = "", inS = false, inD = false;
  for (const c of cmd) {
    if (c === "'" && !inD) { inS = !inS; continue; }
    if (c === '"' && !inS) { inD = !inD; continue; }
    if (c === " " && !inS && !inD) { if (cur) tokens.push(cur); cur = ""; }
    else cur += c;
  }
  if (cur) tokens.push(cur);
  return tokens;
}
