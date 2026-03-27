/**
 * tools/filesystem.ts
 *
 * MCP tools for reading and writing files inside WordPress Studio sites.
 * All operations are sandboxed to STUDIO_SITES_ROOT.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { assertUnderSitesRoot, STUDIO_SITES_ROOT, findSite, } from "../studio-config.js";
export function registerFilesystemTools(server) {
    // ── fs_read_file ──────────────────────────────────────────────────────────
    server.tool("fs_read_file", "Read any file inside a WordPress Studio site. " +
        "Use site name for 'site', then a relative path like 'wp-content/themes/mytheme/style.css'.", {
        site: z.string().describe("Site name or absolute site path"),
        relative_path: z.string().describe("Path relative to the site root, e.g. 'wp-content/themes/mytheme/style.css'"),
    }, async ({ site, relative_path }) => {
        const siteData = findSite(site);
        const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
        const full = path.resolve(siteRoot, relative_path);
        assertUnderSitesRoot(full);
        if (!fs.existsSync(full)) {
            return { content: [{ type: "text", text: `File not found: ${full}` }], isError: true };
        }
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            return { content: [{ type: "text", text: `Path is a directory — use fs_list_dir instead.` }], isError: true };
        }
        if (stat.size > 2 * 1024 * 1024) {
            return {
                content: [{ type: "text", text: `File too large (${(stat.size / 1024).toFixed(1)} KB). Max 2 MB.` }],
                isError: true,
            };
        }
        const content = fs.readFileSync(full, "utf-8");
        return { content: [{ type: "text", text: content }] };
    });
    // ── fs_write_file ─────────────────────────────────────────────────────────
    server.tool("fs_write_file", "Write (create or overwrite) a file inside a WordPress Studio site. " +
        "Parent directories are created automatically.", {
        site: z.string().describe("Site name or absolute site path"),
        relative_path: z.string().describe("Path relative to site root"),
        content: z.string().describe("Full file content to write"),
        create_dirs: z.boolean().optional().default(true)
            .describe("Create parent directories if missing (default: true)"),
    }, async ({ site, relative_path, content, create_dirs }) => {
        const siteData = findSite(site);
        const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
        const full = path.resolve(siteRoot, relative_path);
        assertUnderSitesRoot(full);
        if (create_dirs)
            fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, "utf-8");
        return {
            content: [{ type: "text", text: `✓ Written ${content.length} bytes to ${full}` }],
        };
    });
    // ── fs_list_dir ───────────────────────────────────────────────────────────
    server.tool("fs_list_dir", "List files and subdirectories inside a WordPress Studio site directory.", {
        site: z.string().describe("Site name or absolute site path"),
        relative_path: z.string().optional().default("").describe("Path relative to site root (default: site root)"),
        recursive: z.boolean().optional().default(false)
            .describe("List recursively up to depth 4 (default: false)"),
    }, async ({ site, relative_path, recursive }) => {
        const siteData = findSite(site);
        const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
        const full = path.resolve(siteRoot, relative_path ?? "");
        assertUnderSitesRoot(full);
        if (!fs.existsSync(full)) {
            return { content: [{ type: "text", text: `Directory not found: ${full}` }], isError: true };
        }
        const entries = listDir(full, recursive ? 4 : 0, 0);
        return { content: [{ type: "text", text: entries.join("\n") }] };
    });
    // ── fs_find_files ─────────────────────────────────────────────────────────
    server.tool("fs_find_files", "Search for files matching a glob pattern inside a WordPress Studio site. " +
        "Examples: '**/*.php', 'wp-content/themes/**/*.css'.", {
        site: z.string().describe("Site name or absolute site path"),
        pattern: z.string().describe("Glob pattern, e.g. '**/*.php'"),
        max_results: z.number().optional().default(50).describe("Max results (default: 50)"),
    }, async ({ site, pattern, max_results }) => {
        const { glob } = await import("glob");
        const siteData = findSite(site);
        const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
        assertUnderSitesRoot(siteRoot);
        const matches = await glob(pattern, {
            cwd: siteRoot,
            nodir: true,
            ignore: ["node_modules/**", ".git/**"],
            absolute: false,
        });
        const results = matches.slice(0, max_results);
        const text = results.length > 0 ? results.join("\n") : "No files matched.";
        return { content: [{ type: "text", text }] };
    });
    // ── fs_read_wp_config ─────────────────────────────────────────────────────
    server.tool("fs_read_wp_config", "Read and parse wp-config.php from a Studio site. Passwords and secret keys are redacted.", {
        site: z.string().describe("Site name or absolute site path"),
    }, async ({ site }) => {
        const siteData = findSite(site);
        const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
        const wpConfig = path.join(siteRoot, "wp-config.php");
        assertUnderSitesRoot(wpConfig);
        if (!fs.existsSync(wpConfig)) {
            return { content: [{ type: "text", text: `wp-config.php not found at ${wpConfig}` }], isError: true };
        }
        let content = fs.readFileSync(wpConfig, "utf-8");
        content = content.replace(/(define\s*\(\s*'(?:DB_PASSWORD|AUTH_KEY|SECURE_AUTH_KEY|LOGGED_IN_KEY|NONCE_KEY|AUTH_SALT|SECURE_AUTH_SALT|LOGGED_IN_SALT|NONCE_SALT)'\s*,\s*')[^']*/g, "$1[REDACTED]");
        return { content: [{ type: "text", text: content }] };
    });
    // ── fs_read_error_log ─────────────────────────────────────────────────────
    server.tool("fs_read_error_log", "Read the WordPress debug.log for a Studio site (last N lines).", {
        site: z.string().describe("Site name or absolute site path"),
        lines: z.number().optional().default(100).describe("Lines from end of log (default: 100)"),
    }, async ({ site, lines }) => {
        const siteData = findSite(site);
        const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
        const logPath = path.join(siteRoot, "wp-content", "debug.log");
        assertUnderSitesRoot(logPath);
        if (!fs.existsSync(logPath)) {
            return { content: [{ type: "text", text: "No debug.log found. Is WP_DEBUG_LOG enabled?" }] };
        }
        const all = fs.readFileSync(logPath, "utf-8").split("\n");
        const tail = all.slice(-lines).join("\n");
        return { content: [{ type: "text", text: tail }] };
    });
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function listDir(dir, maxDepth, depth) {
    const indent = "  ".repeat(depth);
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory())
            return -1;
        if (!a.isDirectory() && b.isDirectory())
            return 1;
        return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
        const icon = entry.isDirectory() ? "📁" : "📄";
        results.push(`${indent}${icon} ${entry.name}`);
        if (entry.isDirectory() && depth < maxDepth) {
            results.push(...listDir(path.join(dir, entry.name), maxDepth, depth + 1));
        }
    }
    return results;
}
//# sourceMappingURL=filesystem.js.map