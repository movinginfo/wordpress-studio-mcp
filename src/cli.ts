#!/usr/bin/env node
/**
 * wpstudio — WordPress Studio MCP CLI
 * ─────────────────────────────────────
 * Calls any of the 71 MCP tools directly from the terminal.
 *
 * Usage:
 *   wpstudio list                              list all tools
 *   wpstudio help <tool>                       show tool params
 *   wpstudio <tool-name> [--key value ...]     call a tool
 *   wpstudio <tool-name> --json                raw MCP response as JSON
 *   wpstudio --version
 */

import { Client }               from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath }        from "node:url";
import path                     from "node:path";
import fs                       from "node:fs";
import { createRequire }        from "node:module";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const SERVER_PATH = path.join(__dirname, "index.js");
const require     = createRequire(import.meta.url);
const pkg         = require("../package.json") as { version: string };

// ─── Category map (prefix → display group) ────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  // Object key order does not matter — getCategory() sorts by length at lookup time
  "studio_blueprint_":  "BLUEPRINTS",
  "studio_site_health": "SITE REGISTRY & STATUS",
  "studio_site_":       "DOMAIN & HTTPS",
  "studio_domain_":     "DOMAIN & HTTPS",
  "studio_xdebug_":     "XDEBUG",
  "wpcli_db_":          "ADMINISTRATION",
  "wpcli_cron_":        "ADMINISTRATION",
  "wpcli_update_":      "ADMINISTRATION",
  "wp_rest_":           "REST API",
  "wp_theme_":          "REST API",
  "wp_config_":         "ADMINISTRATION",
  "wp_security_":       "ADMINISTRATION",
  "wp_php_":            "ADMINISTRATION",
  "wp_mcp_":            "ABILITIES",
  "wp_abilities_":      "ABILITIES",
  "wpcom_":             "WORDPRESS.COM",
  "studio_":            "SITE REGISTRY & STATUS",
  "fs_":                "FILESYSTEM",
  "db_":                "DATABASE",
  "wpcli_":             "WP-CLI",
  "vip_":               "VIP DESIGN",
  "marketing_":         "MARKETING",
};

const CATEGORY_ORDER = [
  "SITE REGISTRY & STATUS",
  "FILESYSTEM",
  "DATABASE",
  "WP-CLI",
  "REST API",
  "WORDPRESS.COM",
  "BLUEPRINTS",
  "VIP DESIGN",
  "ADMINISTRATION",
  "DOMAIN & HTTPS",
  "ABILITIES",
  "XDEBUG",
  "MARKETING",
  "OTHER",
];

function getCategory(toolName: string): string {
  const keys = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);
  const match = keys.find(k => toolName.startsWith(k));
  return match ? CATEGORY_MAP[match] : "OTHER";
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

interface ParsedArgs {
  subcommand: string;
  toolArgs:   Record<string, string | number | boolean>;
  json:       boolean;
  help:       boolean;
  version:    boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    subcommand: "",
    toolArgs:   {},
    json:       false,
    help:       false,
    version:    false,
  };

  if (!args.length) return result;

  // First token: subcommand or flag
  if (args[0] === "--version" || args[0] === "-v") { result.version = true; return result; }
  if (args[0] === "--help"    || args[0] === "-h") { result.help = true;    return result; }

  result.subcommand = args[0];

  // Remaining tokens: --key value pairs
  let i = 1;
  while (i < args.length) {
    const token = args[i];
    if (token === "--json")                 { result.json = true; i++; continue; }
    if (token === "--help" || token === "-h") { result.help = true; i++; continue; }

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        result.toolArgs[key] = true;
        i++;
      } else {
        result.toolArgs[key] = coerce(next);
        i += 2;
      }
    } else {
      i++;
    }
  }

  return result;
}

function coerce(val: string): string | number | boolean {
  if (val === "true")  return true;
  if (val === "false") return false;
  const n = Number(val);
  if (!isNaN(n) && isFinite(n) && val.trim() !== "") return n;
  return val;
}

// ─── Tool name conversion: kebab-case CLI name → snake_case MCP tool name ─────

function cliToMcp(name: string): string {
  return name.replace(/-/g, "_");
}

// ─── Safe content extraction ──────────────────────────────────────────────────

function extractOutput(result: { content?: Array<{ type: string; text?: string }> }): string {
  const block = result.content?.[0];
  if (block?.type === "text" && block.text) return block.text;
  return JSON.stringify(result, null, 2);
}

// ─── MCP client ───────────────────────────────────────────────────────────────

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  if (!fs.existsSync(SERVER_PATH)) {
    console.error(`Error: server not built — run npm run build\n  (expected: ${SERVER_PATH})`);
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args:    [SERVER_PATH],
    stderr:  "ignore",   // suppress server banner + SQLite warnings
  });

  const client = new Client({ name: "wpstudio-cli", version: pkg.version });

  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

// ─── Built-in: list ───────────────────────────────────────────────────────────

async function cmdList() {
  const { tools } = await withClient(c => c.listTools());

  // Group by category
  const groups = new Map<string, typeof tools>();
  for (const tool of tools) {
    const cat = getCategory(tool.name);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(tool);
  }

  const lines: string[] = [
    `\nwpstudio — WordPress Studio MCP CLI  v${pkg.version}`,
    `${tools.length} tools available\n`,
  ];

  for (const cat of CATEGORY_ORDER) {
    const group = groups.get(cat);
    if (!group?.length) continue;
    lines.push(`\x1b[1;36m${cat}\x1b[0m`);
    for (const tool of group) {
      const cliName = tool.name.replace(/_/g, "-").padEnd(40);
      // First sentence of description
      const desc = (tool.description ?? "").split(/\.\s/)[0].replace(/\n/g, " ").slice(0, 80);
      lines.push(`  ${cliName} ${desc}`);
    }
    lines.push("");
  }

  lines.push(`Run: wpstudio help <tool-name>   for parameters`);
  lines.push(`Run: wpstudio <tool-name> [--key value ...]   to call a tool\n`);
  console.log(lines.join("\n"));
}

// ─── Built-in: help <tool> ────────────────────────────────────────────────────

async function cmdHelp(toolName: string) {
  if (!toolName) {
    await cmdList();
    return;
  }

  const mcpName = cliToMcp(toolName);
  const { tools } = await withClient(c => c.listTools());
  const tool = tools.find(t => t.name === mcpName)
    ?? tools.find(t => t.name.includes(mcpName));

  if (!tool) {
    console.error(`Error: tool "${toolName}" not found. Run "wpstudio list" to see all tools.`);
    process.exit(1);
  }

  const lines: string[] = [
    `\n\x1b[1m${tool.name}\x1b[0m — ${tool.description ?? ""}`,
    "",
  ];

  const schema = tool.inputSchema as {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  } | undefined;

  if (schema?.properties) {
    const required = schema.required ?? [];
    lines.push("Parameters:");
    for (const [key, prop] of Object.entries(schema.properties)) {
      const req  = required.includes(key) ? "\x1b[33m(required)\x1b[0m" : "(optional)";
      const type = prop.type ?? "string";
      const desc = prop.description ?? "";
      lines.push(`  --${key.padEnd(20)} ${req.padEnd(20)} [${type}]  ${desc}`);
    }
  } else {
    lines.push("  No parameters.");
  }

  lines.push(`\nExample:\n  wpstudio ${tool.name.replace(/_/g, "-")} ${
    Object.keys(schema?.properties ?? {}).slice(0, 2)
      .map(k => `--${k} <value>`).join(" ")
  }\n`);

  console.log(lines.join("\n"));
}

// ─── Main: call a tool ────────────────────────────────────────────────────────

async function cmdCall(toolName: string, toolArgs: Record<string, unknown>, asJson: boolean) {
  const mcpName = cliToMcp(toolName);

  // Spinner to stderr for long-running tools
  const spinner = process.stderr.isTTY
    ? (process.stderr.write(`\r\x1b[K\x1b[2m⏳ Running ${mcpName}…\x1b[0m`), true)
    : (process.stderr.write(`⏳ Running ${mcpName}…\n`), false);

  let result: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  try {
    result = await withClient(c => c.callTool({ name: mcpName, arguments: toolArgs })) as typeof result;
  } catch (err: unknown) {
    if (spinner && process.stderr.isTTY) process.stderr.write("\r\x1b[K");
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unknown tool") || msg.includes("not found")) {
      console.error(`Error: unknown tool "${toolName}". Run "wpstudio list" to see all tools.`);
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  }

  if (spinner && process.stderr.isTTY) process.stderr.write("\r\x1b[K");

  const output = extractOutput(result);

  if (result.isError) {
    console.error(output);
    process.exit(1);
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(output);
  }
}

// ─── Usage ────────────────────────────────────────────────────────────────────

function printUsage() {
  console.log(`
\x1b[1mwpstudio\x1b[0m — WordPress Studio MCP CLI  v${pkg.version}

\x1b[1mUsage:\x1b[0m
  wpstudio list                          List all available tools
  wpstudio help <tool>                   Show parameters for a tool
  wpstudio <tool> [--key value ...]      Call a tool
  wpstudio <tool> --json                 Output raw MCP response as JSON
  wpstudio --version                     Print version

\x1b[1mExamples:\x1b[0m
  wpstudio studio-registry
  wpstudio wpcli-plugin-list --site i-help.us
  wpstudio db-query --site i-help.us --sql "SELECT option_name FROM wp_options LIMIT 5"
  wpstudio studio-xdebug-enable --site i-help.us --confirmed true
  wpstudio marketing-skills-install --skills all --scope global

Run \x1b[36mwpstudio list\x1b[0m to see all 71 tools.
`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const parsed = parseArgs(process.argv);

// SIGINT → exit 130 (Unix convention: 128 + signal 2)
process.on("SIGINT", () => process.exit(130));

if (parsed.version) {
  console.log(`wpstudio v${pkg.version} (wordpress-studio-mcp)`);
  process.exit(0);
}

if (!parsed.subcommand || parsed.subcommand === "help" && !parsed.help) {
  // "wpstudio" or "wpstudio help" with no tool name
  if (parsed.subcommand === "help") {
    await cmdList();
  } else {
    printUsage();
  }
  process.exit(0);
}

if (parsed.help && parsed.subcommand && parsed.subcommand !== "help") {
  // wpstudio <tool> --help
  await cmdHelp(parsed.subcommand);
  process.exit(0);
}

if (parsed.subcommand === "list") {
  await cmdList();
  process.exit(0);
}

if (parsed.subcommand === "help") {
  // wpstudio help <tool> — subcommand is "help", tool name is first toolArg key or came as next positional
  // Re-parse: next positional after "help"
  const toolArg = process.argv[3];
  await cmdHelp(toolArg ?? "");
  process.exit(0);
}

await cmdCall(parsed.subcommand, parsed.toolArgs, parsed.json);
