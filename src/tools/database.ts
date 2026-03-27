/**
 * tools/database.ts
 *
 * MCP tools for querying / exporting the SQLite database that WordPress Studio
 * uses via the sqlite-database-integration plugin (v2.2.17).
 *
 * DB location per site: {sitePath}/wp-content/database/.ht.sqlite
 *
 * Uses Node.js built-in node:sqlite (stable since Node v23.4, available in v24).
 * No native build or Python required.
 */

import fs   from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }          from "zod";
import {
  findSite,
  getSqlitePath,
  STUDIO_SITES_ROOT,
} from "../studio-config.js";

function openDb(dbPath: string): DatabaseSync {
  return new DatabaseSync(dbPath);
}

export function registerDatabaseTools(server: McpServer): void {

  // ── db_list_tables ────────────────────────────────────────────────────────

  server.tool(
    "db_list_tables",
    "List all tables in the SQLite database for a Studio site.",
    {
      site: z.string().describe("Site name or absolute site path"),
    },
    async ({ site }) => {
      const siteData = findSite(site);
      const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const dbPath   = getSqlitePath(siteRoot);

      if (!fs.existsSync(dbPath)) {
        return {
          content: [{
            type: "text" as const,
            text: `SQLite DB not found at:\n${dbPath}\n\nStart the site at least once so Studio creates the database.`,
          }],
          isError: true,
        };
      }

      const db = openDb(dbPath);
      try {
        const tables = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).all() as Array<{ name: string }>;

        const text = `Tables in "${site}":\n\n` + tables.map(t => `  • ${t.name}`).join("\n");
        return { content: [{ type: "text" as const, text }] };
      } finally {
        db.close();
      }
    }
  );

  // ── db_describe_table ─────────────────────────────────────────────────────

  server.tool(
    "db_describe_table",
    "Show column names, types, and constraints for a table in a Studio site's SQLite DB.",
    {
      site:  z.string().describe("Site name or absolute site path"),
      table: z.string().describe("Table name, e.g. 'wp_posts'"),
    },
    async ({ site, table }) => {
      const siteData = findSite(site);
      const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const dbPath   = getSqlitePath(siteRoot);

      if (!fs.existsSync(dbPath)) {
        return { content: [{ type: "text" as const, text: `SQLite DB not found at: ${dbPath}` }], isError: true };
      }

      const db = openDb(dbPath);
      try {
        const validTables = (db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table'"
        ).all() as Array<{ name: string }>).map(r => r.name);

        if (!validTables.includes(table)) {
          return {
            content: [{ type: "text" as const, text: `Table "${table}" not found.\nAvailable: ${validTables.join(", ")}` }],
            isError: true,
          };
        }

        const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
          cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number;
        }>;

        const rows = cols.map(c =>
          `  ${c.pk ? "🔑" : "  "} ${c.name.padEnd(30)} ${c.type.padEnd(15)} ${c.notnull ? "NOT NULL" : "NULLABLE"}`
        );

        const createSql = (db.prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
        ).get(table) as { sql: string }).sql;

        return {
          content: [{
            type: "text" as const,
            text: `Table: ${table}\n\n${rows.join("\n")}\n\nCREATE SQL:\n${createSql}`,
          }],
        };
      } finally {
        db.close();
      }
    }
  );

  // ── db_query ──────────────────────────────────────────────────────────────

  server.tool(
    "db_query",
    "Execute a read-only SELECT query on a Studio site's SQLite database.",
    {
      site:  z.string().describe("Site name or absolute site path"),
      sql:   z.string().describe("SELECT SQL query"),
      limit: z.number().optional().default(100).describe("Max rows (default: 100)"),
    },
    async ({ site, sql, limit }) => {
      const trimmed = sql.trim().toUpperCase();
      if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
        return {
          content: [{ type: "text" as const, text: "Only SELECT / WITH queries are allowed here. Use db_execute for writes." }],
          isError: true,
        };
      }

      const siteData = findSite(site);
      const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const dbPath   = getSqlitePath(siteRoot);

      if (!fs.existsSync(dbPath)) {
        return { content: [{ type: "text" as const, text: `SQLite DB not found at: ${dbPath}` }], isError: true };
      }

      const db = openDb(dbPath);
      try {
        const safeSql = /LIMIT\s+\d+/i.test(sql) ? sql : `${sql} LIMIT ${limit}`;
        const rows    = db.prepare(safeSql).all() as Record<string, unknown>[];

        if (rows.length === 0) return { content: [{ type: "text" as const, text: "No rows returned." }] };

        const header  = Object.keys(rows[0]).join(" | ");
        const divider = header.replace(/[^|]/g, "-");
        const body    = rows.map(r =>
          Object.values(r).map(v => v === null ? "NULL" : String(v).slice(0, 80)).join(" | ")
        );

        const text = [header, divider, ...body, `\n(${rows.length} row${rows.length !== 1 ? "s" : ""})`].join("\n");
        return { content: [{ type: "text" as const, text }] };
      } finally {
        db.close();
      }
    }
  );

  // ── db_execute ────────────────────────────────────────────────────────────

  server.tool(
    "db_execute",
    "Execute a write SQL statement (INSERT, UPDATE, DELETE, etc.) on a Studio site's SQLite DB. Changes are immediate.",
    {
      site: z.string().describe("Site name or absolute site path"),
      sql:  z.string().describe("SQL statement to execute"),
    },
    async ({ site, sql }) => {
      const siteData = findSite(site);
      const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const dbPath   = getSqlitePath(siteRoot);

      if (!fs.existsSync(dbPath)) {
        return { content: [{ type: "text" as const, text: `SQLite DB not found at: ${dbPath}` }], isError: true };
      }

      const db = openDb(dbPath);
      try {
        const info = db.prepare(sql).run();
        return {
          content: [{
            type: "text" as const,
            text: `✓ Statement executed.\nRows affected:      ${info.changes}\nLast insert rowid:  ${info.lastInsertRowid}`,
          }],
        };
      } finally {
        db.close();
      }
    }
  );

  // ── db_export_sql ─────────────────────────────────────────────────────────

  server.tool(
    "db_export_sql",
    "Export the SQLite database for a Studio site as a SQL dump (schema + INSERT rows).",
    {
      site:         z.string().describe("Site name or absolute site path"),
      include_data: z.boolean().optional().default(true)
        .describe("Include INSERT statements (default: true)"),
    },
    async ({ site, include_data }) => {
      const siteData = findSite(site);
      const siteRoot = siteData?.path ?? path.join(STUDIO_SITES_ROOT, site);
      const dbPath   = getSqlitePath(siteRoot);

      if (!fs.existsSync(dbPath)) {
        return { content: [{ type: "text" as const, text: `SQLite DB not found at: ${dbPath}` }], isError: true };
      }

      const db = openDb(dbPath);
      try {
        const tables = db.prepare(
          "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
        ).all() as Array<{ name: string; sql: string }>;

        const lines: string[] = [
          `-- WordPress Studio SQLite Export`,
          `-- Site:  ${site}`,
          `-- Date:  ${new Date().toISOString()}`,
          `-- DB:    ${dbPath}`,
          "",
        ];

        for (const { name, sql: createSql } of tables) {
          lines.push(`-- Table: ${name}`, createSql + ";", "");

          if (include_data) {
            const rows = db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
            for (const row of rows) {
              const values = Object.values(row).map(v => {
                if (v === null)            return "NULL";
                if (typeof v === "number") return String(v);
                return `'${String(v).replace(/'/g, "''")}'`;
              });
              lines.push(`INSERT INTO "${name}" VALUES (${values.join(", ")});`);
            }
            lines.push("");
          }
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } finally {
        db.close();
      }
    }
  );
}
