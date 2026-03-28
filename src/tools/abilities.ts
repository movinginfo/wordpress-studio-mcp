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

import fs            from "node:fs";
import path          from "node:path";
import { spawnSync } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import {
  findSite,
  STUDIO_HOME,
} from "../studio-config.js";

// ─── GitHub source URLs ───────────────────────────────────────────────────────

const ABILITIES_API_ZIP =
  "https://github.com/WordPress/abilities-api/archive/refs/heads/trunk.zip";
const MCP_ADAPTER_ZIP =
  "https://github.com/WordPress/mcp-adapter/archive/refs/heads/trunk.zip";

// ─── App-password store ───────────────────────────────────────────────────────

const APP_PASSWORDS_FILE = path.join(STUDIO_HOME, "mcp-app-passwords.json");

interface AppPasswordEntry {
  siteId:   string;
  user:     string;
  password: string; // raw password (not base64)
  created:  string;
}

function loadAppPasswords(): AppPasswordEntry[] {
  try {
    return JSON.parse(fs.readFileSync(APP_PASSWORDS_FILE, "utf-8")) as AppPasswordEntry[];
  } catch {
    return [];
  }
}

function saveAppPasswords(entries: AppPasswordEntry[]): void {
  fs.writeFileSync(APP_PASSWORDS_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

function getStoredPassword(siteId: string): AppPasswordEntry | undefined {
  return loadAppPasswords().find(e => e.siteId === siteId);
}

function storePassword(entry: AppPasswordEntry): void {
  const entries = loadAppPasswords().filter(e => e.siteId !== entry.siteId);
  entries.push(entry);
  saveAppPasswords(entries);
}

// ─── WP-CLI runner (bundled Studio node) ─────────────────────────────────────

const STUDIO_NODE = (() => {
  // Try known Studio 1.7.7 path; fall back to bare "studio"
  const candidates = [
    path.join(
      process.env.LOCALAPPDATA ?? path.join(process.env.HOME ?? "~", ".local"),
      "studio_app", "app-1.7.7", "resources", "bin", "node.exe"
    ),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
})();

const STUDIO_CLI_MAIN = (() => {
  const base = path.join(
    process.env.LOCALAPPDATA ?? path.join(process.env.HOME ?? "~", ".local"),
    "studio_app", "app-1.7.7", "resources", "cli", "main.js"
  );
  return fs.existsSync(base) ? base : null;
})();

function studioWp(
  sitePath: string,
  wpArgs: string[]
): { stdout: string; stderr: string; ok: boolean } {
  // Prefer bundled node (bypasses PATH issues in MCP server process)
  if (STUDIO_NODE && STUDIO_CLI_MAIN) {
    const r = spawnSync(
      STUDIO_NODE,
      ["--experimental-wasm-jspi", STUDIO_CLI_MAIN, "wp", "--path", sitePath, ...wpArgs],
      { encoding: "utf-8", timeout: 5 * 60 * 1000, windowsHide: true }
    );
    return {
      stdout: r.stdout?.trim() ?? "",
      stderr: r.stderr?.trim() ?? (r.error?.message ?? ""),
      ok:     r.status === 0,
    };
  }
  // Fallback: studio on PATH
  const r = spawnSync(
    "studio",
    ["wp", "--path", sitePath, ...wpArgs],
    { encoding: "utf-8", timeout: 5 * 60 * 1000, windowsHide: true }
  );
  return {
    stdout: r.stdout?.trim() ?? "",
    stderr: r.stderr?.trim() ?? (r.error?.message ?? ""),
    ok:     r.status === 0,
  };
}

// ─── MCP Adapter HTTP client (MCP 2025-06-18 Streamable HTTP) ────────────────

interface McpCallResult {
  ok:     boolean;
  result?: unknown;
  error?: string;
  raw?:   unknown;
}

/**
 * Execute one MCP tool call against a WordPress site's mcp-adapter endpoint.
 * Handles the MCP initialize → notifications/initialized → tools/call handshake.
 */
async function mcpAdapterCall(
  siteUrl:  string,
  authB64:  string,
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<McpCallResult> {
  const endpoint = `${siteUrl}/wp-json/mcp/mcp-adapter-default-server`;
  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
    "Accept":        "application/json, text/event-stream",
    "Authorization": `Basic ${authB64}`,
  };

  const postJson = async (body: unknown, extra?: Record<string, string>) => {
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: { ...headers, ...extra },
      body:    JSON.stringify(body),
    });
    return res;
  };

  try {
    // ── Step 1: initialize ────────────────────────────────────────────────────
    const initRes = await postJson({
      jsonrpc: "2.0",
      id:      "init-1",
      method:  "initialize",
      params:  {
        protocolVersion: "2025-06-18",
        capabilities:    {},
        clientInfo:      { name: "wordpress-studio-mcp", version: "0.1.12" },
      },
    });

    let sessionId: string | null = initRes.headers.get("Mcp-Session-Id");

    // Parse init response (may be SSE or JSON)
    const contentType = initRes.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      // Read first SSE event for session ID
      const text = await initRes.text();
      const match = text.match(/data:\s*(\{.*\})/);
      if (match) {
        try {
          const data = JSON.parse(match[1]) as Record<string, unknown>;
          if (!sessionId && data?.meta) {
            sessionId = (data.meta as Record<string, unknown>)?.sessionId as string ?? null;
          }
        } catch { /* ignore */ }
      }
    } else {
      await initRes.json().catch(() => null);
    }

    const sessionHeaders: Record<string, string> = sessionId
      ? { "Mcp-Session-Id": sessionId }
      : {};

    // ── Step 2: notifications/initialized ────────────────────────────────────
    await postJson(
      { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      sessionHeaders
    ).then(r => r.text()).catch(() => null);

    // ── Step 3: tools/call ────────────────────────────────────────────────────
    const callRes = await postJson(
      {
        jsonrpc: "2.0",
        id:      "call-1",
        method:  "tools/call",
        params:  { name: toolName, arguments: toolArgs },
      },
      sessionHeaders
    );

    // Handle SSE response
    const callContentType = callRes.headers.get("content-type") ?? "";
    let body: unknown;
    if (callContentType.includes("text/event-stream")) {
      const text = await callRes.text();
      const match = text.match(/data:\s*(\{.*\})/);
      body = match ? JSON.parse(match[1]) : null;
    } else {
      body = await callRes.json();
    }

    const rpc = body as Record<string, unknown>;
    if (rpc?.error) {
      return { ok: false, error: JSON.stringify(rpc.error), raw: rpc };
    }

    const content = (rpc?.result as Record<string, unknown>)?.content;
    if (Array.isArray(content) && content.length > 0) {
      const text = (content[0] as Record<string, unknown>)?.text as string | undefined;
      if (text) {
        try { return { ok: true, result: JSON.parse(text), raw: rpc }; }
        catch { return { ok: true, result: text, raw: rpc }; }
      }
    }
    return { ok: true, result: rpc?.result, raw: rpc };

  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── WP-CLI eval fallback (direct PHP — no HTTP auth needed) ─────────────────

/** List abilities directly via WP-CLI eval — no mcp-adapter plugin required. */
function discoverAbilitiesViaWpCli(sitePath: string): McpCallResult {
  const php = `
$abilities = [];
if (function_exists('wp_get_registered_abilities')) {
  $abilities = wp_get_registered_abilities();
} elseif (isset($GLOBALS['wp_registered_abilities'])) {
  $abilities = $GLOBALS['wp_registered_abilities'];
}
$public = array_values(array_filter($abilities, function($a) {
  return !empty($a['mcp.public']) || !empty($a['mcp_public']);
}));
echo json_encode($public ?: []);
`.trim();

  const r = studioWp(sitePath, ["eval", php]);
  if (!r.ok) return { ok: false, error: r.stderr };
  try {
    return { ok: true, result: JSON.parse(r.stdout) };
  } catch {
    return { ok: false, error: `JSON parse failed: ${r.stdout}` };
  }
}

/** Execute ability directly via WP-CLI eval. */
function callAbilityViaWpCli(
  sitePath: string,
  abilityName: string,
  params: Record<string, unknown>
): McpCallResult {
  const paramsJson = JSON.stringify(params).replace(/'/g, "\\'");
  const php = `
$name   = '${abilityName.replace(/'/g, "\\'")}';
$params = json_decode('${paramsJson}', true) ?: [];
if (function_exists('wp_call_ability')) {
  $result = wp_call_ability($name, $params);
} elseif (isset($GLOBALS['wp_registered_abilities'][$name]['callback'])) {
  $cb = $GLOBALS['wp_registered_abilities'][$name]['callback'];
  $result = call_user_func($cb, $params);
} else {
  $result = ['error' => 'Ability not found or Abilities API not active: ' . $name];
}
echo json_encode(['success' => !is_wp_error($result), 'data' => $result instanceof WP_Error ? $result->get_error_message() : $result]);
`.trim();

  const r = studioWp(sitePath, ["eval", php]);
  if (!r.ok) return { ok: false, error: r.stderr };
  try {
    return { ok: true, result: JSON.parse(r.stdout) };
  } catch {
    return { ok: false, error: `JSON parse failed: ${r.stdout}` };
  }
}

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerAbilitiesTools(server: McpServer): void {

  // ── wp_mcp_adapter_setup ──────────────────────────────────────────────────

  server.tool(
    "wp_mcp_adapter_setup",
    "Install and activate the WordPress Abilities API + MCP Adapter plugins " +
    "(https://github.com/WordPress/mcp-adapter) on a local Studio site. " +
    "Downloads both plugins from GitHub, activates them, installs Composer " +
    "dependencies if composer is available, and creates an Application Password " +
    "stored in ~/.studio/mcp-app-passwords.json for HTTP auth. " +
    "After setup, wp_abilities_discover/info/call can communicate with the site " +
    "via the MCP adapter REST endpoint at /wp-json/mcp/mcp-adapter-default-server.",
    {
      site:      z.string().describe("Site name or absolute path"),
      confirmed: z.boolean().describe("Must be true to apply changes"),
    },
    async ({ site, confirmed }) => {
      const siteData = findSite(site);
      if (!siteData) {
        return { content: [{ type: "text" as const, text: `Site '${site}' not found.` }], isError: true };
      }

      const plan = [
        `MCP Adapter setup plan for: ${siteData.name}`,
        "─".repeat(50),
        `  Site path: ${siteData.path}`,
        `  Site URL:  http://localhost:${siteData.port}`,
        "",
        "Steps:",
        "  1. Install wordpress/abilities-api from GitHub",
        "  2. Install wordpress/mcp-adapter from GitHub",
        "  3. Run composer install (if composer available)",
        "  4. Create Application Password for API auth",
        "",
        confirmed ? "Applying..." : "⚠️  DRY RUN — set confirmed:true to apply",
      ];

      if (!confirmed) {
        return { content: [{ type: "text" as const, text: plan.join("\n") }] };
      }

      const results: string[] = [...plan, ""];

      // ── Step 1: Install abilities-api ───────────────────────────────────────
      results.push("── Step 1: abilities-api ──");
      const checkAbilities = studioWp(siteData.path, ["plugin", "is-installed", "abilities-api"]);
      if (checkAbilities.ok) {
        results.push("  ✅ abilities-api already installed");
      } else {
        const install = studioWp(siteData.path, [
          "plugin", "install", ABILITIES_API_ZIP, "--activate", "--force",
        ]);
        results.push(install.ok
          ? "  ✅ abilities-api installed + activated"
          : `  ⚠️  Install failed: ${install.stderr}`
        );
      }

      // ── Step 2: Install mcp-adapter ─────────────────────────────────────────
      results.push("\n── Step 2: mcp-adapter ──");
      const checkAdapter = studioWp(siteData.path, ["plugin", "is-installed", "mcp-adapter"]);
      if (checkAdapter.ok) {
        results.push("  ✅ mcp-adapter already installed");
      } else {
        const install = studioWp(siteData.path, [
          "plugin", "install", MCP_ADAPTER_ZIP, "--activate", "--force",
        ]);
        results.push(install.ok
          ? "  ✅ mcp-adapter installed + activated"
          : `  ⚠️  Install failed: ${install.stderr}`
        );
      }

      // ── Step 3: Composer dependencies ──────────────────────────────────────
      results.push("\n── Step 3: Composer dependencies ──");
      const pluginDir = path.join(siteData.path, "wp-content", "plugins", "mcp-adapter");
      const composerJson = path.join(pluginDir, "composer.json");
      const vendorDir    = path.join(pluginDir, "vendor");

      if (!fs.existsSync(composerJson)) {
        // Try the archive directory name used by GitHub zip downloads
        const altDir = path.join(siteData.path, "wp-content", "plugins", "mcp-adapter-trunk");
        results.push(`  ℹ️  Plugin dir: ${fs.existsSync(altDir) ? altDir : pluginDir}`);
      }

      if (fs.existsSync(vendorDir)) {
        results.push("  ✅ Composer vendor/ directory already present");
      } else {
        const composerCheck = spawnSync("composer", ["--version"], {
          encoding: "utf-8", timeout: 10_000, windowsHide: true,
        });
        if (composerCheck.status === 0) {
          const composerDir = fs.existsSync(composerJson) ? pluginDir
            : path.join(siteData.path, "wp-content", "plugins", "mcp-adapter-trunk");
          if (fs.existsSync(path.join(composerDir, "composer.json"))) {
            const ci = spawnSync("composer", ["install", "--no-dev", "--optimize-autoloader"], {
              encoding: "utf-8", timeout: 120_000, windowsHide: true, cwd: composerDir,
            });
            results.push(ci.status === 0
              ? `  ✅ composer install completed in ${composerDir}`
              : `  ⚠️  composer install failed: ${ci.stderr?.trim() ?? ci.stdout?.trim()}`
            );
          } else {
            results.push("  ⚠️  composer.json not found in plugin directory");
            results.push(`      Expected: ${composerJson}`);
            results.push("      The GitHub zip installs as 'mcp-adapter-trunk' — rename manually if needed");
          }
        } else {
          results.push("  ⚠️  composer not found — vendor/ directory missing");
          results.push("      Install Composer: https://getcomposer.org/download/");
          results.push(`      Then run manually: cd '${pluginDir}' && composer install --no-dev`);
        }
      }

      // ── Step 4: Application Password ────────────────────────────────────────
      results.push("\n── Step 4: Application Password ──");

      // Check if we already have one stored
      const existing = getStoredPassword(siteData.id);
      if (existing) {
        results.push(`  ✅ Application Password already stored for '${existing.user}'`);
        results.push(`     (created ${existing.created})`);
      } else {
        // Get admin username
        const userList = studioWp(siteData.path, [
          "user", "list", "--role=administrator", "--field=user_login", "--format=csv",
        ]);
        const adminUser = userList.stdout.split("\n").find(u => u.trim()) ?? "admin";

        // Create application password
        const appPass = studioWp(siteData.path, [
          "user", "application-password", "create", adminUser, "mcp-studio-client",
          "--porcelain",
        ]);

        if (appPass.ok && appPass.stdout) {
          const pwd = appPass.stdout.trim();
          storePassword({
            siteId:   siteData.id,
            user:     adminUser,
            password: pwd,
            created:  new Date().toISOString(),
          });
          results.push(`  ✅ Application Password created for '${adminUser}'`);
          results.push(`     Stored in ${APP_PASSWORDS_FILE}`);
        } else {
          results.push(`  ⚠️  Could not create Application Password: ${appPass.stderr}`);
          results.push("      Site may not be running — start it in Studio first");
        }
      }

      // ── Summary ─────────────────────────────────────────────────────────────
      results.push("\n" + "─".repeat(50));
      results.push("✅  Setup complete (check warnings above if any).");
      results.push("");
      results.push("Next steps:");
      results.push(`  1. Restart the site in Studio (stop → start)`);
      results.push(`  2. Try: wp_abilities_discover  site:${siteData.name}`);
      results.push(`  3. MCP adapter endpoint: http://localhost:${siteData.port}/wp-json/mcp/mcp-adapter-default-server`);

      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    }
  );

  // ── wp_abilities_discover ─────────────────────────────────────────────────

  server.tool(
    "wp_abilities_discover",
    "List all WordPress abilities registered with mcp.public=true on a Studio site. " +
    "Abilities are capabilities registered by plugins, themes, or core via the " +
    "WordPress Abilities API (https://github.com/WordPress/abilities-api). " +
    "Uses the MCP adapter REST endpoint (HTTP) when the adapter is installed, " +
    "falls back to WP-CLI eval for direct PHP access. " +
    "Returns name, label, description, type, and parameters for each ability.",
    {
      site:    z.string().describe("Site name or absolute path"),
      via:     z.enum(["http", "wpcli", "auto"]).optional().default("auto")
               .describe("Transport: 'http' uses MCP adapter endpoint, 'wpcli' uses eval, 'auto' tries HTTP first"),
    },
    async ({ site, via }) => {
      const siteData = findSite(site);
      if (!siteData) {
        return { content: [{ type: "text" as const, text: `Site '${site}' not found.` }], isError: true };
      }

      const lines: string[] = [`Discovering abilities on: ${siteData.name}`, "─".repeat(50), ""];

      // ── HTTP via MCP adapter ──────────────────────────────────────────────
      if (via === "http" || via === "auto") {
        const stored = getStoredPassword(siteData.id);
        if (!stored && via === "http") {
          return {
            content: [{ type: "text" as const, text:
              `No Application Password stored for '${siteData.name}'.\n` +
              `Run: wp_mcp_adapter_setup  site:${siteData.name}  confirmed:true`
            }],
            isError: true,
          };
        }

        if (stored) {
          const authB64 = Buffer.from(`${stored.user}:${stored.password}`).toString("base64");
          const siteUrl = `http://localhost:${siteData.port}`;
          lines.push("Transport: HTTP → MCP adapter endpoint");
          const result = await mcpAdapterCall(siteUrl, authB64, "mcp-adapter/discover-abilities", {});

          if (result.ok) {
            const abilities = (result.result as Record<string, unknown>)?.abilities ?? result.result;
            if (Array.isArray(abilities) && abilities.length > 0) {
              lines.push(`Found ${abilities.length} public abilities:\n`);
              for (const a of abilities as Record<string, string>[]) {
                lines.push(`  ${a.name ?? "unknown"}`);
                if (a.label)       lines.push(`    Label:       ${a.label}`);
                if (a.description) lines.push(`    Description: ${a.description}`);
                lines.push("");
              }
            } else {
              lines.push("No public abilities found (mcp.public=true).");
              lines.push("Register abilities using wp_register_ability() with mcp.public=true.");
            }
            return { content: [{ type: "text" as const, text: lines.join("\n") }] };
          }

          if (via === "http") {
            lines.push(`⚠️  HTTP call failed: ${result.error}`);
            lines.push("    Is the site running? Is mcp-adapter plugin active?");
            return { content: [{ type: "text" as const, text: lines.join("\n") }] };
          }
          // Fall through to WP-CLI
          lines.push(`⚠️  HTTP failed (${result.error}) — falling back to WP-CLI eval\n`);
        } else {
          lines.push("ℹ️  No stored Application Password — using WP-CLI eval\n");
        }
      }

      // ── WP-CLI eval fallback ──────────────────────────────────────────────
      lines.push("Transport: WP-CLI eval (direct PHP)");
      const result = discoverAbilitiesViaWpCli(siteData.path);

      if (!result.ok) {
        lines.push(`❌ WP-CLI eval failed: ${result.error}`);
        lines.push("");
        lines.push("Possible reasons:");
        lines.push("  • Site is not running (start it in Studio first)");
        lines.push("  • Abilities API not installed");
        lines.push(`  • Run wp_mcp_adapter_setup  site:${siteData.name}  confirmed:true`);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      const abilities = result.result as Record<string, unknown>[];
      if (abilities.length === 0) {
        lines.push("No public abilities found (mcp.public=true).");
        lines.push("Install abilities-api plugin and register abilities with mcp.public=true.");
      } else {
        lines.push(`Found ${abilities.length} public abilities:\n`);
        for (const a of abilities) {
          lines.push(`  ${String(a.name ?? "unknown")}`);
          if (a.label)       lines.push(`    Label:       ${String(a.label)}`);
          if (a.description) lines.push(`    Description: ${String(a.description)}`);
          if (a.type)        lines.push(`    Type:        ${String(a.type)}`);
          lines.push("");
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // ── wp_abilities_info ─────────────────────────────────────────────────────

  server.tool(
    "wp_abilities_info",
    "Get the full schema for a specific WordPress ability — parameters, return type, " +
    "description, permission requirements, and type (tool/resource/prompt). " +
    "Uses the MCP adapter /get-ability-info endpoint or WP-CLI eval.",
    {
      site:    z.string().describe("Site name or absolute path"),
      ability: z.string().describe("Ability name, e.g. 'my-plugin/create-post'"),
      via:     z.enum(["http", "wpcli", "auto"]).optional().default("auto"),
    },
    async ({ site, ability, via }) => {
      const siteData = findSite(site);
      if (!siteData) {
        return { content: [{ type: "text" as const, text: `Site '${site}' not found.` }], isError: true };
      }

      // ── HTTP ──────────────────────────────────────────────────────────────
      if (via !== "wpcli") {
        const stored = getStoredPassword(siteData.id);
        if (stored) {
          const authB64 = Buffer.from(`${stored.user}:${stored.password}`).toString("base64");
          const result  = await mcpAdapterCall(
            `http://localhost:${siteData.port}`, authB64,
            "mcp-adapter/get-ability-info", { ability_name: ability }
          );
          if (result.ok) {
            return { content: [{ type: "text" as const, text: JSON.stringify(result.result, null, 2) }] };
          }
          if (via === "http") {
            return { content: [{ type: "text" as const, text: `Error: ${result.error}` }], isError: true };
          }
        }
      }

      // ── WP-CLI eval ───────────────────────────────────────────────────────
      const php = `
$name = '${ability.replace(/'/g, "\\'")}';
$abilities = function_exists('wp_get_registered_abilities') ? wp_get_registered_abilities() : [];
$found = $abilities[$name] ?? null;
if (!$found) {
  foreach ($abilities as $a) {
    if (($a['name'] ?? '') === $name) { $found = $a; break; }
  }
}
echo json_encode($found ?: ['error' => 'Ability not found: ' . $name]);
`.trim();

      const r = studioWp(siteData.path, ["eval", php]);
      if (!r.ok) {
        return { content: [{ type: "text" as const, text: `WP-CLI eval failed: ${r.stderr}` }], isError: true };
      }
      try {
        const info = JSON.parse(r.stdout);
        return { content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: r.stdout }] };
      }
    }
  );

  // ── wp_abilities_call ─────────────────────────────────────────────────────

  server.tool(
    "wp_abilities_call",
    "Execute a WordPress ability with parameters and return the result. " +
    "Abilities are callable units registered by WordPress plugins, themes, or core. " +
    "Use wp_abilities_discover first to find available ability names. " +
    "Uses the MCP adapter /execute-ability endpoint (HTTP) or WP-CLI eval fallback. " +
    "The MCP adapter runs the ability's callback and returns its result as JSON.",
    {
      site:    z.string().describe("Site name or absolute path"),
      ability: z.string().describe("Ability name, e.g. 'my-plugin/create-post'"),
      params:  z.record(z.unknown()).optional().default({})
               .describe("Parameters to pass to the ability callback (JSON object)"),
      via:     z.enum(["http", "wpcli", "auto"]).optional().default("auto"),
    },
    async ({ site, ability, params, via }) => {
      const siteData = findSite(site);
      if (!siteData) {
        return { content: [{ type: "text" as const, text: `Site '${site}' not found.` }], isError: true };
      }

      const lines: string[] = [
        `Calling ability: ${ability}`,
        `Site:            ${siteData.name}`,
        `Params:          ${JSON.stringify(params)}`,
        "─".repeat(50),
        "",
      ];

      // ── HTTP ──────────────────────────────────────────────────────────────
      if (via !== "wpcli") {
        const stored = getStoredPassword(siteData.id);
        if (stored) {
          const authB64 = Buffer.from(`${stored.user}:${stored.password}`).toString("base64");
          const result  = await mcpAdapterCall(
            `http://localhost:${siteData.port}`, authB64,
            "mcp-adapter/execute-ability", { ability_name: ability, params }
          );
          if (result.ok) {
            lines.push("✅ Ability executed via HTTP MCP adapter\n");
            lines.push(JSON.stringify(result.result, null, 2));
            return { content: [{ type: "text" as const, text: lines.join("\n") }] };
          }
          if (via === "http") {
            lines.push(`❌ HTTP call failed: ${result.error}`);
            return { content: [{ type: "text" as const, text: lines.join("\n") }], isError: true };
          }
          lines.push(`⚠️  HTTP failed (${result.error}) — falling back to WP-CLI eval\n`);
        }
      }

      // ── WP-CLI eval ───────────────────────────────────────────────────────
      lines.push("Transport: WP-CLI eval");
      const result = callAbilityViaWpCli(siteData.path, ability, params as Record<string, unknown>);

      if (!result.ok) {
        lines.push(`❌ Failed: ${result.error}`);
        return { content: [{ type: "text" as const, text: lines.join("\n") }], isError: true };
      }

      lines.push("✅ Ability executed via WP-CLI eval\n");
      lines.push(JSON.stringify(result.result, null, 2));
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
