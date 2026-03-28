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
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { findSite, readCliConfig, STUDIO_HOME, CLI_CONFIG_PATH, } from "../studio-config.js";
// ─── Hosts file path ─────────────────────────────────────────────────────────
const HOSTS_FILE = process.platform === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts";
const HOSTS_BLOCK_BEGIN = "# BEGIN WordPress Studio";
const HOSTS_BLOCK_END = "# END WordPress Studio";
// ─── Helpers ─────────────────────────────────────────────────────────────────
function studioWp(sitePath, wpArgs) {
    const result = spawnSync("studio", ["wp", "--path", sitePath, ...wpArgs], { encoding: "utf-8", timeout: 5 * 60 * 1000, windowsHide: true });
    return {
        stdout: result.stdout?.trim() ?? "",
        stderr: result.stderr?.trim() ?? (result.error?.message ?? ""),
        ok: result.status === 0,
    };
}
function studioCli(args) {
    const result = spawnSync("studio", args, { encoding: "utf-8", timeout: 30_000, windowsHide: true });
    return {
        stdout: result.stdout?.trim() ?? "",
        stderr: result.stderr?.trim() ?? (result.error?.message ?? ""),
        ok: result.status === 0,
    };
}
/** Read the hosts file, return null if unreadable */
function readHostsFile() {
    try {
        return fs.readFileSync(HOSTS_FILE, "utf-8");
    }
    catch {
        return null;
    }
}
/** Check whether a domain is already in the hosts file */
function domainInHosts(domain) {
    const content = readHostsFile();
    if (!content)
        return false;
    return new RegExp(`^\\s*127\\.0\\.0\\.1\\s+${escapeRegex(domain)}`, "m").test(content);
}
/** Add domain to hosts file inside a Studio block */
function addDomainToHosts(domain, port) {
    let content = readHostsFile();
    if (content === null) {
        return { ok: false, message: `Cannot read hosts file at ${HOSTS_FILE}` };
    }
    // Already present — nothing to do
    if (domainInHosts(domain)) {
        return { ok: true, message: `${domain} already in hosts file` };
    }
    const entry = `127.0.0.1 ${domain} # Studio port ${port}`;
    if (content.includes(HOSTS_BLOCK_BEGIN)) {
        content = content.replace(HOSTS_BLOCK_END, `${entry}\n${HOSTS_BLOCK_END}`);
    }
    else {
        content += `\n\n${HOSTS_BLOCK_BEGIN}\n${entry}\n${HOSTS_BLOCK_END}\n`;
    }
    try {
        fs.writeFileSync(HOSTS_FILE, content, "utf-8");
        return { ok: true, message: `Added 127.0.0.1 ${domain} to ${HOSTS_FILE}` };
    }
    catch (err) {
        return {
            ok: false,
            message: `Failed to write hosts file (needs admin/elevated privileges).\n` +
                `Run this manually as Administrator:\n\n` +
                `  Add to ${HOSTS_FILE}:\n  127.0.0.1 ${domain}\n\n` +
                `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/** Remove a domain from the hosts file */
function removeDomainFromHosts(domain) {
    let content = readHostsFile();
    if (content === null)
        return { ok: false, message: `Cannot read ${HOSTS_FILE}` };
    const lineRe = new RegExp(`^.*127\\.0\\.0\\.1\\s+${escapeRegex(domain)}.*\\n?`, "m");
    if (!lineRe.test(content)) {
        return { ok: true, message: `${domain} not found in hosts file` };
    }
    const updated = content.replace(lineRe, "");
    try {
        fs.writeFileSync(HOSTS_FILE, updated, "utf-8");
        return { ok: true, message: `Removed ${domain} from ${HOSTS_FILE}` };
    }
    catch (err) {
        return {
            ok: false,
            message: `Failed to write hosts file (needs admin): ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/** Patch customDomain directly in ~/.studio/cli.json */
function patchCliConfig(siteId, domain) {
    try {
        const raw = fs.readFileSync(CLI_CONFIG_PATH, "utf-8");
        const cfg = JSON.parse(raw);
        const site = cfg.sites?.find((s) => s.id === siteId);
        if (!site)
            return false;
        if (domain === null) {
            delete site.customDomain;
        }
        else {
            site.customDomain = domain;
        }
        fs.writeFileSync(CLI_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
        return true;
    }
    catch {
        return false;
    }
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Run mkcert reliably on Windows.
 * On Windows the MCP server inherits a limited PATH so `mkcert` may not be
 * found directly — we shell out via `cmd /c mkcert ...` as a fallback.
 */
function runMkcert(args, timeoutMs = 30_000) {
    const opts = { encoding: "utf-8", timeout: timeoutMs, windowsHide: true };
    if (process.platform === "win32") {
        const direct = spawnSync("mkcert", args, opts);
        if (!direct.error)
            return { status: direct.status, stdout: String(direct.stdout ?? ""), stderr: String(direct.stderr ?? ""), error: direct.error };
        const via = spawnSync("cmd", ["/c", "mkcert", ...args], opts);
        return { status: via.status, stdout: String(via.stdout ?? ""), stderr: String(via.stderr ?? ""), error: via.error };
    }
    const r = spawnSync("mkcert", args, opts);
    return { status: r.status, stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? ""), error: r.error };
}
// ─── Tool registration ────────────────────────────────────────────────────────
export function registerDomainTools(server) {
    // ── studio_site_set_domain ────────────────────────────────────────────────
    server.tool("studio_site_set_domain", "Map a real domain name to a local WordPress Studio site so it opens as " +
        "http://testmysite.com instead of http://localhost:8883. " +
        "Performs all 4 steps: hosts file update, Studio CLI domain registration, " +
        "database URL search-replace, and wp-config.php WP_HOME/WP_SITEURL constants. " +
        "The site must exist in Studio. Hosts file write needs Administrator privileges on Windows — " +
        "if it fails the manual command is printed. Restart the site after running this tool.", {
        site: z.string().describe("Site name or absolute site path"),
        domain: z.string().describe("Domain to use, e.g. 'testmysite.com' or 'mysite.local'. Do NOT include http:// or a trailing slash."),
        https: z.boolean().optional().default(false)
            .describe("Use https:// (default: false — use http://)"),
        confirmed: z.boolean().describe("Must be true to apply changes. Set to false to preview only."),
    }, async ({ site, domain, https: useHttps, confirmed }) => {
        const siteData = findSite(site);
        if (!siteData) {
            return { content: [{ type: "text", text: `Site '${site}' not found in Studio registry.` }], isError: true };
        }
        const protocol = useHttps ? "https" : "http";
        const newUrl = `${protocol}://${domain}`;
        const sitePath = siteData.path;
        // Detect current URL — may be a previous custom domain, not localhost
        const cfgNow = readCliConfig();
        const siteCfgNow = cfgNow?.sites.find(s => s.id === siteData.id);
        const curDomainNow = siteCfgNow?.customDomain;
        const curHttpsNow = siteCfgNow?.enableHttps ?? false;
        const oldUrl = curDomainNow
            ? `${curHttpsNow ? "https" : "http"}://${curDomainNow}`
            : `http://localhost:${siteData.port}`;
        const plan = [
            `Domain mapping plan for: ${siteData.name}`,
            "─".repeat(50),
            `  Old URL:   ${oldUrl}`,
            `  New URL:   ${newUrl}`,
            `  Site path: ${sitePath}`,
            "",
            "Steps that will run:",
            `  1. hosts file  → add: 127.0.0.1 ${domain}`,
            `  2. Studio CLI  → studio site set --domain ${domain}`,
            `  3. WP-CLI      → search-replace '${oldUrl}' '${newUrl}'`,
            `  4. wp-config   → define WP_HOME and WP_SITEURL`,
            "",
            confirmed ? "Applying changes..." : "⚠️  DRY RUN — set confirmed: true to apply",
        ];
        if (!confirmed) {
            return { content: [{ type: "text", text: plan.join("\n") }] };
        }
        const results = [...plan, ""];
        let hasError = false;
        // ── Step 1: Hosts file ─────────────────────────────────────────────────
        results.push("── Step 1: Hosts file ──");
        const hostsResult = addDomainToHosts(domain, siteData.port);
        results.push(hostsResult.ok ? `  ✅ ${hostsResult.message}` : `  ⚠️  ${hostsResult.message}`);
        if (!hostsResult.ok)
            hasError = true;
        // ── Step 2: Studio CLI domain registration ────────────────────────────
        results.push("\n── Step 2: Studio CLI ──");
        const cliResult = studioCli(["site", "set", `--path=${sitePath}`, `--domain=${domain}`]);
        if (cliResult.ok) {
            results.push(`  ✅ studio site set --domain ${domain}`);
        }
        else {
            // Studio CLI failed — patch cli.json directly as fallback
            const patched = patchCliConfig(siteData.id, domain);
            if (patched) {
                results.push(`  ✅ Patched customDomain in ~/.studio/cli.json directly`);
            }
            else {
                results.push(`  ⚠️  Studio CLI and direct patch both failed: ${cliResult.stderr}`);
                hasError = true;
            }
        }
        // ── Step 3: WP-CLI search-replace in database ─────────────────────────
        results.push("\n── Step 3: Database URL search-replace ──");
        const srResult = studioWp(sitePath, [
            "search-replace", oldUrl, newUrl,
            "--all-tables",
            "--report-changed-only",
        ]);
        if (srResult.ok) {
            results.push(`  ✅ ${srResult.stdout || `Replaced '${oldUrl}' → '${newUrl}' in database`}`);
        }
        else {
            results.push(`  ⚠️  search-replace failed (site may not be running): ${srResult.stderr}`);
            results.push(`       Run manually: wp search-replace '${oldUrl}' '${newUrl}' --all-tables`);
            hasError = true;
        }
        // ── Step 4: wp-config.php constants ───────────────────────────────────
        results.push("\n── Step 4: wp-config.php constants ──");
        const wpConfigPath = path.join(sitePath, "wp-config.php");
        if (fs.existsSync(wpConfigPath)) {
            try {
                fs.copyFileSync(wpConfigPath, wpConfigPath + ".bak");
                let cfg = fs.readFileSync(wpConfigPath, "utf-8");
                const setConst = (name, val) => {
                    const re = new RegExp(`define\\s*\\(\\s*['"]${name}['"]\\s*,[^)]+\\)\\s*;`, "m");
                    const line = `define( '${name}', '${val}' );`;
                    cfg = re.test(cfg) ? cfg.replace(re, line) : cfg.replace("/* That's all, stop editing!", `${line}\n/* That's all, stop editing!`);
                };
                setConst("WP_HOME", newUrl);
                setConst("WP_SITEURL", newUrl);
                fs.writeFileSync(wpConfigPath, cfg, "utf-8");
                results.push(`  ✅ WP_HOME and WP_SITEURL set to '${newUrl}' in wp-config.php`);
            }
            catch (err) {
                results.push(`  ⚠️  wp-config.php update failed: ${err instanceof Error ? err.message : String(err)}`);
                hasError = true;
            }
        }
        else {
            results.push(`  ⚠️  wp-config.php not found at ${wpConfigPath}`);
            hasError = true;
        }
        // ── Summary ───────────────────────────────────────────────────────────
        results.push("\n" + "─".repeat(50));
        results.push(hasError
            ? "⚠️  Completed with warnings — see above. Manual steps may be needed."
            : "✅  All steps completed successfully.");
        results.push("");
        results.push("Next steps:");
        results.push(`  1. Restart the site in Studio (stop → start)`);
        results.push(`  2. Open ${newUrl} in your browser`);
        results.push(`  3. Log in at ${newUrl}/wp-admin`);
        if (hasError) {
            results.push("");
            results.push("If hosts file write failed, add this line manually as Administrator:");
            results.push(`  127.0.0.1 ${domain}`);
            results.push(`  File: ${HOSTS_FILE}`);
        }
        return { content: [{ type: "text", text: results.join("\n") }] };
    });
    // ── studio_site_remove_domain ─────────────────────────────────────────────
    server.tool("studio_site_remove_domain", "Remove a custom domain mapping from a Studio site and revert it back to " +
        "http://localhost:PORT. Removes the hosts file entry, clears the Studio CLI " +
        "domain config, and runs a search-replace to restore localhost URLs. " +
        "Restart the site after running.", {
        site: z.string().describe("Site name or absolute site path"),
        confirmed: z.boolean().describe("Must be true to apply changes."),
    }, async ({ site, confirmed }) => {
        const siteData = findSite(site);
        if (!siteData) {
            return { content: [{ type: "text", text: `Site '${site}' not found.` }], isError: true };
        }
        const cfg = readCliConfig();
        const siteConfig = cfg?.sites.find(s => s.id === siteData.id);
        const oldDomain = siteConfig?.customDomain ?? siteData.customDomain;
        if (!oldDomain) {
            return { content: [{ type: "text", text: `Site '${site}' has no custom domain set.` }] };
        }
        const protocol = siteConfig?.enableHttps ? "https" : "http";
        const oldUrl = `${protocol}://${oldDomain}`;
        const newUrl = `http://localhost:${siteData.port}`;
        const sitePath = siteData.path;
        if (!confirmed) {
            return {
                content: [{
                        type: "text",
                        text: [
                            `Remove domain plan for: ${siteData.name}`,
                            "─".repeat(50),
                            `  Remove domain: ${oldDomain}`,
                            `  Revert URL:    ${oldUrl} → ${newUrl}`,
                            "",
                            "Steps: remove hosts entry, clear Studio CLI domain, search-replace DB, clear wp-config constants.",
                            "Set confirmed: true to apply.",
                        ].join("\n"),
                    }],
            };
        }
        const results = [];
        // Step 1: Remove from hosts file
        const hostsResult = removeDomainFromHosts(oldDomain);
        results.push(`Hosts file: ${hostsResult.ok ? "✅" : "⚠️ "} ${hostsResult.message}`);
        // Step 2: Studio CLI remove domain
        const cliResult = studioCli(["site", "set", `--path=${sitePath}`, "--domain="]);
        if (cliResult.ok) {
            results.push(`Studio CLI: ✅ domain cleared`);
        }
        else {
            const patched = patchCliConfig(siteData.id, null);
            results.push(`Studio CLI: ${patched ? "✅ patched cli.json directly" : "⚠️  " + cliResult.stderr}`);
        }
        // Step 3: Search-replace DB
        const srResult = studioWp(sitePath, [
            "search-replace", oldUrl, newUrl, "--all-tables", "--report-changed-only",
        ]);
        results.push(`DB search-replace: ${srResult.ok ? "✅ " + (srResult.stdout || "done") : "⚠️  " + srResult.stderr}`);
        // Step 4: Remove wp-config constants
        const wpConfigPath = path.join(sitePath, "wp-config.php");
        if (fs.existsSync(wpConfigPath)) {
            try {
                let cfg2 = fs.readFileSync(wpConfigPath, "utf-8");
                cfg2 = cfg2.replace(/define\s*\(\s*'WP_HOME'\s*,[^)]+\)\s*;\n?/m, "");
                cfg2 = cfg2.replace(/define\s*\(\s*'WP_SITEURL'\s*,[^)]+\)\s*;\n?/m, "");
                fs.writeFileSync(wpConfigPath, cfg2, "utf-8");
                results.push(`wp-config.php: ✅ WP_HOME and WP_SITEURL removed`);
            }
            catch (err) {
                results.push(`wp-config.php: ⚠️  ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        results.push("");
        results.push(`✅ Domain '${oldDomain}' removed. Restart the site to access it at ${newUrl}`);
        return { content: [{ type: "text", text: results.join("\n") }] };
    });
    // ── studio_site_use_mkcert ────────────────────────────────────────────────
    server.tool("studio_site_use_mkcert", "Generate a browser-trusted HTTPS certificate for any domain name (including real TLDs like " +
        "i-help.us, mysite.com) using mkcert, bypassing Studio CA Name Constraints that prevent " +
        "real-TLD HTTPS. Writes cert/key directly to ~/.studio/certificates/domains/ so Studio's " +
        "built-in proxy uses them. Steps: check mkcert installed → mkcert -install → generate cert → " +
        "patch cli.json (enableHttps:true, customDomain) → add to hosts file → DB search-replace → " +
        "set wp-config WP_HOME/WP_SITEURL to https://domain. " +
        "Requires mkcert to be installed: https://github.com/FiloSottile/mkcert", {
        site: z.string().describe("Site name or absolute site path"),
        domain: z.string().describe("Domain to use with HTTPS, e.g. 'i-help.us'. Do NOT include https:// or trailing slash."),
        confirmed: z.boolean().describe("Must be true to apply changes. Set to false to preview only."),
    }, async ({ site, domain, confirmed }) => {
        const siteData = findSite(site);
        if (!siteData) {
            return { content: [{ type: "text", text: `Site '${site}' not found in Studio registry.` }], isError: true };
        }
        const newUrl = `https://${domain}`;
        const sitePath = siteData.path;
        const certDir = path.join(STUDIO_HOME, "certificates", "domains");
        const certFile = path.join(certDir, `${domain}.crt`);
        const keyFile = path.join(certDir, `${domain}.key`);
        // Detect the current URL stored in the DB — could be localhost or a previous custom domain
        const cfg2 = readCliConfig();
        const siteCfg = cfg2?.sites.find(s => s.id === siteData.id);
        const curDomain = siteCfg?.customDomain;
        const curHttps = siteCfg?.enableHttps ?? false;
        const oldUrl = curDomain
            ? `${curHttps ? "https" : "http"}://${curDomain}`
            : `http://localhost:${siteData.port}`;
        const plan = [
            `mkcert HTTPS plan for: ${siteData.name}`,
            "─".repeat(50),
            `  Domain:    ${domain}`,
            `  New URL:   ${newUrl}`,
            `  Old URL:   ${oldUrl}  (current DB URLs — will be replaced)`,
            `  Cert file: ${certFile}`,
            `  Key file:  ${keyFile}`,
            "",
            "Steps that will run:",
            "  1. Check mkcert is installed",
            "  2. mkcert -install  (trust mkcert CA in system/browser stores)",
            `  3. Generate cert: mkcert -cert-file ... -key-file ... ${domain}`,
            `  4. Patch cli.json: customDomain=${domain}, enableHttps=true`,
            `  5. Hosts file → add 127.0.0.1 ${domain}`,
            `  6. DB search-replace '${oldUrl}' → '${newUrl}'`,
            `  7. wp-config.php → WP_HOME and WP_SITEURL = '${newUrl}'`,
            "",
            confirmed ? "Applying..." : "⚠️  DRY RUN — set confirmed: true to apply",
        ];
        if (!confirmed) {
            return { content: [{ type: "text", text: plan.join("\n") }] };
        }
        const results = [...plan, ""];
        // ── Step 1: Check mkcert installed ────────────────────────────────────
        results.push("── Step 1: Check mkcert ──");
        const versionCheck = runMkcert(["-version"], 10_000);
        if (versionCheck.status !== 0 && versionCheck.error) {
            results.push("  ❌ mkcert not found on PATH.");
            results.push("     Install it first: https://github.com/FiloSottile/mkcert");
            results.push("     Windows (Chocolatey): choco install mkcert");
            results.push("     Windows (Winget):     winget install FiloSottile.mkcert");
            return { content: [{ type: "text", text: results.join("\n") }], isError: true };
        }
        const mkcertVersion = (versionCheck.stdout ?? "").trim() || (versionCheck.stderr ?? "").trim();
        results.push(`  ✅ mkcert found: ${mkcertVersion}`);
        // ── Step 2: mkcert -install ───────────────────────────────────────────
        results.push("\n── Step 2: mkcert -install ──");
        const installResult = runMkcert(["-install"]);
        if (installResult.status === 0) {
            results.push("  ✅ mkcert CA installed in system/browser trust stores");
        }
        else {
            const errMsg = (installResult.stderr ?? "").trim() || (installResult.stdout ?? "").trim();
            results.push(`  ⚠️  mkcert -install returned non-zero (may need elevation): ${errMsg}`);
            results.push("     If Chrome/Firefox still show ERR_CERT_AUTHORITY_INVALID, run:");
            results.push("     mkcert -install   (in an elevated/admin terminal)");
        }
        // ── Step 3: Generate certificate ─────────────────────────────────────
        results.push("\n── Step 3: Generate certificate ──");
        try {
            fs.mkdirSync(certDir, { recursive: true });
        }
        catch (err) {
            results.push(`  ⚠️  Could not create cert directory: ${err instanceof Error ? err.message : String(err)}`);
        }
        const certResult = runMkcert(["-cert-file", certFile, "-key-file", keyFile, domain]);
        if (certResult.status === 0 || fs.existsSync(certFile)) {
            results.push(`  ✅ Certificate generated:`);
            results.push(`     cert: ${certFile}`);
            results.push(`     key:  ${keyFile}`);
        }
        else {
            const errMsg = (certResult.stderr ?? "").trim() || (certResult.stdout ?? "").trim();
            results.push(`  ❌ mkcert cert generation failed: ${errMsg}`);
            return { content: [{ type: "text", text: results.join("\n") }], isError: true };
        }
        // ── Step 4: Patch cli.json ────────────────────────────────────────────
        results.push("\n── Step 4: Patch cli.json ──");
        try {
            const raw = fs.readFileSync(CLI_CONFIG_PATH, "utf-8");
            const cfg = JSON.parse(raw);
            const siteEntry = cfg.sites?.find((s) => s.id === siteData.id);
            if (siteEntry) {
                siteEntry.customDomain = domain;
                siteEntry.enableHttps = true;
                fs.writeFileSync(CLI_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
                results.push(`  ✅ cli.json: customDomain=${domain}, enableHttps=true`);
            }
            else {
                results.push("  ⚠️  Site not found in cli.json — patch skipped");
            }
        }
        catch (err) {
            results.push(`  ⚠️  cli.json patch failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        // ── Step 5: Hosts file ────────────────────────────────────────────────
        results.push("\n── Step 5: Hosts file ──");
        const hostsResult = addDomainToHosts(domain, siteData.port);
        results.push(hostsResult.ok ? `  ✅ ${hostsResult.message}` : `  ⚠️  ${hostsResult.message}`);
        // ── Step 6: DB search-replace ─────────────────────────────────────────
        results.push("\n── Step 6: Database URL search-replace ──");
        const srResult = studioWp(sitePath, [
            "search-replace", oldUrl, newUrl,
            "--all-tables", "--report-changed-only",
        ]);
        if (srResult.ok) {
            results.push(`  ✅ ${srResult.stdout || `Replaced '${oldUrl}' → '${newUrl}'`}`);
        }
        else {
            results.push(`  ⚠️  search-replace failed (is the site running?): ${srResult.stderr}`);
            results.push(`       Run manually: wp search-replace '${oldUrl}' '${newUrl}' --all-tables`);
        }
        // ── Step 7: wp-config.php constants ──────────────────────────────────
        results.push("\n── Step 7: wp-config.php constants ──");
        const wpConfigPath = path.join(sitePath, "wp-config.php");
        if (fs.existsSync(wpConfigPath)) {
            try {
                fs.copyFileSync(wpConfigPath, wpConfigPath + ".bak");
                let cfg2 = fs.readFileSync(wpConfigPath, "utf-8");
                const setConst = (name, val) => {
                    const re = new RegExp(`define\\s*\\(\\s*['"]${name}['"]\\s*,[^)]+\\)\\s*;`, "m");
                    const line = `define( '${name}', '${val}' );`;
                    cfg2 = re.test(cfg2) ? cfg2.replace(re, line) : cfg2.replace("/* That's all, stop editing!", `${line}\n/* That's all, stop editing!`);
                };
                setConst("WP_HOME", newUrl);
                setConst("WP_SITEURL", newUrl);
                fs.writeFileSync(wpConfigPath, cfg2, "utf-8");
                results.push(`  ✅ WP_HOME and WP_SITEURL set to '${newUrl}'`);
            }
            catch (err) {
                results.push(`  ⚠️  wp-config.php update failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        else {
            results.push(`  ⚠️  wp-config.php not found at ${wpConfigPath}`);
        }
        // ── Summary ───────────────────────────────────────────────────────────
        results.push("\n" + "─".repeat(50));
        results.push("✅  mkcert HTTPS setup complete.");
        results.push("");
        results.push("Next steps:");
        results.push(`  1. Restart the site in Studio (stop → start)`);
        results.push(`  2. Open ${newUrl} in Chrome/Firefox — should show a valid padlock`);
        results.push(`  3. Log in at ${newUrl}/wp-admin`);
        results.push("");
        results.push("Note: If the browser still shows ERR_CERT_AUTHORITY_INVALID:");
        results.push("  • Run 'mkcert -install' in an elevated (Admin) terminal and restart the browser.");
        return { content: [{ type: "text", text: results.join("\n") }] };
    });
    // ── studio_domain_list ────────────────────────────────────────────────────
    server.tool("studio_domain_list", "List all custom domain mappings across Studio sites, show the current hosts file " +
        "Studio block, and check whether each domain resolves correctly.", {}, async () => {
        const cfg = readCliConfig();
        const sites = cfg?.sites ?? [];
        const lines = ["Studio Custom Domain Mappings", "─".repeat(50)];
        const withDomain = sites.filter(s => s.customDomain);
        if (withDomain.length === 0) {
            lines.push("No custom domains configured.");
        }
        else {
            for (const s of withDomain) {
                const protocol = s.enableHttps ? "https" : "http";
                const url = `${protocol}://${s.customDomain}`;
                const inHosts = domainInHosts(s.customDomain);
                lines.push(`  ${s.name.padEnd(20)} ${url.padEnd(35)} hosts: ${inHosts ? "✅" : "⚠️  missing"}`);
            }
        }
        lines.push("\n── Hosts file Studio block ──");
        const hostsContent = readHostsFile();
        if (hostsContent) {
            const blockStart = hostsContent.indexOf(HOSTS_BLOCK_BEGIN);
            const blockEnd = hostsContent.indexOf(HOSTS_BLOCK_END);
            if (blockStart !== -1 && blockEnd !== -1) {
                lines.push(hostsContent.slice(blockStart, blockEnd + HOSTS_BLOCK_END.length));
            }
            else {
                lines.push("(No Studio block found in hosts file)");
            }
        }
        else {
            lines.push(`Cannot read ${HOSTS_FILE}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
}
//# sourceMappingURL=domain.js.map