/**
 * tools/site-registry.ts
 *
 * MCP tools that expose WordPress Studio's site registry, daemon status,
 * disk usage, HTTP health checks, and config dumps.
 */

import fs   from "node:fs";
import net  from "node:net";
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }          from "zod";
import {
  getSites,
  readCliConfig,
  readSharedConfig,
  STUDIO_HOME,
  STUDIO_SITES_ROOT,
  DAEMON_SOCKET,
  CLI_CONFIG_PATH,
  SHARED_CONFIG_PATH,
  APP_CONFIG_PATH,
} from "../studio-config.js";

export function registerSiteRegistryTools(server: McpServer): void {

  // ── studio_registry ───────────────────────────────────────────────────────

  server.tool(
    "studio_registry",
    "Return the full Studio site registry from ~/.studio/cli.json — site IDs, names, " +
    "disk paths, ports, PHP versions, WordPress versions, and auto-login URLs.",
    {},
    async () => {
      const cfg   = readCliConfig();
      const sites = getSites();

      if (sites.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: [
              `Studio home:  ${STUDIO_HOME}`,
              `Sites root:   ${STUDIO_SITES_ROOT}`,
              `CLI config:   ${CLI_CONFIG_PATH}`,
              "",
              "No sites found. Open Studio and create a site first.",
            ].join("\n"),
          }],
        };
      }

      const lines = sites.map((s, i) => [
        `── Site ${i + 1}: ${s.name}`,
        `   ID:          ${s.id}`,
        `   Path:        ${s.path}`,
        `   Port:        ${s.port}`,
        `   PHP:         ${s.phpVersion}`,
        `   WP Version:  ${s.wpVersion ?? "unknown"}`,
        `   URL:         http://localhost:${s.port}`,
        `   Auto-login:  http://localhost:${s.port}/studio-auto-login?redirect_to=%2Fwp-admin%2F`,
        s.customDomain ? `   Domain:      ${s.customDomain}` : null,
        s.autoStart    ? `   Auto-start:  yes`               : null,
      ].filter(Boolean).join("\n"));

      const text = [
        `WordPress Studio Registry`,
        `Studio home:   ${STUDIO_HOME}`,
        `Sites root:    ${STUDIO_SITES_ROOT}`,
        `CLI config:    ${CLI_CONFIG_PATH}`,
        `Daemon socket: ${DAEMON_SOCKET}`,
        `Config ver:    ${cfg?.version ?? "?"}`,
        `AI provider:   ${cfg?.aiProvider ?? "default (wpcom)"}`,
        "",
        ...lines,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );

  // ── studio_auth_status ────────────────────────────────────────────────────

  server.tool(
    "studio_auth_status",
    "Show WordPress.com OAuth token status from ~/.studio/shared.json. " +
    "The actual access token is never returned.",
    {},
    async () => {
      const cfg = readSharedConfig();

      if (!cfg?.authToken) {
        return {
          content: [{
            type: "text" as const,
            text: "Not authenticated to WordPress.com.\nRun:  studio auth login",
          }],
        };
      }

      const tok       = cfg.authToken;
      const expiresAt = tok.expires_at
        ? new Date(tok.expires_at).toLocaleString()
        : "no expiry stored";

      return {
        content: [{
          type: "text" as const,
          text: [
            `✓ Authenticated to WordPress.com`,
            `  Token type:   ${tok.token_type}`,
            `  Expires at:   ${expiresAt}`,
            `  Has refresh:  ${!!tok.refresh_token}`,
            `  Locale:       ${cfg.locale ?? "default"}`,
            `  Skills:       ${cfg.selectedSkills?.join(", ") ?? "none"}`,
          ].join("\n"),
        }],
      };
    }
  );

  // ── studio_disk_usage ─────────────────────────────────────────────────────

  server.tool(
    "studio_disk_usage",
    "Report disk usage for all Studio sites.",
    {
      site: z.string().optional().describe("Specific site name to inspect (default: all sites)"),
    },
    async ({ site }) => {
      const all   = getSites();
      const sites = site
        ? all.filter(s => s.name.toLowerCase() === site.toLowerCase() || s.path === site)
        : all;

      if (sites.length === 0) {
        return { content: [{ type: "text" as const, text: "No sites found." }] };
      }

      const lines = sites.map(s => {
        if (!fs.existsSync(s.path)) return `${s.name}: path not found (${s.path})`;
        const bytes = getDirSize(s.path);
        return `${s.name.padEnd(30)} ${formatBytes(bytes).padStart(10)}   ${s.path}`;
      });

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // ── studio_site_health ────────────────────────────────────────────────────

  server.tool(
    "studio_site_health",
    "HTTP health check on a running Studio site — returns status code, response time, and WP headers.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = getSites().find(
        s => s.name.toLowerCase() === site.toLowerCase() || s.path === site
      );

      if (!siteData) {
        return { content: [{ type: "text" as const, text: `Site "${site}" not found in registry.` }], isError: true };
      }

      const url   = `http://localhost:${siteData.port}/`;
      const start = Date.now();

      try {
        const { status, headers } = await httpGet(url);
        const elapsed = Date.now() - start;

        return {
          content: [{
            type: "text" as const,
            text: [
              `Site:          ${siteData.name}`,
              `URL:           ${url}`,
              `Status:        ${status}`,
              `Response time: ${elapsed} ms`,
              `WP version:    ${headers["x-wp-version"] ?? "not exposed"}`,
              `Server:        ${headers["server"] ?? "unknown"}`,
              `X-Powered-By:  ${headers["x-powered-by"] ?? "not set"}`,
            ].join("\n"),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Site unreachable at ${url}\nIs it running? Use: studio site start\nError: ${String(err)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // ── studio_daemon_status ──────────────────────────────────────────────────

  server.tool(
    "studio_daemon_status",
    "Check whether the Studio process manager daemon is running by probing its named pipe / Unix socket.",
    {},
    async () => {
      const alive = await checkSocket(DAEMON_SOCKET);
      return {
        content: [{
          type: "text" as const,
          text: [
            `Daemon socket: ${DAEMON_SOCKET}`,
            `Status:        ${alive ? "✓ RUNNING" : "✗ NOT RUNNING"}`,
            alive
              ? "The Studio daemon is active and accepting connections."
              : "Open the Studio desktop app or run: studio site start",
          ].join("\n"),
        }],
      };
    }
  );

  // ── studio_config_dump ────────────────────────────────────────────────────

  server.tool(
    "studio_config_dump",
    "Dump raw Studio config files — passwords and token values are always redacted.",
    {
      file: z.enum(["cli", "shared", "app", "all"]).optional().default("all")
        .describe("Which config to read: cli | shared | app | all (default: all)"),
    },
    async ({ file }) => {
      const results: string[] = [];

      const redact = (obj: unknown): unknown => {
        if (!obj || typeof obj !== "object") return obj;
        const copy = { ...(obj as Record<string, unknown>) };
        for (const key of Object.keys(copy)) {
          if (/password|token|key|secret|salt/i.test(key)) copy[key] = "[REDACTED]";
          else copy[key] = redact(copy[key]);
        }
        return copy;
      };

      const load = (label: string, filePath: string) => {
        if (!fs.existsSync(filePath)) {
          results.push(`── ${label} (${filePath})\n   File not found.\n`);
          return;
        }
        try {
          const safe = redact(JSON.parse(fs.readFileSync(filePath, "utf-8")));
          results.push(`── ${label} (${filePath})\n${JSON.stringify(safe, null, 2)}\n`);
        } catch {
          results.push(`── ${label} (${filePath})\n   Failed to parse JSON.\n`);
        }
      };

      if (file === "cli"    || file === "all") load("CLI Config",    CLI_CONFIG_PATH);
      if (file === "shared" || file === "all") load("Shared Config", SHARED_CONFIG_PATH);
      if (file === "app"    || file === "all") load("App Config",    APP_CONFIG_PATH);

      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    }
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDirSize(dir: string): number {
  let total = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue;
      const full = `${dir}/${e.name}`;
      total += e.isDirectory() ? getDirSize(full) : fs.statSync(full).size;
    }
  } catch { /* skip inaccessible */ }
  return total;
}

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1024 ** 2)  return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)  return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function checkSocket(sockPath: string): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createConnection(sockPath);
    s.setTimeout(1000);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error",   () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

function httpGet(url: string): Promise<{ status: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, res => {
      res.destroy();
      resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string> });
    });
    req.on("error",   reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}
