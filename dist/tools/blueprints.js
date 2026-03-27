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
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { findSite, getSites, STUDIO_SITES_ROOT } from "../studio-config.js";
// ─── WP-CLI helper (reused pattern from wpcli.ts) ────────────────────────────
function studioWp(sitePath, wpArgs) {
    const result = spawnSync("studio", ["wp", "--path", sitePath, ...wpArgs], { encoding: "utf-8", timeout: 5 * 60 * 1000, windowsHide: true });
    return {
        stdout: result.stdout?.trim() ?? "",
        stderr: result.stderr?.trim() ?? (result.error?.message ?? ""),
        ok: result.status === 0,
    };
}
// ─── Resolve plugin/theme slug from various data formats ─────────────────────
function resolvePluginSource(data) {
    if (typeof data === "string")
        return data;
    if (data.resource === "wordpress.org/plugins")
        return data.slug;
    if (data.resource === "url")
        return data.url;
    return null; // file resource — skip
}
function resolveThemeSource(data) {
    if (typeof data === "string")
        return data;
    if (data.resource === "wordpress.org/themes")
        return data.slug;
    if (data.resource === "url")
        return data.url;
    return null;
}
// ─── Built-in featured blueprints ────────────────────────────────────────────
const FEATURED_BLUEPRINTS = {
    "quick-start": {
        $schema: "https://playground.wordpress.net/blueprint-schema.json",
        preferredVersions: { php: "8.3", wp: "latest" },
        steps: [
            { step: "setSiteOptions", options: { blogname: "My WordPress Site", permalink_structure: "/%postname%/" } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "jetpack" }, options: { activate: true } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "akismet" }, options: { activate: false } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "woocommerce" }, options: { activate: false } },
            { step: "installTheme", themeData: { resource: "wordpress.org/themes", slug: "twentytwentyfour" }, options: { activate: true } },
        ],
    },
    "development": {
        $schema: "https://playground.wordpress.net/blueprint-schema.json",
        preferredVersions: { php: "8.3", wp: "latest" },
        steps: [
            { step: "setSiteOptions", options: { blogname: "Development Site", permalink_structure: "/%postname%/" } },
            { step: "defineWpConfigConsts", consts: { WP_DEBUG: true, WP_DEBUG_LOG: true, WP_DEBUG_DISPLAY: false, SAVEQUERIES: true } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "query-monitor" }, options: { activate: true } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "plugin-check" }, options: { activate: true } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "theme-check" }, options: { activate: true } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "create-block-theme" }, options: { activate: true } },
        ],
    },
    "commerce": {
        $schema: "https://playground.wordpress.net/blueprint-schema.json",
        preferredVersions: { php: "8.3", wp: "latest" },
        steps: [
            { step: "setSiteOptions", options: { blogname: "My Store", permalink_structure: "/shop/%postname%/" } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "woocommerce" }, options: { activate: true } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "woocommerce-payments" }, options: { activate: false } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "woocommerce-services" }, options: { activate: false } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "mailchimp-for-woocommerce" }, options: { activate: false } },
            { step: "installPlugin", pluginData: { resource: "wordpress.org/plugins", slug: "google-listings-and-ads" }, options: { activate: false } },
            { step: "installTheme", themeData: { resource: "wordpress.org/themes", slug: "storefront" }, options: { activate: true } },
        ],
    },
};
// ─── Tool registration ────────────────────────────────────────────────────────
export function registerBlueprintTools(server) {
    // ── studio_blueprint_list ─────────────────────────────────────────────────
    server.tool("studio_blueprint_list", "List the three built-in Studio featured blueprints (Quick Start, Development, Commerce) " +
        "with their full step definitions. Use as starting points for custom blueprints.", {
        name: z.enum(["quick-start", "development", "commerce", "all"]).default("all").describe("Which blueprint to show, or 'all' for all three"),
    }, async ({ name }) => {
        const output = name === "all"
            ? FEATURED_BLUEPRINTS
            : { [name]: FEATURED_BLUEPRINTS[name] };
        const lines = [
            "Studio Featured Blueprints",
            "─────────────────────────",
            "",
            "These mirror what Studio Desktop offers under Add site → Start from a blueprint.",
            "Studio ignores: landingPage, login, extraLibraries, enableMultisite.",
            "",
            JSON.stringify(output, null, 2),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
    // ── studio_blueprint_generate ─────────────────────────────────────────────
    server.tool("studio_blueprint_generate", "Snapshot an existing Studio site into a reusable Blueprint JSON. " +
        "Captures active plugins (with versions), active theme, site options (title, description, " +
        "permalink structure), PHP and WordPress versions, and wp-config constants (WP_DEBUG etc.). " +
        "Output can be saved to a .json file and applied to any Studio site.", {
        site: z.string().describe("Site name or absolute site path"),
        include_inactive_plugins: z.boolean().optional().default(false).describe("Also include inactive plugins in the blueprint"),
    }, async ({ site, include_inactive_plugins }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found. Use studio_registry to list available sites.` }],
                isError: true,
            };
        }
        const sp = siteData.path;
        const results = [];
        // ── plugins ─────────────────────────────────────────────────────────────
        const statusFilter = include_inactive_plugins ? "active,inactive" : "active";
        const pluginResult = studioWp(sp, [
            "plugin", "list",
            `--status=${statusFilter}`,
            "--format=json",
            "--fields=name,status,version",
        ]);
        let pluginSteps = [];
        if (pluginResult.ok && pluginResult.stdout) {
            try {
                const plugins = JSON.parse(pluginResult.stdout);
                pluginSteps = plugins.map(p => ({
                    step: "installPlugin",
                    pluginData: { resource: "wordpress.org/plugins", slug: p.name },
                    options: { activate: p.status === "active" },
                }));
            }
            catch {
                results.push("Warning: could not parse plugin list");
            }
        }
        else {
            results.push(`Warning: plugin list failed — ${pluginResult.stderr || "site may not be running"}`);
        }
        // ── active theme ─────────────────────────────────────────────────────────
        const themeResult = studioWp(sp, [
            "theme", "list", "--status=active", "--format=json", "--fields=name,status",
        ]);
        let themeSteps = [];
        if (themeResult.ok && themeResult.stdout) {
            try {
                const themes = JSON.parse(themeResult.stdout);
                themeSteps = themes.map(t => ({
                    step: "installTheme",
                    themeData: { resource: "wordpress.org/themes", slug: t.name },
                    options: { activate: true },
                }));
            }
            catch {
                results.push("Warning: could not parse theme list");
            }
        }
        // ── site options ─────────────────────────────────────────────────────────
        const optionKeys = ["blogname", "blogdescription", "permalink_structure", "WPLANG"];
        const siteOptions = {};
        for (const key of optionKeys) {
            const r = studioWp(sp, ["option", "get", key]);
            if (r.ok && r.stdout)
                siteOptions[key] = r.stdout;
        }
        // ── wp-config constants ───────────────────────────────────────────────────
        const debugConsts = {};
        const wpConfigPath = path.join(sp, "wp-config.php");
        if (fs.existsSync(wpConfigPath)) {
            const wpConfig = fs.readFileSync(wpConfigPath, "utf-8");
            const constPattern = /define\s*\(\s*['"](\w+)['"]\s*,\s*(true|false|'[^']*'|"[^"]*"|\d+)\s*\)/g;
            let m;
            const debugKeys = new Set(["WP_DEBUG", "WP_DEBUG_LOG", "WP_DEBUG_DISPLAY", "SAVEQUERIES", "SCRIPT_DEBUG"]);
            while ((m = constPattern.exec(wpConfig)) !== null) {
                if (debugKeys.has(m[1])) {
                    const val = m[2];
                    debugConsts[m[1]] = val === "true" ? true : val === "false" ? false : val.replace(/^['"]|['"]$/g, "");
                }
            }
        }
        // ── WP / PHP versions ─────────────────────────────────────────────────────
        const wpVerResult = studioWp(sp, ["core", "version"]);
        const wpVersion = wpVerResult.ok ? wpVerResult.stdout : "latest";
        const phpVersion = siteData.phpVersion ?? "8.3";
        // ── assemble blueprint ────────────────────────────────────────────────────
        const blueprint = {
            $schema: "https://playground.wordpress.net/blueprint-schema.json",
            preferredVersions: {
                php: phpVersion,
                wp: wpVersion || "latest",
            },
            steps: [
                ...(Object.keys(siteOptions).length > 0
                    ? [{ step: "setSiteOptions", options: siteOptions }]
                    : []),
                ...(Object.keys(debugConsts).length > 0
                    ? [{ step: "defineWpConfigConsts", consts: debugConsts }]
                    : []),
                ...themeSteps,
                ...pluginSteps,
            ],
        };
        const text = [
            `Blueprint generated from site: ${siteData.name}`,
            `Path: ${sp}`,
            results.length > 0 ? "\nWarnings:\n" + results.join("\n") : "",
            "",
            "─── blueprint.json ───────────────────────────────────────────────────",
            JSON.stringify(blueprint, null, 2),
        ].filter(Boolean).join("\n");
        return { content: [{ type: "text", text }] };
    });
    // ── studio_blueprint_apply ────────────────────────────────────────────────
    server.tool("studio_blueprint_apply", "Apply a Blueprint JSON to an existing Studio site. " +
        "Executes each step sequentially: installs and activates plugins/themes, " +
        "sets site options, defines wp-config constants, runs SQL, runs PHP/WP-CLI commands, " +
        "and writes files. " +
        "Steps ignored by Studio (landingPage, login, enableMultisite, importWordPressFiles) are skipped. " +
        "Requires confirmed: true — this modifies the target site.", {
        site: z.string().describe("Site name or absolute site path"),
        blueprint: z.union([z.string(), z.record(z.unknown())]).describe("Blueprint JSON — either a JSON string or a parsed object"),
        confirmed: z.boolean().describe("Must be true — this operation installs plugins/themes and modifies the site"),
    }, async ({ site, blueprint, confirmed }) => {
        if (!confirmed) {
            return {
                content: [{ type: "text", text: "Set confirmed: true to proceed. This will modify the target site." }],
                isError: true,
            };
        }
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found. Use studio_registry to list available sites.` }],
                isError: true,
            };
        }
        // Parse blueprint if given as string
        let bp;
        try {
            bp = typeof blueprint === "string"
                ? JSON.parse(blueprint)
                : blueprint;
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `Invalid blueprint JSON: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
        const steps = bp.steps ?? [];
        const sp = siteData.path;
        const log = [
            `Applying blueprint to site: ${siteData.name}`,
            `Steps to execute: ${steps.length}`,
            "",
        ];
        // ── SKIPPED STEPS (Studio ignores these) ──────────────────────────────────
        const SKIP = new Set([
            "login", "landingPage", "enableMultisite",
            "importWordPressFiles", "extraLibraries",
        ]);
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const prefix = `[${i + 1}/${steps.length}] ${step.step}`;
            if (SKIP.has(step.step)) {
                log.push(`${prefix} — skipped (not supported in Studio)`);
                continue;
            }
            try {
                switch (step.step) {
                    // ── installPlugin ──────────────────────────────────────────────────
                    case "installPlugin": {
                        const source = resolvePluginSource(step.pluginData);
                        if (!source) {
                            log.push(`${prefix} — skipped (file resource not supported)`);
                            break;
                        }
                        const opts = step.options;
                        const args = ["plugin", "install", source];
                        if (opts?.activate)
                            args.push("--activate");
                        const r = studioWp(sp, args);
                        log.push(`${prefix} "${source}" — ${r.ok ? "OK" : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── activatePlugin ─────────────────────────────────────────────────
                    case "activatePlugin": {
                        const slug = (step.pluginName ?? step.pluginPath);
                        if (!slug) {
                            log.push(`${prefix} — skipped (no pluginName/pluginPath)`);
                            break;
                        }
                        const r = studioWp(sp, ["plugin", "activate", slug]);
                        log.push(`${prefix} "${slug}" — ${r.ok ? "OK" : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── installTheme ───────────────────────────────────────────────────
                    case "installTheme": {
                        const source = resolveThemeSource(step.themeData);
                        if (!source) {
                            log.push(`${prefix} — skipped (file resource not supported)`);
                            break;
                        }
                        const opts = step.options;
                        const args = ["theme", "install", source];
                        if (opts?.activate)
                            args.push("--activate");
                        const r = studioWp(sp, args);
                        log.push(`${prefix} "${source}" — ${r.ok ? "OK" : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── activateTheme ──────────────────────────────────────────────────
                    case "activateTheme": {
                        const slug = step.themeFolderName;
                        if (!slug) {
                            log.push(`${prefix} — skipped (no themeFolderName)`);
                            break;
                        }
                        const r = studioWp(sp, ["theme", "activate", slug]);
                        log.push(`${prefix} "${slug}" — ${r.ok ? "OK" : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── setSiteOptions ─────────────────────────────────────────────────
                    case "setSiteOptions": {
                        const opts = step.options;
                        if (!opts) {
                            log.push(`${prefix} — skipped (no options)`);
                            break;
                        }
                        const entries = Object.entries(opts);
                        let okCount = 0;
                        for (const [key, value] of entries) {
                            const r = studioWp(sp, ["option", "update", key, String(value)]);
                            if (r.ok)
                                okCount++;
                            else
                                log.push(`  ${key} — FAILED: ${r.stderr}`);
                        }
                        log.push(`${prefix} — ${okCount}/${entries.length} options updated`);
                        break;
                    }
                    // ── defineWpConfigConsts ───────────────────────────────────────────
                    case "defineWpConfigConsts": {
                        const consts = step.consts;
                        if (!consts) {
                            log.push(`${prefix} — skipped (no consts)`);
                            break;
                        }
                        const wpConfigPath = path.join(sp, "wp-config.php");
                        if (!fs.existsSync(wpConfigPath)) {
                            log.push(`${prefix} — FAILED: wp-config.php not found`);
                            break;
                        }
                        let wpConfig = fs.readFileSync(wpConfigPath, "utf-8");
                        let updated = 0;
                        for (const [name, value] of Object.entries(consts)) {
                            const phpVal = typeof value === "boolean"
                                ? (value ? "true" : "false")
                                : typeof value === "number"
                                    ? String(value)
                                    : `'${String(value).replace(/'/g, "\\'")}'`;
                            const define = `define( '${name}', ${phpVal} );`;
                            const existing = new RegExp(`define\\s*\\(\\s*['"]${name}['"]\\s*,\\s*[^)]+\\)\\s*;`);
                            if (existing.test(wpConfig)) {
                                wpConfig = wpConfig.replace(existing, define);
                            }
                            else {
                                // Insert before "That's all, stop editing!" comment or at end
                                const marker = "/* That's all, stop editing!";
                                wpConfig = wpConfig.includes(marker)
                                    ? wpConfig.replace(marker, `${define}\n${marker}`)
                                    : wpConfig + `\n${define}`;
                            }
                            updated++;
                        }
                        fs.writeFileSync(wpConfigPath, wpConfig, "utf-8");
                        log.push(`${prefix} — ${updated} constants written to wp-config.php`);
                        break;
                    }
                    // ── setSiteLanguage ────────────────────────────────────────────────
                    case "setSiteLanguage": {
                        const lang = step.language;
                        if (!lang || lang === "en_US") {
                            log.push(`${prefix} "${lang ?? "en_US"}" — skipped (default)`);
                            break;
                        }
                        const r = studioWp(sp, ["language", "core", "install", lang, "--activate"]);
                        log.push(`${prefix} "${lang}" — ${r.ok ? "OK" : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── updateUserMeta ─────────────────────────────────────────────────
                    case "updateUserMeta": {
                        const userId = step.userId;
                        const meta = step.meta;
                        if (!userId || !meta) {
                            log.push(`${prefix} — skipped (missing userId or meta)`);
                            break;
                        }
                        for (const [key, value] of Object.entries(meta)) {
                            studioWp(sp, ["user", "meta", "update", String(userId), key, String(value)]);
                        }
                        log.push(`${prefix} userId=${userId} — ${Object.keys(meta).length} meta keys updated`);
                        break;
                    }
                    // ── runSql ─────────────────────────────────────────────────────────
                    case "runSql": {
                        const sql = step.sql;
                        if (!sql) {
                            log.push(`${prefix} — skipped (no sql)`);
                            break;
                        }
                        const dbPath = path.join(sp, "wp-content", "database", ".ht.sqlite");
                        if (!fs.existsSync(dbPath)) {
                            log.push(`${prefix} — FAILED: SQLite DB not found (start the site first)`);
                            break;
                        }
                        try {
                            const db = new DatabaseSync(dbPath, { open: true });
                            db.exec(sql);
                            db.close();
                            log.push(`${prefix} — OK`);
                        }
                        catch (err) {
                            log.push(`${prefix} — FAILED: ${err instanceof Error ? err.message : String(err)}`);
                        }
                        break;
                    }
                    // ── runPHP ─────────────────────────────────────────────────────────
                    case "runPHP": {
                        const code = step.code;
                        if (!code) {
                            log.push(`${prefix} — skipped (no code)`);
                            break;
                        }
                        const r = studioWp(sp, ["eval", code]);
                        log.push(`${prefix} — ${r.ok ? "OK" : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── wp-cli ─────────────────────────────────────────────────────────
                    case "wp-cli": {
                        const command = step.command;
                        if (!command) {
                            log.push(`${prefix} — skipped (no command)`);
                            break;
                        }
                        // Strip leading "wp " prefix if present
                        const args = command.replace(/^wp\s+/, "").split(/\s+/);
                        const r = studioWp(sp, args);
                        log.push(`${prefix} "${command}" — ${r.ok ? (r.stdout || "OK") : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── writeFile ──────────────────────────────────────────────────────
                    case "writeFile": {
                        const filePath = step.path;
                        const data = step.data;
                        if (!filePath || data === undefined) {
                            log.push(`${prefix} — skipped (missing path or data)`);
                            break;
                        }
                        // Resolve relative paths inside the site root
                        const absPath = filePath.startsWith("/")
                            ? path.join(sp, filePath)
                            : path.join(sp, filePath);
                        // Safety: must be inside site root
                        if (!absPath.startsWith(sp)) {
                            log.push(`${prefix} — DENIED: path outside site root`);
                            break;
                        }
                        fs.mkdirSync(path.dirname(absPath), { recursive: true });
                        fs.writeFileSync(absPath, data, "utf-8");
                        log.push(`${prefix} "${filePath}" — OK`);
                        break;
                    }
                    // ── mkdir ──────────────────────────────────────────────────────────
                    case "mkdir": {
                        const dirPath = step.path;
                        if (!dirPath) {
                            log.push(`${prefix} — skipped (no path)`);
                            break;
                        }
                        const absPath = path.join(sp, dirPath);
                        if (!absPath.startsWith(sp)) {
                            log.push(`${prefix} — DENIED: path outside site root`);
                            break;
                        }
                        fs.mkdirSync(absPath, { recursive: true });
                        log.push(`${prefix} "${dirPath}" — OK`);
                        break;
                    }
                    // ── cp / mv ────────────────────────────────────────────────────────
                    case "cp":
                    case "mv": {
                        const from = step.fromPath;
                        const to = step.toPath;
                        if (!from || !to) {
                            log.push(`${prefix} — skipped (missing fromPath/toPath)`);
                            break;
                        }
                        const absFrom = path.join(sp, from);
                        const absTo = path.join(sp, to);
                        if (!absFrom.startsWith(sp) || !absTo.startsWith(sp)) {
                            log.push(`${prefix} — DENIED: path outside site root`);
                            break;
                        }
                        fs.mkdirSync(path.dirname(absTo), { recursive: true });
                        fs.copyFileSync(absFrom, absTo);
                        if (step.step === "mv")
                            fs.unlinkSync(absFrom);
                        log.push(`${prefix} "${from}" → "${to}" — OK`);
                        break;
                    }
                    // ── importThemeStarterContent ──────────────────────────────────────
                    case "importThemeStarterContent": {
                        const slug = step.themeSlug;
                        if (!slug) {
                            log.push(`${prefix} — skipped (no themeSlug)`);
                            break;
                        }
                        const r = studioWp(sp, ["theme", "activate", slug]);
                        log.push(`${prefix} "${slug}" — ${r.ok ? "OK (activated theme)" : "FAILED: " + r.stderr}`);
                        break;
                    }
                    // ── resetData ─────────────────────────────────────────────────────
                    case "resetData": {
                        const r1 = studioWp(sp, ["post", "delete", "--all", "--force"]);
                        const r2 = studioWp(sp, ["comment", "delete", "--all", "--force"]);
                        log.push(`${prefix} — posts: ${r1.ok ? "OK" : r1.stderr} | comments: ${r2.ok ? "OK" : r2.stderr}`);
                        break;
                    }
                    // ── importWxr / unzip / runPHPWithOptions / writeFiles ─────────────
                    case "importWxr":
                    case "unzip":
                    case "runPHPWithOptions":
                    case "writeFiles":
                        log.push(`${prefix} — skipped (requires file upload, not supported via MCP)`);
                        break;
                    // ── unknown ───────────────────────────────────────────────────────
                    default:
                        log.push(`${prefix} — skipped (unknown step)`);
                }
            }
            catch (err) {
                log.push(`${prefix} — ERROR: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        log.push("");
        log.push("Blueprint application complete.");
        return { content: [{ type: "text", text: log.join("\n") }] };
    });
}
//# sourceMappingURL=blueprints.js.map