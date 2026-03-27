/**
 * tools/rest-api.ts
 *
 * MCP tools for the WordPress REST API — both remote (WordPress.com) and local (Studio sites).
 *
 * ─── Three API namespaces ─────────────────────────────────────────────────────
 *
 *  /rest/v1.1/     Original WordPress.com REST API
 *                  https://developer.wordpress.com/docs/api/rest-api-reference/
 *
 *  /wp/v2/         WordPress core REST API (same as self-hosted, different base URL on .com)
 *                  https://developer.wordpress.org/rest-api/
 *
 *  /wpcom/v2/      WordPress.com extensions / MCP endpoints
 *                  https://developer.wordpress.com/docs/api/namespaces-versions/
 *
 * ─── Authentication ───────────────────────────────────────────────────────────
 *
 *  WordPress.com   OAuth2 Bearer token read from ~/.studio/shared.json
 *                  (the same token Studio uses — no separate login needed)
 *
 *  Local Studio    WP Application Password passed as Basic auth header, OR
 *                  unauthenticated for public GET endpoints
 */
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import { URL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { readSharedConfig, findSite, getSites, STUDIO_SITES_ROOT } from "../studio-config.js";
import path from "node:path";
function httpRequest(urlStr, method, headers, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const isHttps = url.protocol === "https:";
        const lib = isHttps ? https : http;
        const reqHeaders = {
            "User-Agent": "wordpress-studio-mcp/1.0.0",
            "Accept": "application/json",
            ...headers,
        };
        if (body)
            reqHeaders["Content-Length"] = Buffer.byteLength(body).toString();
        const req = lib.request({
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method,
            headers: reqHeaders,
            timeout: 15000,
        }, res => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => resolve({
                status: res.statusCode ?? 0,
                headers: res.headers,
                body: Buffer.concat(chunks).toString("utf-8"),
            }));
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
        if (body)
            req.write(body);
        req.end();
    });
}
/** Pretty-print JSON, truncating very large responses */
function formatJson(raw, maxLen = 8000) {
    try {
        const parsed = JSON.parse(raw);
        const pretty = JSON.stringify(parsed, null, 2);
        if (pretty.length > maxLen) {
            return pretty.slice(0, maxLen) + `\n\n... [truncated — ${pretty.length} chars total]`;
        }
        return pretty;
    }
    catch {
        return raw.slice(0, maxLen);
    }
}
/** Read the OAuth2 access token stored by Studio in shared.json */
function getWpcomToken() {
    return readSharedConfig()?.authToken?.access_token ?? null;
}
/** Base URL for the WordPress.com REST API */
const WPCOM_REST_BASE = "https://public-api.wordpress.com";
// ─── Tool registration ────────────────────────────────────────────────────────
export function registerRestApiTools(server) {
    // ══════════════════════════════════════════════════════════════════════════════
    // WORDPRESS.COM REMOTE REST API
    // ══════════════════════════════════════════════════════════════════════════════
    // ── wpcom_api_get ─────────────────────────────────────────────────────────
    server.tool("wpcom_api_get", "Make an authenticated GET request to the WordPress.com REST API. " +
        "Supports all three namespaces: /rest/v1.1/, /wp/v2/, /wpcom/v2/. " +
        "Uses the OAuth2 token stored by Studio in ~/.studio/shared.json. " +
        "Example endpoint: /rest/v1.1/sites/mysite.wordpress.com/posts", {
        endpoint: z.string().describe("API path starting with /rest/, /wp/, or /wpcom/. " +
            "E.g. /rest/v1.1/sites/mysite.com/posts?number=5"),
        params: z.record(z.string()).optional().describe("Optional query-string parameters as key-value pairs"),
    }, async ({ endpoint, params }) => {
        const token = getWpcomToken();
        if (!token) {
            return {
                content: [{ type: "text", text: "Not authenticated to WordPress.com.\n" +
                            "Run: studio auth login\n" +
                            "Or open Studio Desktop and sign in to WordPress.com." }],
                isError: true,
            };
        }
        const url = new URL(WPCOM_REST_BASE + endpoint);
        if (params)
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        const res = await httpRequest(url.toString(), "GET", {
            "Authorization": `Bearer ${token}`,
        });
        const text = `${res.status} ${url.toString()}\n\n${formatJson(res.body)}`;
        return { content: [{ type: "text", text }], isError: res.status >= 400 };
    });
    // ── wpcom_api_post ────────────────────────────────────────────────────────
    server.tool("wpcom_api_post", "Make an authenticated POST/PUT/PATCH/DELETE request to the WordPress.com REST API. " +
        "Requires explicit confirmation — destructive changes go live immediately.", {
        endpoint: z.string().describe("API path, e.g. /rest/v1.1/sites/mysite.com/posts/new"),
        method: z.enum(["POST", "PUT", "PATCH", "DELETE"]).default("POST"),
        body: z.record(z.unknown()).optional().describe("Request body as JSON object"),
        confirmed: z.boolean().describe("Must be true — confirms you understand this operation modifies live data"),
    }, async ({ endpoint, method, body, confirmed }) => {
        if (!confirmed) {
            return {
                content: [{ type: "text", text: "Set confirmed: true to proceed. This operation modifies live WordPress.com data." }],
                isError: true,
            };
        }
        const token = getWpcomToken();
        if (!token) {
            return {
                content: [{ type: "text", text: "Not authenticated — run: studio auth login" }],
                isError: true,
            };
        }
        const url = WPCOM_REST_BASE + endpoint;
        const bodyStr = body ? JSON.stringify(body) : undefined;
        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        };
        const res = await httpRequest(url, method, headers, bodyStr);
        const text = `${method} ${url}\nStatus: ${res.status}\n\n${formatJson(res.body)}`;
        return { content: [{ type: "text", text }], isError: res.status >= 400 };
    });
    // ── wpcom_site_info ───────────────────────────────────────────────────────
    server.tool("wpcom_site_info", "Get metadata for a WordPress.com site: name, description, URL, plan, capabilities, timezone.", {
        site: z.string().describe("WordPress.com site ID or domain, e.g. mysite.wordpress.com"),
    }, async ({ site }) => {
        const token = getWpcomToken();
        const headers = token
            ? { "Authorization": `Bearer ${token}` }
            : {};
        const res = await httpRequest(`${WPCOM_REST_BASE}/rest/v1.1/sites/${encodeURIComponent(site)}`, "GET", headers);
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ── wpcom_posts ───────────────────────────────────────────────────────────
    server.tool("wpcom_posts", "List posts from a WordPress.com site. Filter by status, author, category, tag, or search query.", {
        site: z.string().describe("WordPress.com site ID or domain"),
        status: z.enum(["publish", "draft", "pending", "private", "any"]).optional().default("publish"),
        number: z.number().min(1).max(100).optional().default(10).describe("Posts to return (max 100)"),
        offset: z.number().optional().default(0).describe("Pagination offset"),
        search: z.string().optional().describe("Full-text search query"),
        author: z.string().optional().describe("Filter by author login"),
        category: z.string().optional().describe("Filter by category slug"),
        tag: z.string().optional().describe("Filter by tag slug"),
        order: z.enum(["ASC", "DESC"]).optional().default("DESC"),
        order_by: z.enum(["date", "title", "modified", "ID", "comment_count"]).optional().default("date"),
        post_type: z.string().optional().default("post"),
        fields: z.string().optional().describe("Comma-separated fields to return, e.g. 'ID,title,URL,date,status'"),
    }, async ({ site, status, number, offset, search, author, category, tag, order, order_by, post_type, fields }) => {
        const token = getWpcomToken();
        const headers = token
            ? { "Authorization": `Bearer ${token}` }
            : {};
        const url = new URL(`${WPCOM_REST_BASE}/rest/v1.1/sites/${encodeURIComponent(site)}/posts`);
        url.searchParams.set("status", status ?? "publish");
        url.searchParams.set("number", String(number));
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("order", order ?? "DESC");
        url.searchParams.set("order_by", order_by ?? "date");
        url.searchParams.set("type", post_type ?? "post");
        if (search)
            url.searchParams.set("search", search);
        if (author)
            url.searchParams.set("author", author);
        if (category)
            url.searchParams.set("category", category);
        if (tag)
            url.searchParams.set("tag", tag);
        if (fields)
            url.searchParams.set("fields", fields);
        const res = await httpRequest(url.toString(), "GET", headers);
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ── wpcom_stats ───────────────────────────────────────────────────────────
    server.tool("wpcom_stats", "Get traffic statistics for a WordPress.com site: views, visitors, top posts, referrers, countries.", {
        site: z.string().describe("WordPress.com site ID or domain"),
        period: z.enum(["day", "week", "month", "year"]).optional().default("day"),
        date: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
        num: z.number().optional().default(30).describe("Number of periods to include"),
    }, async ({ site, period, date, num }) => {
        const token = getWpcomToken();
        if (!token) {
            return {
                content: [{ type: "text", text: "Authentication required — run: studio auth login" }],
                isError: true,
            };
        }
        const url = new URL(`${WPCOM_REST_BASE}/rest/v1.1/sites/${encodeURIComponent(site)}/stats/summary`);
        url.searchParams.set("period", period ?? "day");
        url.searchParams.set("num", String(num));
        if (date)
            url.searchParams.set("date", date);
        const res = await httpRequest(url.toString(), "GET", {
            "Authorization": `Bearer ${token}`,
        });
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ── wpcom_media ───────────────────────────────────────────────────────────
    server.tool("wpcom_media", "List media library items from a WordPress.com site.", {
        site: z.string().describe("WordPress.com site ID or domain"),
        mime_type: z.string().optional().describe("Filter by MIME type, e.g. 'image', 'image/jpeg', 'video'"),
        number: z.number().optional().default(20).describe("Items to return (max 100)"),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
    }, async ({ site, mime_type, number, offset, search }) => {
        const token = getWpcomToken();
        if (!token) {
            return {
                content: [{ type: "text", text: "Authentication required — run: studio auth login" }],
                isError: true,
            };
        }
        const url = new URL(`${WPCOM_REST_BASE}/rest/v1.1/sites/${encodeURIComponent(site)}/media`);
        url.searchParams.set("number", String(number));
        url.searchParams.set("offset", String(offset));
        if (mime_type)
            url.searchParams.set("mime_type", mime_type);
        if (search)
            url.searchParams.set("search", search);
        const res = await httpRequest(url.toString(), "GET", {
            "Authorization": `Bearer ${token}`,
        });
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ══════════════════════════════════════════════════════════════════════════════
    // LOCAL STUDIO SITE — WordPress Core REST API (/wp-json/)
    // ══════════════════════════════════════════════════════════════════════════════
    // ── wp_rest_get ───────────────────────────────────────────────────────────
    server.tool("wp_rest_get", "Make a GET request to the WordPress core REST API on a local Studio site. " +
        "Base URL: http://localhost:{port}/wp-json/. " +
        "Supports /wp/v2/ (posts, pages, media, users, taxonomies, settings) and /wpcom/ endpoints. " +
        "Example: endpoint='/wp/v2/posts?per_page=5'", {
        site: z.string().describe("Site name or absolute site path"),
        endpoint: z.string().describe("REST API path, e.g. '/wp/v2/posts', '/wp/v2/pages', '/wp/v2/users', '/' for root"),
        params: z.record(z.string()).optional().describe("Extra query-string parameters"),
        app_password: z.string().optional().describe("WordPress Application Password for authenticated requests. Format: 'username:app-password'"),
    }, async ({ site, endpoint, params, app_password }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found. Use studio_registry to list available sites.` }],
                isError: true,
            };
        }
        const base = `http://localhost:${siteData.port}/wp-json`;
        const url = new URL(base + (endpoint.startsWith("/") ? endpoint : "/" + endpoint));
        if (params)
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        const headers = {};
        if (app_password) {
            const encoded = Buffer.from(app_password).toString("base64");
            headers["Authorization"] = `Basic ${encoded}`;
        }
        const res = await httpRequest(url.toString(), "GET", headers);
        const text = `GET ${url}\nStatus: ${res.status}\n\n${formatJson(res.body)}`;
        return { content: [{ type: "text", text }], isError: res.status >= 400 };
    });
    // ── wp_rest_request ───────────────────────────────────────────────────────
    server.tool("wp_rest_request", "Make a POST / PUT / PATCH / DELETE request to the WordPress REST API on a local Studio site. " +
        "Requires a WordPress Application Password for authentication. " +
        "Create one in WP Admin → Users → Profile → Application Passwords.", {
        site: z.string().describe("Site name or absolute site path"),
        method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
        endpoint: z.string().describe("REST API path, e.g. '/wp/v2/posts/42'"),
        body: z.record(z.unknown()).optional().describe("Request body as JSON object"),
        app_password: z.string().describe("WordPress Application Password. Format: 'username:xxxx xxxx xxxx xxxx xxxx xxxx'"),
    }, async ({ site, method, endpoint, body, app_password }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found. Use studio_registry to list available sites.` }],
                isError: true,
            };
        }
        const base = `http://localhost:${siteData.port}/wp-json`;
        const url = base + (endpoint.startsWith("/") ? endpoint : "/" + endpoint);
        const encoded = Buffer.from(app_password).toString("base64");
        const bodyStr = body ? JSON.stringify(body) : undefined;
        const res = await httpRequest(url, method, {
            "Authorization": `Basic ${encoded}`,
            "Content-Type": "application/json",
        }, bodyStr);
        const text = `${method} ${url}\nStatus: ${res.status}\n\n${formatJson(res.body)}`;
        return { content: [{ type: "text", text }], isError: res.status >= 400 };
    });
    // ── wp_rest_routes ────────────────────────────────────────────────────────
    server.tool("wp_rest_routes", "List all registered REST API routes on a local Studio site. " +
        "Returns namespaces, methods, and endpoint descriptions from /wp-json/.", {
        site: z.string().describe("Site name or absolute site path"),
        namespace: z.string().optional().describe("Filter by namespace, e.g. 'wp/v2', 'wc/v3', 'wpcom/v2'"),
    }, async ({ site, namespace }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found. Use studio_registry to list available sites.` }],
                isError: true,
            };
        }
        const url = `http://localhost:${siteData.port}/wp-json/`;
        const res = await httpRequest(url, "GET", {});
        if (res.status >= 400) {
            return {
                content: [{ type: "text", text: `Could not reach ${url} (status ${res.status}). Is the site running?` }],
                isError: true,
            };
        }
        try {
            const data = JSON.parse(res.body);
            const namespaces = data.namespaces ?? [];
            const routes = data.routes ?? {};
            const filteredRoutes = namespace
                ? Object.entries(routes).filter(([r]) => r.startsWith("/" + namespace))
                : Object.entries(routes);
            const lines = [
                `Site:       ${siteData.name}`,
                `URL:        ${url}`,
                `Namespaces: ${namespaces.join(", ")}`,
                "",
                `Routes${namespace ? ` (/${namespace})` : ""}: ${filteredRoutes.length}`,
                "",
                ...filteredRoutes.map(([route, info]) => `${(info.methods ?? []).join(", ").padEnd(18)} ${route}`),
            ];
            return { content: [{ type: "text", text: lines.join("\n") }] };
        }
        catch {
            return { content: [{ type: "text", text: formatJson(res.body) }] };
        }
    });
    // ── wp_rest_posts ─────────────────────────────────────────────────────────
    server.tool("wp_rest_posts", "List posts from a local Studio site via the WordPress REST API (/wp/v2/posts). " +
        "Returns ID, title, status, date, link, excerpt, categories, tags.", {
        site: z.string().describe("Site name or absolute site path"),
        status: z.string().optional().default("publish").describe("Comma-separated statuses: publish, draft, pending, private, any"),
        per_page: z.number().min(1).max(100).optional().default(10),
        page: z.number().optional().default(1),
        search: z.string().optional(),
        categories: z.string().optional().describe("Comma-separated category IDs"),
        tags: z.string().optional().describe("Comma-separated tag IDs"),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        orderby: z.enum(["date", "title", "modified", "id", "slug", "relevance"]).optional().default("date"),
        app_password: z.string().optional().describe("user:app-password for draft/private posts"),
    }, async ({ site, status, per_page, page, search, categories, tags, order, orderby, app_password }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found.` }],
                isError: true,
            };
        }
        const url = new URL(`http://localhost:${siteData.port}/wp-json/wp/v2/posts`);
        url.searchParams.set("per_page", String(per_page));
        url.searchParams.set("page", String(page));
        url.searchParams.set("status", status ?? "publish");
        url.searchParams.set("order", order ?? "desc");
        url.searchParams.set("orderby", orderby ?? "date");
        url.searchParams.set("_fields", "id,date,modified,slug,status,type,link,title,excerpt,categories,tags,author");
        if (search)
            url.searchParams.set("search", search);
        if (categories)
            url.searchParams.set("categories", categories);
        if (tags)
            url.searchParams.set("tags", tags);
        const headers = {};
        if (app_password) {
            headers["Authorization"] = `Basic ${Buffer.from(app_password).toString("base64")}`;
        }
        const res = await httpRequest(url.toString(), "GET", headers);
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ── wp_rest_users ─────────────────────────────────────────────────────────
    server.tool("wp_rest_users", "List users from a local Studio site via the WordPress REST API (/wp/v2/users). " +
        "Requires an Application Password with administrator role.", {
        site: z.string().describe("Site name or absolute site path"),
        per_page: z.number().optional().default(20),
        roles: z.string().optional().describe("Comma-separated roles: administrator, editor, author, contributor, subscriber"),
        search: z.string().optional(),
        app_password: z.string().describe("user:app-password (administrator role required)"),
    }, async ({ site, per_page, roles, search, app_password }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found.` }],
                isError: true,
            };
        }
        const url = new URL(`http://localhost:${siteData.port}/wp-json/wp/v2/users`);
        url.searchParams.set("per_page", String(per_page));
        url.searchParams.set("_fields", "id,name,slug,email,roles,registered_date,link");
        if (roles)
            url.searchParams.set("roles", roles);
        if (search)
            url.searchParams.set("search", search);
        const res = await httpRequest(url.toString(), "GET", {
            "Authorization": `Basic ${Buffer.from(app_password).toString("base64")}`,
        });
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ── wp_rest_taxonomies ────────────────────────────────────────────────────
    server.tool("wp_rest_taxonomies", "List categories or tags from a local Studio site via the WordPress REST API.", {
        site: z.string().describe("Site name or absolute site path"),
        taxonomy: z.enum(["categories", "tags"]).default("categories"),
        per_page: z.number().optional().default(50),
        search: z.string().optional(),
        hide_empty: z.boolean().optional().default(false).describe("Only return terms with posts"),
    }, async ({ site, taxonomy, per_page, search, hide_empty }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found.` }],
                isError: true,
            };
        }
        const url = new URL(`http://localhost:${siteData.port}/wp-json/wp/v2/${taxonomy}`);
        url.searchParams.set("per_page", String(per_page));
        url.searchParams.set("hide_empty", String(hide_empty));
        url.searchParams.set("_fields", "id,name,slug,description,count,parent,link");
        if (search)
            url.searchParams.set("search", search);
        const res = await httpRequest(url.toString(), "GET", {});
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ── wp_rest_settings ──────────────────────────────────────────────────────
    server.tool("wp_rest_settings", "Read site settings from a local Studio site via /wp/v2/settings. " +
        "Returns title, description, URL, timezone, date/time format, language. " +
        "Requires an Application Password.", {
        site: z.string().describe("Site name or absolute site path"),
        app_password: z.string().describe("user:app-password (administrator role required)"),
    }, async ({ site, app_password }) => {
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found.` }],
                isError: true,
            };
        }
        const url = `http://localhost:${siteData.port}/wp-json/wp/v2/settings`;
        const res = await httpRequest(url, "GET", {
            "Authorization": `Basic ${Buffer.from(app_password).toString("base64")}`,
        });
        return { content: [{ type: "text", text: formatJson(res.body) }], isError: res.status >= 400 };
    });
    // ══════════════════════════════════════════════════════════════════════════════
    // THEME CONTEXT — design tokens for block content generation
    // ══════════════════════════════════════════════════════════════════════════════
    // ── wpcom_theme_context ───────────────────────────────────────────────────
    server.tool("wpcom_theme_context", "Get theme design context from a WordPress.com site: active theme name, color palette, " +
        "font sizes, font families, spacing scale, gradients, and per-block style overrides. " +
        "Use this before generating block content so Claude uses the correct design tokens " +
        "(preset slugs like 'has-primary-color', 'has-large-font-size') instead of hard-coded values. " +
        "Mirrors the wpcom-mcp-site-editor-context tool from the official wordpress.com MCP.", {
        site: z.string().describe("WordPress.com site ID or domain, e.g. mysite.wordpress.com"),
        operation: z.enum(["active", "presets", "styles", "blocks", "all"]).default("all").describe("active=theme name only | presets=colors/fonts/spacing | styles=block overrides | blocks=allowed block types | all=everything"),
    }, async ({ site, operation }) => {
        const token = getWpcomToken();
        if (!token) {
            return {
                content: [{ type: "text", text: "Not authenticated to WordPress.com.\nRun: studio auth login" }],
                isError: true,
            };
        }
        const headers = { "Authorization": `Bearer ${token}` };
        const enc = encodeURIComponent(site);
        const results = {};
        // ── active theme ─────────────────────────────────────────────────────────
        if (operation === "active" || operation === "all") {
            const res = await httpRequest(`${WPCOM_REST_BASE}/rest/v1.1/sites/${enc}/themes?filter=active`, "GET", headers);
            if (res.status < 400) {
                try {
                    const data = JSON.parse(res.body);
                    const theme = data.themes?.[0];
                    results.active_theme = {
                        stylesheet: theme?.stylesheet,
                        name: theme?.name,
                        author: theme?.author?.name,
                    };
                }
                catch {
                    results.active_theme = res.body;
                }
            }
            else {
                results.active_theme_error = `HTTP ${res.status}`;
            }
        }
        // ── global styles (presets + block styles) ────────────────────────────────
        if (operation === "presets" || operation === "styles" || operation === "all") {
            // Get stylesheet slug from active theme if we haven't fetched it yet
            let stylesheet = results.active_theme?.stylesheet;
            if (!stylesheet) {
                const res = await httpRequest(`${WPCOM_REST_BASE}/rest/v1.1/sites/${enc}/themes?filter=active`, "GET", headers);
                if (res.status < 400) {
                    try {
                        const data = JSON.parse(res.body);
                        stylesheet = data.themes?.[0]?.stylesheet;
                    }
                    catch { /* ignore */ }
                }
            }
            if (stylesheet) {
                const gsRes = await httpRequest(`${WPCOM_REST_BASE}/wpcom/v2/sites/${enc}/global-styles/themes/${encodeURIComponent(stylesheet)}`, "GET", headers);
                if (gsRes.status < 400) {
                    try {
                        const gs = JSON.parse(gsRes.body);
                        if (operation === "presets" || operation === "all") {
                            results.presets = {
                                color_palette: gs.settings?.color?.palette ?? [],
                                gradients: gs.settings?.color?.gradients ?? [],
                                font_sizes: gs.settings?.typography?.fontSizes ?? [],
                                font_families: gs.settings?.typography?.fontFamilies ?? [],
                                spacing_sizes: gs.settings?.spacing?.spacingSizes ?? [],
                            };
                        }
                        if (operation === "styles" || operation === "all") {
                            results.block_styles = gs.styles ?? {};
                        }
                    }
                    catch {
                        results.global_styles_raw = gsRes.body.slice(0, 2000);
                    }
                }
                else {
                    results.global_styles_error = `HTTP ${gsRes.status} — stylesheet: ${stylesheet}`;
                }
            }
            else {
                results.global_styles_error = "Could not determine active theme stylesheet slug";
            }
        }
        // ── allowed block types ───────────────────────────────────────────────────
        if (operation === "blocks" || operation === "all") {
            const bRes = await httpRequest(`${WPCOM_REST_BASE}/wp/v2/sites/${enc}/block-types?per_page=100`, "GET", headers);
            if (bRes.status < 400) {
                try {
                    const blocks = JSON.parse(bRes.body);
                    results.allowed_blocks = blocks.map(b => ({
                        name: b.name,
                        title: b.title,
                        category: b.category,
                    }));
                }
                catch {
                    results.allowed_blocks_raw = bRes.body.slice(0, 2000);
                }
            }
            else {
                // Fallback: use the /wp/v2/block-types endpoint via the site's REST API
                results.allowed_blocks_error = `HTTP ${bRes.status} — try wp_theme_json on a local site`;
            }
        }
        return {
            content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
    });
    // ── wp_theme_json ─────────────────────────────────────────────────────────
    server.tool("wp_theme_json", "Read theme.json from the active theme on a local Studio site. " +
        "Returns design tokens: color palette, font sizes, font families, gradients, " +
        "spacing scale, and per-block style overrides. " +
        "Use before generating block content to align with the site's visual design. " +
        "Active theme is read from the SQLite database — site does not need to be running.", {
        site: z.string().describe("Site name or absolute site path"),
        section: z.enum(["all", "colors", "fonts", "spacing", "blocks", "raw"]).default("all").describe("all=full design tokens | colors=palette+gradients | fonts=sizes+families | " +
            "spacing=sizes+scale | blocks=per-block styles | raw=complete theme.json"),
    }, async ({ site, section }) => {
        // ── 1. resolve site ───────────────────────────────────────────────────────
        const siteData = findSite(site) ?? getSites().find(s => s.path === path.join(STUDIO_SITES_ROOT, site));
        if (!siteData) {
            return {
                content: [{ type: "text", text: `Site "${site}" not found. Use studio_registry to list available sites.` }],
                isError: true,
            };
        }
        // ── 2. get active theme slug from SQLite ─────────────────────────────────
        const dbPath = path.join(siteData.path, "wp-content", "database", ".ht.sqlite");
        if (!fs.existsSync(dbPath)) {
            return {
                content: [{ type: "text", text: `SQLite database not found at: ${dbPath}\n` +
                            "The site may not have been started yet — try running it once to initialise the DB." }],
                isError: true,
            };
        }
        let activeTheme = null;
        try {
            const db = new DatabaseSync(dbPath, { open: true });
            // Try with the standard wp_ prefix; fall back to searching all tables
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%options'").all();
            const optTable = tables[0]?.name ?? "wp_options";
            const row = db.prepare(`SELECT option_value FROM ${optTable} WHERE option_name = 'stylesheet' LIMIT 1`).get();
            activeTheme = row?.option_value ?? null;
            db.close();
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `Failed to read SQLite database: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
        if (!activeTheme) {
            return {
                content: [{ type: "text", text: "Could not determine active theme from the database (stylesheet option not found)." }],
                isError: true,
            };
        }
        // ── 3. read theme.json ────────────────────────────────────────────────────
        const themeJsonPath = path.join(siteData.path, "wp-content", "themes", activeTheme, "theme.json");
        if (!fs.existsSync(themeJsonPath)) {
            return {
                content: [{ type: "text", text: `theme.json not found for active theme "${activeTheme}".\n` +
                            `Expected path: ${themeJsonPath}\n\n` +
                            "Classic (non-block) themes do not have theme.json. " +
                            "This tool is intended for block themes (Full Site Editing)." }],
                isError: true,
            };
        }
        let themeJson;
        try {
            themeJson = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `Failed to parse theme.json: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
        // ── 4. filter by section and return ──────────────────────────────────────
        const header = [
            `Site:          ${siteData.name}`,
            `Active theme:  ${activeTheme}`,
            `theme.json:    ${themeJsonPath}`,
            `Schema version: ${themeJson.version ?? "unknown"}`,
            "",
        ].join("\n");
        let output;
        switch (section) {
            case "raw":
                output = themeJson;
                break;
            case "colors":
                output = {
                    color_palette: themeJson.settings?.color?.palette ?? [],
                    gradients: themeJson.settings?.color?.gradients ?? [],
                };
                break;
            case "fonts":
                output = {
                    font_sizes: themeJson.settings?.typography?.fontSizes ?? [],
                    font_families: themeJson.settings?.typography?.fontFamilies ?? [],
                };
                break;
            case "spacing":
                output = {
                    spacing_sizes: themeJson.settings?.spacing?.spacingSizes ?? [],
                    padding: themeJson.settings?.spacing?.padding,
                    margin: themeJson.settings?.spacing?.margin,
                };
                break;
            case "blocks":
                output = {
                    block_styles: themeJson.styles?.blocks ?? {},
                    element_styles: themeJson.styles?.elements ?? {},
                };
                break;
            case "all":
            default:
                output = {
                    color_palette: themeJson.settings?.color?.palette ?? [],
                    gradients: themeJson.settings?.color?.gradients ?? [],
                    font_sizes: themeJson.settings?.typography?.fontSizes ?? [],
                    font_families: themeJson.settings?.typography?.fontFamilies ?? [],
                    spacing_sizes: themeJson.settings?.spacing?.spacingSizes ?? [],
                    block_styles: themeJson.styles?.blocks ?? {},
                    element_styles: themeJson.styles?.elements ?? {},
                    global_styles: {
                        color: themeJson.styles?.color,
                        typography: themeJson.styles?.typography,
                        spacing: themeJson.styles?.spacing,
                    },
                };
                break;
        }
        const text = header + JSON.stringify(output, null, 2);
        return { content: [{ type: "text", text }] };
    });
}
//# sourceMappingURL=rest-api.js.map