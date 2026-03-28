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
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { findSite, CLI_CONFIG_PATH, } from "../studio-config.js";
/**
 * Patch enableXdebug for one (or all) sites in cli.json.
 * Returns the updated site entry or null on failure.
 */
function patchXdebug(targetId, // null = update ALL sites (bulk disable)
value) {
    try {
        const raw = fs.readFileSync(CLI_CONFIG_PATH, "utf-8");
        const cfg = JSON.parse(raw);
        let changed = false;
        for (const site of cfg.sites) {
            if (targetId === null || site.id === targetId) {
                site.enableXdebug = value;
                changed = true;
            }
        }
        if (!changed)
            return { ok: false, message: `Site id '${targetId}' not found in cli.json` };
        fs.writeFileSync(CLI_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
        return { ok: true, message: "cli.json updated" };
    }
    catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
}
/** Read cli.json as raw CliSite[] — includes all fields incl. enableXdebug. */
function readRawSites() {
    try {
        const raw = fs.readFileSync(CLI_CONFIG_PATH, "utf-8");
        return JSON.parse(raw).sites ?? [];
    }
    catch {
        return [];
    }
}
/** Return the site (if any) that currently has enableXdebug=true. */
function getXdebugSite() {
    return readRawSites().find(s => s.enableXdebug === true);
}
// ─── VS Code launch.json generator ───────────────────────────────────────────
function generateVsCodeLaunchJson(sitePath, sitePort) {
    const mapping = sitePath.replace(/\\/g, "/");
    return JSON.stringify({
        version: "0.2.0",
        configurations: [
            {
                name: "Listen for Xdebug (WordPress Studio)",
                type: "php",
                request: "launch",
                port: 9003,
                pathMappings: {
                    "/wordpress": mapping,
                },
                log: true,
                xdebugSettings: {
                    max_data: 512,
                    show_hidden: 1,
                    max_depth: 5,
                },
                comment: `Studio site on http://localhost:${sitePort} — restart site after enabling Xdebug`,
            },
        ],
    }, null, 2);
}
// ─── Tool registration ────────────────────────────────────────────────────────
export function registerXdebugTools(server) {
    // ── studio_xdebug_enable ──────────────────────────────────────────────────
    server.tool("studio_xdebug_enable", "Enable Xdebug on a WordPress Studio site. " +
        "Studio allows only ONE site to have Xdebug active at a time — this tool " +
        "automatically disables Xdebug on any other site before enabling it on the target. " +
        "Patches enableXdebug:true in ~/.studio/cli.json. " +
        "The site must be restarted (stop → start in Studio UI) for the change to take effect. " +
        "Xdebug listens on port 9003. Use studio_xdebug_ide_config to generate IDE launch config.", {
        site: z.string().describe("Site name or absolute path"),
        confirmed: z.boolean().describe("Must be true to apply"),
    }, async ({ site, confirmed }) => {
        const siteData = findSite(site);
        if (!siteData) {
            return { content: [{ type: "text", text: `Site '${site}' not found.` }], isError: true };
        }
        // Check if another site already has Xdebug on
        const current = getXdebugSite();
        const alreadyThis = current?.id === siteData.id;
        const plan = [
            `Enable Xdebug on: ${siteData.name}`,
            "─".repeat(50),
            `  Site path: ${siteData.path}`,
            `  Site URL:  http://localhost:${siteData.port}`,
            `  Xdebug port: 9003`,
            "",
        ];
        if (alreadyThis) {
            plan.push("ℹ️  Xdebug is already enabled on this site.");
            plan.push("    Restart the site in Studio to ensure it's active.");
        }
        else if (current) {
            plan.push(`⚠️  Xdebug is currently ON for: ${current.name}`);
            plan.push(`    It will be disabled automatically (Studio only allows one at a time).`);
        }
        plan.push("");
        plan.push(confirmed ? "Applying..." : "⚠️  DRY RUN — set confirmed:true to apply");
        if (!confirmed) {
            return { content: [{ type: "text", text: plan.join("\n") }] };
        }
        const results = [...plan, ""];
        // Disable on all other sites first
        if (current && !alreadyThis) {
            const r = patchXdebug(current.id, false);
            results.push(`Disabled Xdebug on '${current.name}': ${r.ok ? "✅" : "⚠️  " + r.message}`);
        }
        // Enable on target
        const r = patchXdebug(siteData.id, true);
        results.push(`Enable Xdebug on '${siteData.name}': ${r.ok ? "✅" : "❌ " + r.message}`);
        results.push("");
        results.push("─".repeat(50));
        results.push(r.ok ? "✅  Done." : "❌  Failed — check above.");
        results.push("");
        results.push("Next steps:");
        results.push("  1. Restart the site in Studio UI (stop → start)");
        results.push("  2. Run: studio_xdebug_ide_config  site:" + siteData.name + "  ide:vscode");
        results.push("     to generate .vscode/launch.json");
        results.push("  3. Open the site folder in VS Code");
        results.push("  4. Press F5 (Start Debugging) → set breakpoints → load site in browser");
        return { content: [{ type: "text", text: results.join("\n") }] };
    });
    // ── studio_xdebug_disable ─────────────────────────────────────────────────
    server.tool("studio_xdebug_disable", "Disable Xdebug on a WordPress Studio site. " +
        "Sets enableXdebug:false in ~/.studio/cli.json. " +
        "Restart the site after running to restore normal PHP performance.", {
        site: z.string().describe("Site name or absolute path"),
        confirmed: z.boolean().describe("Must be true to apply"),
    }, async ({ site, confirmed }) => {
        const siteData = findSite(site);
        if (!siteData) {
            return { content: [{ type: "text", text: `Site '${site}' not found.` }], isError: true };
        }
        if (!confirmed) {
            return {
                content: [{
                        type: "text",
                        text: [
                            `Disable Xdebug on: ${siteData.name}`,
                            "─".repeat(50),
                            `  Will set enableXdebug:false in ~/.studio/cli.json`,
                            "  Restart site in Studio to apply.",
                            "",
                            "Set confirmed:true to apply.",
                        ].join("\n"),
                    }],
            };
        }
        const r = patchXdebug(siteData.id, false);
        const lines = [
            `Disable Xdebug on '${siteData.name}': ${r.ok ? "✅ Done" : "❌ " + r.message}`,
        ];
        if (r.ok) {
            lines.push("");
            lines.push("Restart the site in Studio UI (stop → start) to apply.");
            lines.push("Xdebug performance overhead is now removed.");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
    // ── studio_xdebug_status ──────────────────────────────────────────────────
    server.tool("studio_xdebug_status", "Show Xdebug status across all WordPress Studio sites — which site has it enabled, " +
        "port, path mapping, and connection details for IDE setup.", {}, async () => {
        const sites = readRawSites();
        if (sites.length === 0) {
            return { content: [{ type: "text", text: "Cannot read ~/.studio/cli.json or no sites found" }], isError: true };
        }
        const lines = ["Xdebug Status — WordPress Studio Sites", "─".repeat(50), ""];
        const active = sites.filter(s => s.enableXdebug);
        const inactive = sites.filter(s => !s.enableXdebug);
        if (active.length === 0) {
            lines.push("No sites have Xdebug enabled.");
            lines.push("");
            lines.push("Enable it with:");
            lines.push("  studio_xdebug_enable  site:<name>  confirmed:true");
        }
        else {
            for (const s of active) {
                const site = s;
                lines.push(`✅ ACTIVE: ${site.name}`);
                lines.push(`   Path:       ${site.path}`);
                lines.push(`   URL:        http://localhost:${site.port}`);
                lines.push(`   Xdebug:     port 9003`);
                lines.push(`   Path map:   /wordpress  →  ${site.path}`);
                lines.push("");
                lines.push("   VS Code launch.json pathMappings:");
                lines.push(`     "/wordpress": "${site.path.replace(/\\/g, "/")}"`);
                lines.push("");
                lines.push("   PhpStorm server:");
                lines.push(`     Host: localhost  Port: ${site.port}`);
                lines.push(`     File: ${site.path}`);
                lines.push(`     Absolute path on server: /wordpress`);
            }
        }
        if (inactive.length > 0) {
            lines.push("─".repeat(50));
            lines.push("Sites with Xdebug OFF:");
            for (const s of inactive) {
                lines.push(`  ○ ${s.name}  (localhost:${s.port})`);
            }
        }
        lines.push("");
        lines.push("─".repeat(50));
        lines.push("⚠️  Only one site can have Xdebug active at a time.");
        lines.push("    Xdebug slows PHP — disable when not debugging.");
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
    // ── studio_xdebug_ide_config ──────────────────────────────────────────────
    server.tool("studio_xdebug_ide_config", "Generate Xdebug IDE configuration for a Studio site. " +
        "For VS Code: generates .vscode/launch.json with correct port (9003) and " +
        "pathMappings (/wordpress → site path). Optionally writes the file to disk. " +
        "For PhpStorm: prints step-by-step server + debug settings. " +
        "Run studio_xdebug_enable first to activate Xdebug on the site.", {
        site: z.string().describe("Site name or absolute path"),
        ide: z.enum(["vscode", "phpstorm", "both"]).optional().default("vscode")
            .describe("IDE to generate config for"),
        write_file: z.boolean().optional().default(false)
            .describe("Write .vscode/launch.json to the site directory (VS Code only)"),
    }, async ({ site, ide, write_file }) => {
        const siteData = findSite(site);
        if (!siteData) {
            return { content: [{ type: "text", text: `Site '${site}' not found.` }], isError: true };
        }
        const xdebugActive = readRawSites().find(s => s.id === siteData.id)?.enableXdebug ?? false;
        const lines = [
            `Xdebug IDE Config — ${siteData.name}`,
            "─".repeat(50),
            `  Site path: ${siteData.path}`,
            `  URL:       http://localhost:${siteData.port}`,
            `  Xdebug:    ${xdebugActive ? "✅ ENABLED" : "⚠️  DISABLED — run studio_xdebug_enable first"}`,
            "",
        ];
        // ── VS Code ───────────────────────────────────────────────────────────
        if (ide === "vscode" || ide === "both") {
            lines.push("── VS Code ──────────────────────────────────────────────");
            lines.push("");
            lines.push("1. Install the PHP Debug extension:");
            lines.push("   https://marketplace.visualstudio.com/items?itemName=xdebug.php-debug");
            lines.push("");
            lines.push("2. .vscode/launch.json:");
            lines.push("");
            const launchJson = generateVsCodeLaunchJson(siteData.path, siteData.port);
            lines.push(launchJson);
            lines.push("");
            if (write_file) {
                const vscodeDir = path.join(siteData.path, ".vscode");
                const launchFile = path.join(vscodeDir, "launch.json");
                try {
                    fs.mkdirSync(vscodeDir, { recursive: true });
                    fs.writeFileSync(launchFile, launchJson, "utf-8");
                    lines.push(`✅ Written to: ${launchFile}`);
                }
                catch (err) {
                    lines.push(`⚠️  Could not write file: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            else {
                lines.push("ℹ️  Set write_file:true to save this to .vscode/launch.json automatically.");
            }
            lines.push("");
            lines.push("3. Open the site folder in VS Code:");
            lines.push(`   code "${siteData.path}"`);
            lines.push("");
            lines.push("4. Press F5 (or Run → Start Debugging)");
            lines.push("5. Set breakpoints in your plugin/theme PHP files");
            lines.push("6. Load the site in your browser to trigger breakpoints");
            lines.push("");
        }
        // ── PhpStorm ──────────────────────────────────────────────────────────
        if (ide === "phpstorm" || ide === "both") {
            lines.push("── PhpStorm ─────────────────────────────────────────────");
            lines.push("");
            lines.push("1. Settings → PHP → Debug");
            lines.push("   • Xdebug port: 9003");
            lines.push("   • Disable: 'Force break at first line when no path mapping specified'");
            lines.push("   • Disable: 'Force break at first line when a script is outside the project'");
            lines.push("");
            lines.push("2. Settings → PHP → Servers → Add (+)");
            lines.push(`   • Name:    WordPress Studio — ${siteData.name}`);
            lines.push(`   • Host:    localhost`);
            lines.push(`   • Port:    ${siteData.port}`);
            lines.push("   • Debugger: Xdebug");
            lines.push("   • ✅ Use path mappings");
            lines.push("");
            lines.push("   Path mappings:");
            lines.push(`   ┌─────────────────────────────────────────────────────┐`);
            lines.push(`   │ File / Directory          │ Absolute path on server  │`);
            lines.push(`   │ ${siteData.path.slice(0, 26).padEnd(26)} │ /wordpress               │`);
            lines.push(`   └─────────────────────────────────────────────────────┘`);
            lines.push("");
            lines.push("3. Toolbar → 'Start listening for PHP Debug Connections' (phone icon)");
            lines.push("4. Set breakpoints → load the site in browser");
            lines.push("");
        }
        if (!xdebugActive) {
            lines.push("─".repeat(50));
            lines.push("⚠️  Xdebug is not enabled on this site.");
            lines.push(`    Enable it first: studio_xdebug_enable  site:${siteData.name}  confirmed:true`);
            lines.push("    Then restart the site in Studio (stop → start).");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
}
//# sourceMappingURL=xdebug.js.map