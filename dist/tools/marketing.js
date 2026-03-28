/**
 * tools/marketing.ts
 *
 * Marketing Skills for Claude Code — powered by
 * https://github.com/coreyhaines31/marketingskills
 *
 * 34 production-grade marketing skills covering:
 *   CRO, Copywriting, SEO, Analytics, Growth Engineering,
 *   Paid Ads, Content Strategy, Revenue Operations.
 *
 * Skills install to ~/.claude/skills/{name}/ (global, accessible from any
 * Claude Code project) or to the current project's .claude/skills/.
 * Once installed, invoke any skill with /{skill-name} in Claude Code.
 *
 * Tools:
 *   marketing_skills_list      — Browse all 34 skills by category
 *   marketing_skills_install   — Download & install skills from GitHub
 *   marketing_skills_status    — Show what's installed / where
 *   marketing_skills_context   — Guide: set up product-marketing-context foundation
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
// ─── Skill catalog ────────────────────────────────────────────────────────────
const REPO_BASE = "https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/skills";
const MARKETING_SKILLS = [
    // ── Foundation (install this first) ───────────────────────────────────────
    {
        name: "product-marketing-context",
        category: "Foundation",
        description: "FOUNDATION — all other skills reference this. Captures product positioning, " +
            "ICP, differentiation, messaging hierarchy, and tone of voice into " +
            ".agents/product-marketing-context.md for use across all marketing work.",
    },
    // ── Conversion Rate Optimization ──────────────────────────────────────────
    {
        name: "page-cro",
        category: "CRO",
        description: "Optimize landing pages, homepages, pricing pages, and blog posts for " +
            "conversion. Identifies friction, weak CTAs, and trust gaps.",
    },
    {
        name: "signup-flow-cro",
        category: "CRO",
        description: "Improve signup, registration, and onboarding flows. Reduces drop-off, " +
            "speeds time-to-value, and increases activation rates.",
    },
    {
        name: "form-cro",
        category: "CRO",
        description: "Optimize form fields, labels, error states, and multi-step flows to " +
            "reduce abandonment and improve completion rates.",
    },
    {
        name: "onboarding-cro",
        category: "CRO",
        description: "Optimize the first-time user experience — welcome screens, empty states, " +
            "progressive disclosure, and aha-moment acceleration.",
    },
    {
        name: "paywall-upgrade-cro",
        category: "CRO",
        description: "Optimize in-app upgrade moments, paywalls, and upsell flows to convert " +
            "free users to paid without feeling coercive.",
    },
    {
        name: "popup-cro",
        category: "CRO",
        description: "Design and optimize popups, modals, banners, and overlays — timing, " +
            "targeting, copy, and exit intent flows.",
    },
    {
        name: "ab-test-setup",
        category: "CRO",
        description: "Plan and set up A/B tests: hypothesis framing, sample size calculations, " +
            "variant design, success metrics, and statistical significance.",
    },
    // ── Copywriting & Content ─────────────────────────────────────────────────
    {
        name: "copywriting",
        category: "Copy",
        description: "Write high-converting marketing copy for websites, landing pages, product " +
            "pages, and ads using proven frameworks (PAS, AIDA, BAB, etc.).",
    },
    {
        name: "copy-editing",
        category: "Copy",
        description: "Edit and refine existing marketing copy for clarity, persuasion, tone " +
            "consistency, and conversion effectiveness.",
    },
    {
        name: "cold-email",
        category: "Copy",
        description: "Write B2B cold outreach emails using frameworks (PAS, QVC, PPP). " +
            "Includes subject lines, personalization patterns, and follow-up sequences.",
    },
    {
        name: "social-content",
        category: "Copy",
        description: "Create social media content for LinkedIn, Twitter/X, Instagram, and " +
            "other platforms — posts, threads, hooks, and engagement frameworks.",
    },
    {
        name: "content-strategy",
        category: "Copy",
        description: "Plan and architect content strategy — topic clusters, content calendar, " +
            "distribution plan, and content-to-conversion mapping.",
    },
    {
        name: "email-sequence",
        category: "Copy",
        description: "Write automated email sequences — welcome series, nurture flows, " +
            "re-engagement campaigns, and transactional email copy.",
    },
    // ── SEO & Discovery ───────────────────────────────────────────────────────
    {
        name: "seo-audit",
        category: "SEO",
        description: "Comprehensive technical and content SEO audit — crawl issues, on-page " +
            "factors, Core Web Vitals, internal linking, and content gaps.",
    },
    {
        name: "ai-seo",
        category: "SEO",
        description: "Optimize content for AI-generated answers — ChatGPT, Perplexity, Claude, " +
            "and Google AI Overviews. Structure, citations, and entity coverage.",
    },
    {
        name: "programmatic-seo",
        category: "SEO",
        description: "Design and build template-based page generation at scale — data sources, " +
            "URL patterns, content templates, and uniqueness strategies.",
    },
    {
        name: "schema-markup",
        category: "SEO",
        description: "Implement structured data (JSON-LD) — Article, Product, FAQ, HowTo, " +
            "BreadcrumbList, Organization, and rich result validation.",
    },
    {
        name: "site-architecture",
        category: "SEO",
        description: "Plan site structure — URL taxonomy, internal linking strategy, " +
            "pillar/cluster model, navigation hierarchy, and crawl efficiency.",
    },
    // ── Paid & Analytics ─────────────────────────────────────────────────────
    {
        name: "paid-ads",
        category: "Paid",
        description: "Plan and optimize Google, Meta, and LinkedIn ad campaigns — campaign " +
            "structure, audience targeting, bidding strategy, and budget allocation.",
    },
    {
        name: "ad-creative",
        category: "Paid",
        description: "Generate ad creative — headlines, descriptions, hooks, and visual " +
            "direction for display, social, search, and video ads.",
    },
    {
        name: "analytics-tracking",
        category: "Analytics",
        description: "Set up and audit GA4, GTM, and analytics tracking — event taxonomy, " +
            "conversion goals, funnel reporting, and data layer implementation.",
    },
    // ── Growth & Acquisition ──────────────────────────────────────────────────
    {
        name: "launch-strategy",
        category: "Growth",
        description: "Plan product and feature launches — positioning, channel mix, " +
            "pre-launch buildup, launch day execution, and post-launch amplification.",
    },
    {
        name: "referral-program",
        category: "Growth",
        description: "Design referral mechanics — incentive structures, referral flows, " +
            "messaging, and viral coefficient optimization.",
    },
    {
        name: "free-tool-strategy",
        category: "Growth",
        description: "Build and market free tools for acquisition — tool ideation, SEO " +
            "value, conversion path, and freemium upgrade mechanics.",
    },
    {
        name: "lead-magnets",
        category: "Growth",
        description: "Create high-value lead capture offers — templates, calculators, guides, " +
            "and checklists that attract and qualify ideal customers.",
    },
    {
        name: "competitor-alternatives",
        category: "Growth",
        description: "Create competitor alternative content and battle cards — " +
            "{Competitor} vs {Your Product} pages, win/loss analysis, and positioning.",
    },
    {
        name: "marketing-ideas",
        category: "Growth",
        description: "Brainstorm and prioritize marketing ideas — campaigns, channels, " +
            "experiments, and growth levers tailored to stage and budget.",
    },
    // ── Revenue & Strategy ────────────────────────────────────────────────────
    {
        name: "pricing-strategy",
        category: "Revenue",
        description: "Design pricing models, tier structures, and packaging — value metrics, " +
            "competitor analysis, willingness-to-pay research, and price page copy.",
    },
    {
        name: "churn-prevention",
        category: "Revenue",
        description: "Reduce churn through cancel-flow optimization, dunning sequences, " +
            "win-back campaigns, and proactive retention triggers.",
    },
    {
        name: "customer-research",
        category: "Revenue",
        description: "Plan and execute customer research — interview guides, survey design, " +
            "Jobs-to-be-Done frameworks, and insight synthesis.",
    },
    {
        name: "sales-enablement",
        category: "Revenue",
        description: "Build sales tools — pitch decks, one-pagers, objection handling guides, " +
            "case studies, and battle cards for the sales team.",
    },
    {
        name: "revops",
        category: "Revenue",
        description: "Design revenue operations systems — lead routing, attribution models, " +
            "CRM hygiene, handoff processes, and funnel reporting.",
    },
    {
        name: "marketing-psychology",
        category: "Revenue",
        description: "Apply psychological principles to marketing — social proof, scarcity, " +
            "reciprocity, loss aversion, and cognitive bias frameworks.",
    },
];
const CATEGORIES = [...new Set(MARKETING_SKILLS.map(s => s.category))];
// ─── Install paths ────────────────────────────────────────────────────────────
const GLOBAL_SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");
const PROJECT_SKILLS_DIR = path.join(process.cwd(), ".claude", "skills");
function skillsDir(scope) {
    return scope === "global" ? GLOBAL_SKILLS_DIR : PROJECT_SKILLS_DIR;
}
function isInstalled(skillName, scope) {
    return fs.existsSync(path.join(skillsDir(scope), skillName, "SKILL.md"));
}
// ─── GitHub downloader ────────────────────────────────────────────────────────
async function fetchSkillMd(skillName) {
    const url = `${REPO_BASE}/${skillName}/SKILL.md`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok)
            return null;
        return await res.text();
    }
    catch {
        return null;
    }
}
async function installSkill(skillName, scope, content) {
    const skillDir = path.join(skillsDir(scope), skillName);
    const skillFile = path.join(skillDir, "SKILL.md");
    const md = content ?? await fetchSkillMd(skillName);
    if (!md) {
        return { ok: false, message: `Failed to fetch SKILL.md for '${skillName}' from GitHub` };
    }
    try {
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(skillFile, md, "utf-8");
        return { ok: true, message: `Installed → ${skillFile}` };
    }
    catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
}
// ─── Tool registration ────────────────────────────────────────────────────────
export function registerMarketingTools(server) {
    // ── marketing_skills_list ─────────────────────────────────────────────────
    server.tool("marketing_skills_list", "Browse all 34 marketing skills from https://github.com/coreyhaines31/marketingskills. " +
        "Skills cover CRO, Copywriting, SEO, Analytics, Paid Ads, Growth, and Revenue Ops. " +
        "Use marketing_skills_install to download and install them into Claude Code. " +
        "Once installed, invoke any skill with /skill-name in Claude Code.", {
        category: z.enum(["all", ...CATEGORIES])
            .optional().default("all")
            .describe("Filter by category: CRO, Copy, SEO, Paid, Analytics, Growth, Revenue, Foundation"),
    }, async ({ category }) => {
        const skills = category === "all"
            ? MARKETING_SKILLS
            : MARKETING_SKILLS.filter(s => s.category === category);
        const lines = [
            `Marketing Skills — ${category === "all" ? "All 34 skills" : category}`,
            "─".repeat(60),
            "",
            "Source:  https://github.com/coreyhaines31/marketingskills",
            "Install: marketing_skills_install  skills:all  confirmed:true",
            "Usage:   /skill-name  in Claude Code after installing",
            "",
        ];
        const byCategory = {};
        for (const s of skills) {
            if (!byCategory[s.category])
                byCategory[s.category] = [];
            byCategory[s.category].push(s);
        }
        const catOrder = ["Foundation", "CRO", "Copy", "SEO", "Paid", "Analytics", "Growth", "Revenue"];
        for (const cat of catOrder) {
            const group = byCategory[cat];
            if (!group?.length)
                continue;
            lines.push(`── ${cat} ${"─".repeat(55 - cat.length)}`);
            for (const s of group) {
                const installedG = isInstalled(s.name, "global") ? " ✅global" : "";
                const installedP = isInstalled(s.name, "project") ? " ✅project" : "";
                lines.push(`  /${s.name}${installedG}${installedP}`);
                lines.push(`    ${s.description.slice(0, 100)}${s.description.length > 100 ? "…" : ""}`);
            }
            lines.push("");
        }
        lines.push("─".repeat(60));
        lines.push(`${skills.length} skills listed · ✅ = already installed`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
    // ── marketing_skills_install ──────────────────────────────────────────────
    server.tool("marketing_skills_install", "Download and install marketing skills from https://github.com/coreyhaines31/marketingskills " +
        "into Claude Code skills directories. " +
        "Installs to ~/.claude/skills/ (global, works in any project) by default. " +
        "Once installed, invoke with /skill-name in Claude Code — e.g. /copywriting, /seo-audit. " +
        "Always install 'product-marketing-context' first — it's the foundation all other skills use. " +
        "Skills are downloaded fresh from GitHub on each install.", {
        skills: z.union([
            z.literal("all"),
            z.literal("foundation"),
            z.literal("cro"),
            z.literal("copy"),
            z.literal("seo"),
            z.literal("paid"),
            z.literal("analytics"),
            z.literal("growth"),
            z.literal("revenue"),
            z.string().describe("Comma-separated skill names, e.g. 'copywriting,seo-audit,page-cro'"),
        ])
            .describe("Which skills to install: 'all', a category name (cro/copy/seo/paid/analytics/growth/revenue), " +
            "or comma-separated skill names. Always starts with 'product-marketing-context'."),
        scope: z.enum(["global", "project"]).optional().default("global")
            .describe("'global' installs to ~/.claude/skills/ (any project), 'project' installs to .claude/skills/"),
        confirmed: z.boolean().describe("Must be true to download and write files"),
    }, async ({ skills, scope, confirmed }) => {
        // Resolve skill list
        const categoryMap = {
            cro: "CRO",
            copy: "Copy",
            seo: "SEO",
            paid: "Paid",
            analytics: "Analytics",
            growth: "Growth",
            revenue: "Revenue",
            foundation: "Foundation",
        };
        let toInstall;
        if (skills === "all") {
            toInstall = MARKETING_SKILLS;
        }
        else if (categoryMap[skills.toLowerCase()]) {
            const cat = categoryMap[skills.toLowerCase()];
            toInstall = MARKETING_SKILLS.filter(s => s.category === cat);
            // Always prepend foundation if not in selection
            const foundation = MARKETING_SKILLS.find(s => s.name === "product-marketing-context");
            if (foundation && !toInstall.find(s => s.name === "product-marketing-context")) {
                toInstall = [foundation, ...toInstall];
            }
        }
        else {
            const names = skills.split(",").map(s => s.trim()).filter(Boolean);
            toInstall = names.map(name => {
                const found = MARKETING_SKILLS.find(s => s.name === name);
                return found ?? { name, category: "Custom", description: "Custom skill" };
            });
        }
        const installDir = skillsDir(scope);
        const plan = [
            `Marketing Skills Install Plan`,
            "─".repeat(60),
            `  Skills:  ${toInstall.length} to install`,
            `  Scope:   ${scope}`,
            `  Path:    ${installDir}`,
            "",
            "Skills to install:",
            ...toInstall.map(s => `  • /${s.name}  [${s.category}]`),
            "",
            confirmed ? "Downloading and installing..." : "⚠️  DRY RUN — set confirmed:true to install",
        ];
        if (!confirmed) {
            return { content: [{ type: "text", text: plan.join("\n") }] };
        }
        const results = [...plan, ""];
        let installed = 0;
        let failed = 0;
        // Ensure foundation goes first
        const ordered = [
            ...toInstall.filter(s => s.name === "product-marketing-context"),
            ...toInstall.filter(s => s.name !== "product-marketing-context"),
        ];
        for (const skill of ordered) {
            const r = await installSkill(skill.name, scope);
            if (r.ok) {
                results.push(`  ✅ /${skill.name}`);
                installed++;
            }
            else {
                results.push(`  ❌ /${skill.name} — ${r.message}`);
                failed++;
            }
        }
        results.push("");
        results.push("─".repeat(60));
        results.push(`Installed: ${installed}  Failed: ${failed}`);
        results.push("");
        if (installed > 0) {
            results.push("✅  Skills are ready. Usage in Claude Code:");
            results.push("");
            results.push("  /product-marketing-context   ← run this first to set context");
            results.push("  /copywriting                  write marketing copy");
            results.push("  /seo-audit                    audit site SEO");
            results.push("  /page-cro                     optimize landing pages");
            results.push("  /ab-test-setup                plan A/B tests");
            results.push("  /cold-email                   write outreach emails");
            results.push("  /pricing-strategy             design pricing tiers");
            results.push("  /launch-strategy              plan a product launch");
            results.push("");
            results.push(`Skills installed to: ${installDir}`);
        }
        if (failed > 0) {
            results.push("");
            results.push("⚠️  Some downloads failed — check network connection.");
            results.push("    Retry: marketing_skills_install  skills:all  confirmed:true");
        }
        return { content: [{ type: "text", text: results.join("\n") }] };
    });
    // ── marketing_skills_status ───────────────────────────────────────────────
    server.tool("marketing_skills_status", "Show which marketing skills are installed and where. " +
        "Checks both ~/.claude/skills/ (global) and .claude/skills/ (project). " +
        "Shows install counts per category and lists any missing skills.", {}, async () => {
        const lines = ["Marketing Skills Status", "─".repeat(60), ""];
        const globalDir = GLOBAL_SKILLS_DIR;
        const projectDir = PROJECT_SKILLS_DIR;
        lines.push(`Global  path: ${globalDir}`);
        lines.push(`Project path: ${projectDir}`);
        lines.push("");
        const byCategory = {};
        for (const skill of MARKETING_SKILLS) {
            if (!byCategory[skill.category])
                byCategory[skill.category] = [];
            byCategory[skill.category].push({
                skill,
                global: isInstalled(skill.name, "global"),
                project: isInstalled(skill.name, "project"),
            });
        }
        let totalGlobal = 0;
        let totalProject = 0;
        const catOrder = ["Foundation", "CRO", "Copy", "SEO", "Paid", "Analytics", "Growth", "Revenue"];
        for (const cat of catOrder) {
            const group = byCategory[cat];
            if (!group?.length)
                continue;
            const gCount = group.filter(s => s.global).length;
            const pCount = group.filter(s => s.project).length;
            totalGlobal += gCount;
            totalProject += pCount;
            lines.push(`── ${cat} (${gCount}/${group.length} global  ${pCount}/${group.length} project)`);
            for (const { skill, global: g, project: p } of group) {
                const flags = [g ? "✅ global" : "  ○ global", p ? "✅ project" : "  ○ project"].join("  ");
                lines.push(`  /${skill.name.padEnd(32)} ${flags}`);
            }
            lines.push("");
        }
        lines.push("─".repeat(60));
        lines.push(`Total: ${totalGlobal}/${MARKETING_SKILLS.length} global  ${totalProject}/${MARKETING_SKILLS.length} project`);
        lines.push("");
        const missingGlobal = MARKETING_SKILLS.filter(s => !isInstalled(s.name, "global"));
        if (missingGlobal.length > 0) {
            lines.push(`Install all missing globally:`);
            lines.push(`  marketing_skills_install  skills:all  scope:global  confirmed:true`);
        }
        else {
            lines.push("✅  All 34 skills installed globally.");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
    // ── marketing_skills_context ──────────────────────────────────────────────
    server.tool("marketing_skills_context", "Guide to set up the product-marketing-context foundation skill. " +
        "This is the most important first step — all 34 marketing skills reference this context " +
        "for product positioning, ICP, messaging hierarchy, and tone of voice. " +
        "Run /product-marketing-context in Claude Code after installing, then answer the " +
        "questions to generate .agents/product-marketing-context.md.", {
        site: z.string().optional()
            .describe("Optional: WordPress Studio site name to tailor the context for"),
    }, async ({ site }) => {
        const lines = [
            "Product Marketing Context — Foundation Setup",
            "─".repeat(60),
            "",
            "The product-marketing-context skill is the foundation that all other",
            "34 marketing skills reference for consistent positioning and messaging.",
            "",
            "It generates: .agents/product-marketing-context.md",
            "This file contains:",
            "  • Product positioning and value proposition",
            "  • Ideal Customer Profile (ICP) and audience segments",
            "  • Core differentiators vs competitors",
            "  • Messaging hierarchy (primary, secondary, tertiary)",
            "  • Tone of voice guidelines",
            "  • Key use cases and pain points",
            "",
            "─".repeat(60),
            "Step 1 — Install the foundation skill (if not done yet):",
            "",
            "  marketing_skills_install  skills:product-marketing-context  confirmed:true",
            "",
            "Step 2 — Invoke in Claude Code:",
            "",
            "  /product-marketing-context",
            "",
            "Step 3 — Answer Claude's questions about your product:",
            "  • What does your product do?",
            "  • Who is your ideal customer?",
            "  • What's your primary differentiator?",
            "  • What pain does it solve?",
            "  • What's your tone? (professional / casual / bold / etc.)",
            "",
            "Step 4 — The skill writes .agents/product-marketing-context.md",
            "",
            "Step 5 — All other skills now have your product context automatically:",
            "",
            "  /copywriting     → uses your tone, positioning, ICP",
            "  /page-cro        → knows your value prop and audience",
            "  /seo-audit       → understands your target keywords",
            "  /cold-email      → writes with your voice and ICP pain points",
            "  /pricing-strategy → knows your market and competitors",
            "",
        ];
        if (site) {
            lines.push("─".repeat(60));
            lines.push(`WordPress Site: ${site}`);
            lines.push("Tip: run /product-marketing-context from the site's project folder so");
            lines.push(".agents/product-marketing-context.md is saved next to the site files.");
        }
        lines.push("─".repeat(60));
        lines.push("Source: https://github.com/coreyhaines31/marketingskills");
        return { content: [{ type: "text", text: lines.join("\n") }] };
    });
}
//# sourceMappingURL=marketing.js.map