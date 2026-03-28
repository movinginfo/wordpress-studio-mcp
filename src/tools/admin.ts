/**
 * tools/admin.ts
 *
 * WordPress administration tools derived from the Advanced Administration Handbook.
 * Covers: wp-config.php constant management, security auditing, PHP runtime info,
 * database backup, cron event listing, and bulk plugin/theme updates.
 *
 * Reference: https://github.com/WordPress/Advanced-administration-handbook
 */

import fs            from "node:fs";
import path          from "node:path";
import { spawnSync } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import { findSite, STUDIO_SITES_ROOT } from "../studio-config.js";

// ─── Shared WP-CLI runner ─────────────────────────────────────────────────────

function studioWp(
  sitePath: string,
  wpArgs: string[]
): { stdout: string; stderr: string; ok: boolean } {
  const result = spawnSync(
    "studio",
    ["wp", "--path", sitePath, ...wpArgs],
    { encoding: "utf-8", timeout: 5 * 60 * 1000, windowsHide: true }
  );
  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? (result.error?.message ?? ""),
    ok:     result.status === 0,
  };
}

// ─── wp-config.php helpers ────────────────────────────────────────────────────

const STOP_EDITING_MARKER = "/* That's all, stop editing!";
const ALT_STOP_MARKER     = "/** Absolute path";

/** Serialize a JS value to a PHP literal */
function toPhpLiteral(value: string | boolean | number): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number")  return String(value);
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * Read, modify, and write wp-config.php in-place.
 * value = null → remove the constant.
 */
function wpConfigUpdate(
  wpConfigPath: string,
  constant: string,
  value: string | boolean | number | null
): { changed: boolean; message: string } {
  const original = fs.readFileSync(wpConfigPath, "utf-8");

  if (value === null) {
    // Remove the constant line entirely
    const lineRe = new RegExp(
      `^[^\\n]*define\\s*\\(\\s*['"]${constant}['"]\\s*,[^)]+\\)\\s*;[^\\n]*\\n?`,
      "m"
    );
    if (!lineRe.test(original)) {
      return { changed: false, message: `Constant ${constant} not found — nothing to remove.` };
    }
    fs.writeFileSync(wpConfigPath, original.replace(lineRe, ""), "utf-8");
    return { changed: true, message: `Removed define('${constant}', …).` };
  }

  const literal = toPhpLiteral(value);

  // Match existing define( 'CONSTANT', <value> );
  const existRe = new RegExp(
    `(define\\s*\\(\\s*['"]${constant}['"]\\s*,\\s*)([^)]+)(\\)\\s*;)`,
    "m"
  );

  if (existRe.test(original)) {
    const updated = original.replace(existRe, `$1${literal}$3`);
    if (updated === original) {
      return { changed: false, message: `${constant} is already ${literal}.` };
    }
    fs.writeFileSync(wpConfigPath, updated, "utf-8");
    return { changed: true, message: `Updated define('${constant}', ${literal}).` };
  }

  // Insert new constant before the stop-editing marker
  const newLine = `define( '${constant}', ${literal} );\n`;
  let updated: string;
  if (original.includes(STOP_EDITING_MARKER)) {
    updated = original.replace(STOP_EDITING_MARKER, newLine + STOP_EDITING_MARKER);
  } else if (original.includes(ALT_STOP_MARKER)) {
    updated = original.replace(ALT_STOP_MARKER, newLine + ALT_STOP_MARKER);
  } else {
    // Fallback: strip closing PHP tag and append
    updated = original.replace(/\?>\s*$/, "") + newLine + "?>";
  }
  fs.writeFileSync(wpConfigPath, updated, "utf-8");
  return { changed: true, message: `Added define('${constant}', ${literal}).` };
}

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerAdminTools(server: McpServer): void {

  // ── wp_config_set ─────────────────────────────────────────────────────────

  server.tool(
    "wp_config_set",
    "Add, update, or remove a constant in wp-config.php without rewriting the whole file. " +
    "A backup is saved as wp-config.php.bak before every write. " +
    "Supports string, boolean, integer, and null (to remove the constant). " +
    "Common constants: WP_DEBUG, WP_DEBUG_LOG, WP_DEBUG_DISPLAY, DISALLOW_FILE_EDIT, " +
    "DISALLOW_FILE_MODS, FORCE_SSL_ADMIN, WP_MEMORY_LIMIT, WP_AUTO_UPDATE_CORE, " +
    "DISABLE_WP_CRON, SAVEQUERIES, WP_SITEURL, WP_HOME.",
    {
      site:     z.string().describe("Site name or absolute site path"),
      constant: z.string().describe("Constant name, e.g. 'WP_DEBUG'"),
      value:    z.union([z.string(), z.boolean(), z.number(), z.null()])
                 .describe("New value. Pass null to remove the constant."),
    },
    async ({ site, constant, value }) => {
      const siteData     = findSite(site);
      const siteRoot     = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const wpConfigPath = path.join(siteRoot, "wp-config.php");

      if (!fs.existsSync(wpConfigPath)) {
        return {
          content: [{ type: "text" as const, text: `wp-config.php not found at ${wpConfigPath}` }],
          isError: true,
        };
      }

      try {
        fs.copyFileSync(wpConfigPath, wpConfigPath + ".bak");
        const result = wpConfigUpdate(wpConfigPath, constant, value);
        const suffix  = result.changed ? "\n(Backup saved as wp-config.php.bak)" : "";
        return { content: [{ type: "text" as const, text: result.message + suffix }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── wp_security_audit ─────────────────────────────────────────────────────

  server.tool(
    "wp_security_audit",
    "Run a security checklist against a Studio site based on the WordPress Advanced " +
    "Administration Handbook hardening guide. Checks: WP_DEBUG, DISALLOW_FILE_EDIT, " +
    "DISALLOW_FILE_MODS, FORCE_SSL_ADMIN, table prefix, admin username, WP_AUTO_UPDATE_CORE, " +
    "WP_DEBUG_DISPLAY, world-writable files (Linux/macOS).",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData     = findSite(site);
      const siteRoot     = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const wpConfigPath = path.join(siteRoot, "wp-config.php");

      type Status = "PASS" | "WARN" | "FAIL";
      const checks: { label: string; status: Status; detail: string }[] = [];

      let config = "";
      if (fs.existsSync(wpConfigPath)) {
        config = fs.readFileSync(wpConfigPath, "utf-8");
      }

      /** Extract the raw value token of a define() constant */
      const getConst = (name: string): string | null => {
        const m = config.match(
          new RegExp(`define\\s*\\(\\s*['"]${name}['"]\\s*,\\s*([^)]+)\\)`, "i")
        );
        return m ? m[1].trim() : null;
      };

      // 1 — WP_DEBUG
      const wpDebug = getConst("WP_DEBUG");
      checks.push({
        label:  "WP_DEBUG",
        status: !wpDebug || wpDebug === "false" ? "PASS" : "WARN",
        detail: !wpDebug || wpDebug === "false"
          ? "WP_DEBUG is off ✓"
          : `WP_DEBUG = ${wpDebug} — disable in production`,
      });

      // 2 — WP_DEBUG_DISPLAY
      const debugDisplay = getConst("WP_DEBUG_DISPLAY");
      const debugLog     = getConst("WP_DEBUG_LOG");
      if (debugLog === "true" && debugDisplay === "true") {
        checks.push({ label: "WP_DEBUG_DISPLAY", status: "FAIL",
          detail: "WP_DEBUG_DISPLAY=true — PHP errors visible to visitors!" });
      } else if (debugLog === "true") {
        checks.push({ label: "WP_DEBUG_DISPLAY", status: "PASS",
          detail: "WP_DEBUG_LOG=true, WP_DEBUG_DISPLAY=false — safe logging pattern ✓" });
      } else {
        checks.push({ label: "WP_DEBUG_DISPLAY", status: "PASS", detail: "Debug display off ✓" });
      }

      // 3 — DISALLOW_FILE_EDIT
      const fileEdit = getConst("DISALLOW_FILE_EDIT");
      checks.push({
        label:  "DISALLOW_FILE_EDIT",
        status: fileEdit === "true" ? "PASS" : "WARN",
        detail: fileEdit === "true"
          ? "Theme/plugin editor disabled ✓"
          : "Not set — code editor accessible from WP admin dashboard",
      });

      // 4 — DISALLOW_FILE_MODS
      const fileMods = getConst("DISALLOW_FILE_MODS");
      checks.push({
        label:  "DISALLOW_FILE_MODS",
        status: fileMods === "true" ? "PASS" : "WARN",
        detail: fileMods === "true"
          ? "Plugin/theme installs disabled ✓"
          : "Not set — plugin/theme installs allowed from dashboard",
      });

      // 5 — FORCE_SSL_ADMIN
      const sslAdmin = getConst("FORCE_SSL_ADMIN");
      checks.push({
        label:  "FORCE_SSL_ADMIN",
        status: sslAdmin === "true" ? "PASS" : "WARN",
        detail: sslAdmin === "true"
          ? "Admin requires HTTPS ✓"
          : "Not set — acceptable for local dev, required on production",
      });

      // 6 — Table prefix
      const prefixM = config.match(/\$table_prefix\s*=\s*'([^']+)'/);
      const prefix   = prefixM ? prefixM[1] : null;
      checks.push({
        label:  "Table prefix",
        status: prefix && prefix !== "wp_" ? "PASS" : "WARN",
        detail: prefix
          ? prefix === "wp_"
            ? "Default prefix 'wp_' — consider changing to reduce SQL injection risk"
            : `Custom prefix '${prefix}' ✓`
          : "Could not determine table prefix",
      });

      // 7 — Admin username via WP-CLI
      const userCheck = studioWp(siteRoot, ["user", "get", "admin", "--field=user_login"]);
      checks.push({
        label:  "Admin username",
        status: userCheck.ok ? "WARN" : "PASS",
        detail: userCheck.ok
          ? "User 'admin' exists — consider a custom username to reduce brute-force risk"
          : "No user with login 'admin' found ✓",
      });

      // 8 — WP_AUTO_UPDATE_CORE
      const autoUpdate = getConst("WP_AUTO_UPDATE_CORE");
      const autoOk     = !autoUpdate || autoUpdate === "'minor'" || autoUpdate === "true";
      checks.push({
        label:  "WP_AUTO_UPDATE_CORE",
        status: autoOk ? "PASS" : "WARN",
        detail: autoUpdate
          ? autoOk ? `Auto-update = ${autoUpdate} ✓` : `Auto-update disabled (${autoUpdate})`
          : "Defaults to minor auto-updates ✓",
      });

      // 9 — World-writable files (Linux/macOS only)
      if (process.platform === "win32") {
        checks.push({
          label: "World-writable files", status: "PASS",
          detail: "Skipped on Windows (NTFS ACL model)",
        });
      } else {
        const worldWritable: string[] = [];
        for (const dir of [siteRoot, path.join(siteRoot, "wp-content")]) {
          if (!fs.existsSync(dir)) continue;
          for (const entry of fs.readdirSync(dir)) {
            try {
              const stat = fs.statSync(path.join(dir, entry));
              if (stat.mode & 0o002) worldWritable.push(path.relative(siteRoot, path.join(dir, entry)));
            } catch { /* skip */ }
          }
        }
        checks.push({
          label:  "World-writable files",
          status: worldWritable.length === 0 ? "PASS" : "FAIL",
          detail: worldWritable.length === 0
            ? "No world-writable files found ✓"
            : `World-writable: ${worldWritable.slice(0, 10).join(", ")}`,
        });
      }

      const icon = (s: Status) => s === "PASS" ? "✅" : s === "WARN" ? "⚠️ " : "❌";
      const pass = checks.filter(c => c.status === "PASS").length;
      const warn = checks.filter(c => c.status === "WARN").length;
      const fail = checks.filter(c => c.status === "FAIL").length;

      const lines = [
        `Security Audit — ${site}`,
        "─".repeat(50),
        ...checks.map(c => `${icon(c.status)} ${c.label.padEnd(22)} ${c.detail}`),
        "─".repeat(50),
        `Result: ${pass} passed · ${warn} warnings · ${fail} failed`,
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // ── wp_php_info ───────────────────────────────────────────────────────────

  server.tool(
    "wp_php_info",
    "Get PHP runtime configuration for a Studio site: version, memory limits, upload limits, " +
    "execution timeout, and WordPress memory/debug constants. Site must be running.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);

      const phpCode =
        "echo json_encode([" +
        "'php_version'=>PHP_VERSION," +
        "'memory_limit'=>ini_get('memory_limit')," +
        "'upload_max_filesize'=>ini_get('upload_max_filesize')," +
        "'post_max_size'=>ini_get('post_max_size')," +
        "'max_execution_time'=>ini_get('max_execution_time')," +
        "'max_input_time'=>ini_get('max_input_time')," +
        "'wp_memory_limit'=>defined('WP_MEMORY_LIMIT')?WP_MEMORY_LIMIT:'40M'," +
        "'wp_max_memory_limit'=>defined('WP_MAX_MEMORY_LIMIT')?WP_MAX_MEMORY_LIMIT:'256M'," +
        "'wp_debug'=>defined('WP_DEBUG')?WP_DEBUG:false," +
        "'savequeries'=>defined('SAVEQUERIES')?SAVEQUERIES:false," +
        "'disable_wp_cron'=>defined('DISABLE_WP_CRON')?DISABLE_WP_CRON:false" +
        "],JSON_PRETTY_PRINT);";

      const { stdout, stderr, ok } = studioWp(sitePath, ["eval", phpCode]);

      if (!ok) {
        return {
          content: [{ type: "text" as const, text: stderr || "Failed to get PHP info. Is the site running?" }],
          isError: true,
        };
      }

      try {
        const info = JSON.parse(stdout) as Record<string, unknown>;
        const lines = [
          `PHP Info — ${site}`,
          "─".repeat(40),
          `PHP Version:            ${info.php_version}`,
          `Memory Limit (php.ini): ${info.memory_limit}`,
          `WP_MEMORY_LIMIT:        ${info.wp_memory_limit}`,
          `WP_MAX_MEMORY_LIMIT:    ${info.wp_max_memory_limit}`,
          `Upload Max Filesize:    ${info.upload_max_filesize}`,
          `Post Max Size:          ${info.post_max_size}`,
          `Max Execution Time:     ${info.max_execution_time}s`,
          `Max Input Time:         ${info.max_input_time}s`,
          "─".repeat(40),
          `WP_DEBUG:               ${info.wp_debug}`,
          `SAVEQUERIES:            ${info.savequeries}`,
          `DISABLE_WP_CRON:        ${info.disable_wp_cron}`,
        ];
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch {
        return { content: [{ type: "text" as const, text: stdout }] };
      }
    }
  );

  // ── wpcli_db_backup ───────────────────────────────────────────────────────

  server.tool(
    "wpcli_db_backup",
    "Export the WordPress database to a .sql file. " +
    "Defaults to ~/Studio/backups/{site}-{YYYY-MM-DD}.sql. " +
    "Always run before upgrades, migrations, or destructive operations.",
    {
      site:        z.string().describe("Site name or absolute site path"),
      output_path: z.string().optional().describe(
        "Absolute output path for the .sql file. " +
        "Default: ~/Studio/backups/{site}-{YYYY-MM-DD}.sql"
      ),
    },
    async ({ site, output_path }) => {
      const siteData  = findSite(site);
      const sitePath  = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const siteName  = siteData?.name ?? site;
      const date      = new Date().toISOString().slice(0, 10);
      const backupDir = path.join(path.dirname(STUDIO_SITES_ROOT), "backups");
      const outFile   = output_path ?? path.join(backupDir, `${siteName}-${date}.sql`);

      fs.mkdirSync(path.dirname(outFile), { recursive: true });

      const { stdout, stderr, ok } = studioWp(sitePath, ["db", "export", outFile, "--porcelain"]);

      if (ok) {
        const size = fs.existsSync(outFile)
          ? (fs.statSync(outFile).size / 1024 / 1024).toFixed(2) + " MB"
          : "unknown";
        return {
          content: [{ type: "text" as const, text: `✓ Database exported\n  Path: ${outFile}\n  Size: ${size}` }],
        };
      }
      return { content: [{ type: "text" as const, text: stderr || "DB export failed." }], isError: true };
    }
  );

  // ── wpcli_cron_list ───────────────────────────────────────────────────────

  server.tool(
    "wpcli_cron_list",
    "List all scheduled WordPress cron events for a Studio site — hook name, " +
    "next run time, recurrence interval, and arguments. " +
    "Use to audit cron load, diagnose missed events, or verify DISABLE_WP_CRON setup.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);

      const { stdout, stderr, ok } = studioWp(sitePath, [
        "cron", "event", "list",
        "--fields=hook,next_run_relative,schedule,args",
        "--format=table",
      ]);

      return {
        content: [{ type: "text" as const, text: ok ? (stdout || "No cron events found.") : stderr }],
        isError: !ok,
      };
    }
  );

  // ── wpcli_update_all ──────────────────────────────────────────────────────

  server.tool(
    "wpcli_update_all",
    "Update all plugins and/or themes on a Studio site to their latest available versions. " +
    "Run wpcli_db_backup first to have a restore point. " +
    "Use dry_run: true to preview what would be updated without applying changes.",
    {
      site:    z.string().describe("Site name or absolute site path"),
      what:    z.enum(["plugins", "themes", "both"])
                .optional().default("both")
                .describe("What to update: 'plugins', 'themes', or 'both' (default)"),
      dry_run: z.boolean()
                .optional().default(false)
                .describe("Preview available updates without applying (default: false)"),
    },
    async ({ site, what, dry_run }) => {
      const siteData = findSite(site);
      const sitePath = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const lines: string[] = [];

      const run = (type: "plugin" | "theme") => {
        const args = [type, "update", "--all", "--format=table"];
        if (dry_run) args.push("--dry-run");
        const { stdout, stderr, ok } = studioWp(sitePath, args);
        lines.push(`── ${type === "plugin" ? "Plugins" : "Themes"} ──`);
        lines.push(ok ? (stdout || `All ${type}s already up to date.`) : stderr);
      };

      if (what === "plugins" || what === "both") run("plugin");
      if (what === "themes"  || what === "both") run("theme");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
