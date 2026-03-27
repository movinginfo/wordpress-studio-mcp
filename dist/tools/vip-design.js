/**
 * tools/vip-design.ts
 *
 * MCP tools for the Automattic VIP Design System (github.com/Automattic/vip-design-system).
 *
 * The VIP DS is Automattic's own design system — the same token/component system
 * used across VIP, WordPress.com, and Jetpack products. It is built on:
 *   • Theme UI          — theme structure and CSS-in-JS
 *   • Radix UI          — accessible component primitives
 *   • Design tokens     — exported from Figma Studio, stored in tokens/
 *
 * Token layers:
 *   1. Raw palettes     tokens/utilities/colors/colorOutput.json
 *                       10 palettes × ~100 shades (gold, gray, green, blue, pink,
 *                       salmon, orange, yellow, red, parsely-green)
 *
 *   2. Core primitives  tokens/valet-core/valet-core.json
 *                       Responsive/static font sizes (15 steps, clamp formulas),
 *                       spacing scale, border radius, line heights
 *
 *   3. Semantic (light) tokens/valet-core/wpvip-product-core.json
 *                       Semantic color roles (primary, text, bg, border, support…)
 *                       mapped to palette shades + spacing + typography aliases
 *
 *   4. Semantic (dark)  tokens/valet-core/wpvip-product-dark.json
 *                       Dark-mode overrides for semantic colors
 *
 * Tools:
 *   vip_design_tokens       — query the VIP DS palette: colors, typography, spacing, components
 *   vip_design_theme_json   — generate a WordPress theme.json using VIP DS tokens
 *
 * Source: https://github.com/Automattic/vip-design-system
 */
import { z } from "zod";
// ─── Resolved token data ──────────────────────────────────────────────────────
// Key stops extracted from tokens/utilities/colors/colorOutput.json
// and tokens/valet-core/. Referenced by slug, not raw index.
const VIP_COLORS = {
    // Gold — brand/accent — warm amber tones
    gold: {
        "0": "#fcfafa", "10": "#eae3da", "20": "#dfc39e", "30": "#dcb480",
        "40": "#d29137", "50": "#ba7920", "55": "#a66915", "60": "#9a6014",
        "65": "#8c5407", "70": "#7a4909", "80": "#5d3809", "90": "#3f2508",
    },
    // Gray — neutral / text / borders
    gray: {
        "0": "#fafafa", "5": "#f5f5f5", "10": "#e5e5e5", "15": "#d4d4d4",
        "20": "#c5c2c1", "30": "#b3afae", "40": "#968f8d", "50": "#827f7e",
        "60": "#5e5b5a", "70": "#3f3b3a", "80": "#2a2625", "90": "#1a1716",
        "95": "#0f0d0c",
    },
    // Green — success / positive
    green: {
        "0": "#f0faf4", "10": "#c8f0d9", "20": "#7ed4a4", "30": "#4dc679",
        "40": "#1da158", "50": "#01944d", "60": "#008840", "70": "#007934",
        "80": "#006d29", "90": "#004e1b",
    },
    // Blue — info / links / VIP primary
    blue: {
        "0": "#f0fbfc", "10": "#c5eff4", "20": "#54c0cd", "30": "#19a8b8",
        "40": "#009bad", "50": "#0190a0", "60": "#008292", "70": "#007586",
        "80": "#006979", "90": "#004e5a",
    },
    // Red — danger / error / destructive
    red: {
        "0": "#fff5f4", "10": "#ffd4cf", "20": "#ff8872", "30": "#ff5f4d",
        "40": "#e74135", "50": "#d3372b", "60": "#bf2a23", "70": "#9a1a19",
        "80": "#840b10", "90": "#5e0000",
    },
    // Yellow — warning
    yellow: {
        "0": "#fffbf0", "10": "#fce7a0", "20": "#f09d01", "30": "#e29101",
        "40": "#c67a00", "50": "#b86e01", "60": "#985600", "70": "#7b3f01",
        "80": "#592800", "90": "#491d00",
    },
    // Orange — highlight / call-to-action variant
    orange: {
        "0": "#fff7f2", "10": "#ffd4b3", "20": "#ff8b40", "30": "#f46e15",
        "40": "#d75001", "50": "#b43c00", "60": "#942601", "70": "#811701",
        "80": "#6a0d01", "90": "#5f0000",
    },
    // Pink — decorative / tag colors
    pink: {
        "0": "#fef5f5", "10": "#f5d5d5", "20": "#e29e9d", "30": "#ca8588",
        "40": "#a35f6a", "50": "#95535d", "60": "#7c394a", "70": "#633a0a",
        "80": "#522e03",
    },
    // Salmon — warm error / highlight variant
    salmon: {
        "0": "#fff5f0", "10": "#ffd4b8", "20": "#f9945e", "30": "#e07b4d",
        "40": "#b55638", "50": "#a74930", "60": "#893f26", "70": "#7c1e1e",
        "80": "#5e0010",
    },
    // Parsely Green — secondary brand / tag accent
    "parsely-green": {
        "0": "#f3fbee", "10": "#ceebbd", "20": "#87be6b", "30": "#6fa654",
        "40": "#488131", "50": "#3b7425", "60": "#165c0d", "70": "#004e00",
        "80": "#001b00",
    },
};
// ── Semantic color roles (light mode) ─────────────────────────────────────────
// Derived from wpvip-product-core.json
const VIP_SEMANTIC_LIGHT = {
    // Primary brand
    "brand": VIP_COLORS.gold["50"],
    "brand-hover": VIP_COLORS.gold["60"],
    "brand-muted": VIP_COLORS.gold["20"],
    // Text
    "text-primary": VIP_COLORS.gray["90"],
    "text-secondary": VIP_COLORS.gray["70"],
    "text-muted": VIP_COLORS.gray["60"],
    "text-disabled": VIP_COLORS.gray["40"],
    "text-inverse": VIP_COLORS.gray["0"],
    "text-on-brand": VIP_COLORS.gray["0"],
    // Backgrounds
    "bg-primary": VIP_COLORS.gray["0"],
    "bg-secondary": VIP_COLORS.gray["5"],
    "bg-tertiary": VIP_COLORS.gray["10"],
    "bg-overlay": "rgba(0,0,0,0.5)",
    // Borders
    "border-default": VIP_COLORS.gray["20"],
    "border-strong": VIP_COLORS.gray["40"],
    "border-accent": VIP_COLORS.gold["50"],
    // Interactive
    "focus-ring": VIP_COLORS.blue["40"],
    "link": VIP_COLORS.blue["50"],
    "link-hover": VIP_COLORS.blue["60"],
    // Support / status
    "success": VIP_COLORS.green["50"],
    "success-bg": VIP_COLORS.green["0"],
    "success-border": VIP_COLORS.green["30"],
    "warning": VIP_COLORS.yellow["50"],
    "warning-bg": VIP_COLORS.yellow["0"],
    "warning-border": VIP_COLORS.yellow["30"],
    "danger": VIP_COLORS.red["50"],
    "danger-bg": VIP_COLORS.red["0"],
    "danger-border": VIP_COLORS.red["30"],
    "info": VIP_COLORS.blue["40"],
    "info-bg": VIP_COLORS.blue["0"],
    "info-border": VIP_COLORS.blue["20"],
    // Buttons
    "btn-primary-bg": VIP_COLORS.gold["50"],
    "btn-primary-text": VIP_COLORS.gray["0"],
    "btn-primary-hover": VIP_COLORS.gold["60"],
    "btn-secondary-bg": VIP_COLORS.gray["0"],
    "btn-secondary-text": VIP_COLORS.gray["90"],
    "btn-secondary-border": VIP_COLORS.gray["20"],
    "btn-danger-bg": VIP_COLORS.red["50"],
    "btn-danger-text": VIP_COLORS.gray["0"],
};
// ── Semantic color roles (dark mode) ─────────────────────────────────────────
const VIP_SEMANTIC_DARK = {
    "brand": VIP_COLORS.gold["40"],
    "brand-hover": VIP_COLORS.gold["30"],
    "text-primary": VIP_COLORS.gray["10"],
    "text-secondary": VIP_COLORS.gray["30"],
    "text-muted": VIP_COLORS.gray["50"],
    "text-disabled": VIP_COLORS.gray["60"],
    "text-inverse": VIP_COLORS.gray["95"],
    "bg-primary": VIP_COLORS.gray["95"],
    "bg-secondary": VIP_COLORS.gray["90"],
    "bg-tertiary": VIP_COLORS.gray["80"],
    "border-default": VIP_COLORS.gray["60"],
    "border-strong": VIP_COLORS.gray["50"],
    "border-accent": VIP_COLORS.gold["50"],
    "focus-ring": VIP_COLORS.blue["30"],
    "link": VIP_COLORS.blue["30"],
    "link-hover": VIP_COLORS.blue["20"],
    "success": VIP_COLORS.green["30"],
    "success-bg": VIP_COLORS.green["80"],
    "danger": VIP_COLORS.red["30"],
    "danger-bg": VIP_COLORS.red["80"],
    "warning": VIP_COLORS.yellow["30"],
    "warning-bg": VIP_COLORS.yellow["80"],
    "info": VIP_COLORS.blue["20"],
    "info-bg": VIP_COLORS.blue["80"],
};
// ── Typography scale ──────────────────────────────────────────────────────────
// Responsive clamp() values from tokens/valet-core/valet-core.json
// Static pixel values: 1=12px, 2=14px, 3=16px, 4=18px, 5=20px
const VIP_FONT_SIZES = [
    { step: 1, slug: "xs", label: "XS", static: "0.75rem", responsive: "clamp(0.51rem, calc(0.83rem + -0.31vw), 0.77rem)" },
    { step: 2, slug: "sm", label: "Small", static: "0.875rem", responsive: "clamp(0.62rem, calc(0.87rem + -0.25vw), 0.82rem)" },
    { step: 3, slug: "body-s", label: "Body S", static: "0.875rem", responsive: "clamp(0.74rem, calc(0.91rem + -0.17vw), 0.88rem)" },
    { step: 4, slug: "body", label: "Body", static: "1rem", responsive: "clamp(0.89rem, calc(0.95rem + -0.06vw), 0.94rem)" },
    { step: 5, slug: "base", label: "Base (1rem)", static: "1rem", responsive: "clamp(1.00rem, calc(0.98rem + 0.08vw), 1.06rem)" },
    { step: 6, slug: "md", label: "Medium", static: "1.125rem", responsive: "clamp(1.07rem, calc(1.02rem + 0.25vw), 1.28rem)" },
    { step: 7, slug: "lg", label: "Large", static: "1.25rem", responsive: "clamp(1.14rem, calc(1.04rem + 0.47vw), 1.53rem)" },
    { step: 8, slug: "xl", label: "XL", static: "1.5rem", responsive: "clamp(1.22rem, calc(1.07rem + 0.75vw), 1.84rem)" },
    { step: 9, slug: "2xl", label: "2XL", static: "1.875rem", responsive: "clamp(1.30rem, calc(1.08rem + 1.09vw), 2.20rem)" },
    { step: 10, slug: "3xl", label: "3XL", static: "2.25rem", responsive: "clamp(1.38rem, calc(1.08rem + 1.52vw), 2.64rem)" },
    { step: 11, slug: "4xl", label: "4XL", static: "3rem", responsive: "clamp(1.48rem, calc(1.07rem + 2.04vw), 3.17rem)" },
    { step: 12, slug: "5xl", label: "5XL (display)", static: "3.75rem", responsive: "clamp(1.58rem, calc(1.05rem + 2.66vw), 3.80rem)" },
];
// ── Spacing scale ─────────────────────────────────────────────────────────────
// Static values (rem). Base: 1rem = 16px
const VIP_SPACING = [
    { step: 0, slug: "0", value: "0", px: "0px" },
    { step: 1, slug: "1", value: "0.125rem", px: "2px" },
    { step: 2, slug: "2", value: "0.25rem", px: "4px" },
    { step: 3, slug: "3", value: "0.5rem", px: "8px" },
    { step: 4, slug: "4", value: "0.75rem", px: "12px" },
    { step: 5, slug: "5", value: "1rem", px: "16px" },
    { step: 6, slug: "6", value: "1.5rem", px: "24px" },
    { step: 7, slug: "7", value: "2rem", px: "32px" },
    { step: 8, slug: "8", value: "2.5rem", px: "40px" },
    { step: 9, slug: "9", value: "3rem", px: "48px" },
    { step: 10, slug: "10", value: "4rem", px: "64px" },
];
// ── Border radius ─────────────────────────────────────────────────────────────
const VIP_BORDER_RADIUS = [
    { slug: "none", value: "0" },
    { slug: "sm", value: "0.125rem" },
    { slug: "base", value: "0.25rem" },
    { slug: "md", value: "0.375rem" },
    { slug: "lg", value: "0.5rem" },
    { slug: "xl", value: "0.75rem" },
    { slug: "2xl", value: "1rem" },
    { slug: "full", value: "9999px" },
];
// ── Components inventory ──────────────────────────────────────────────────────
const VIP_COMPONENTS = {
    "Layout": ["Box", "Flex", "Grid", "Card", "Toolbar", "Hr", "Accordion", "Page", "Footer"],
    "Navigation": ["Nav", "NavItem", "Breadcrumbs", "Pagination", "MobileMenu", "MobileMenuTrigger", "MobileMenuWrapper", "Tabs", "TabsList", "TabsTrigger", "TabsContent"],
    "Typography": ["Text", "Heading", "Code", "ScreenReaderText", "Link", "LinkExternal"],
    "Forms": ["Form", "NewForm", "Input", "Label", "Textarea", "Checkbox", "Toggle", "ToggleRow", "Radio", "RadioBoxGroup", "RadioGroupChip", "Validation"],
    "Buttons": ["Button", "ButtonSubmit", "ButtonVariant"],
    "Dialogs": ["Dialog", "DialogButton", "DialogDivider", "DialogMenu", "DialogMenuItem", "DialogTrigger", "DialogContent", "ConfirmationDialog", "NewConfirmationDialog", "NewDialog", "Drawer"],
    "Overlays": ["Dropdown", "Tooltip", "NewTooltip", "FilterDropdown"],
    "Feedback": ["Notice", "Snackbar", "Progress", "Spinner", "Skeleton"],
    "Data": ["Table", "TableRow", "TableCell", "DescriptionList", "OptionRow"],
    "Identity": ["Avatar", "Badge"],
    "Complex": ["Wizard", "WizardStep"],
};
// ── Shadows ───────────────────────────────────────────────────────────────────
const VIP_SHADOWS = {
    low: "0px 1px 2px rgba(0,0,0,0.08), 0px 0px 1px rgba(0,0,0,0.06)",
    medium: "0px 4px 8px rgba(0,0,0,0.1),  0px 0px 2px rgba(0,0,0,0.06)",
    high: "0px 8px 24px rgba(0,0,0,0.12), 0px 2px 4px rgba(0,0,0,0.08)",
};
// ─── Tool registration ────────────────────────────────────────────────────────
export function registerVipDesignTools(server) {
    // ── vip_design_tokens ─────────────────────────────────────────────────────
    server.tool("vip_design_tokens", "Query the Automattic VIP Design System token library (github.com/Automattic/vip-design-system). " +
        "Returns resolved design tokens: color palettes, semantic colors, typography scale, " +
        "spacing scale, border radius, shadows, and component inventory. " +
        "Use these tokens as the design foundation for WordPress sites, admin UIs, and block themes " +
        "to align with Automattic's own design language.", {
        section: z.enum([
            "all", "palettes", "semantic", "semantic-dark",
            "typography", "spacing", "radius", "shadows", "components"
        ]).default("all").describe("palettes=raw hex palette | semantic=light roles | semantic-dark=dark roles | " +
            "typography=font sizes | spacing=space scale | radius=border radius | " +
            "shadows=elevation | components=component list | all=everything"),
        palette: z.enum([
            "all", "gold", "gray", "green", "blue", "red",
            "yellow", "orange", "pink", "salmon", "parsely-green"
        ]).optional().default("all").describe("Filter to a specific color palette (only applies when section includes palettes)"),
    }, async ({ section, palette }) => {
        const out = {};
        const showAll = section === "all";
        if (showAll || section === "palettes") {
            out.palettes = palette === "all"
                ? VIP_COLORS
                : { [palette]: VIP_COLORS[palette] };
        }
        if (showAll || section === "semantic") {
            out.semantic_light = VIP_SEMANTIC_LIGHT;
        }
        if (showAll || section === "semantic-dark") {
            out.semantic_dark = VIP_SEMANTIC_DARK;
        }
        if (showAll || section === "typography") {
            out.typography = {
                description: "Responsive clamp() font sizes from VIP DS valet-core tokens. Use 'responsive' for block themes, 'static' for UI components.",
                font_families: {
                    body: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
                    heading: "inherit",
                    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                    serif: "'Recoleta', Georgia, 'Times New Roman', serif",
                },
                font_sizes: VIP_FONT_SIZES,
                font_weights: { regular: "400", medium: "500", bold: "700" },
                line_heights: { tight: "1.2", snug: "1.375", normal: "1.5", relaxed: "1.625" },
            };
        }
        if (showAll || section === "spacing") {
            out.spacing = {
                description: "Base 16px (1rem). Steps 0-10.",
                scale: VIP_SPACING,
            };
        }
        if (showAll || section === "radius") {
            out.border_radius = VIP_BORDER_RADIUS;
        }
        if (showAll || section === "shadows") {
            out.shadows = VIP_SHADOWS;
        }
        if (showAll || section === "components") {
            out.components = {
                description: "React components from @automattic/vip-design-system (Theme UI + Radix UI)",
                total: Object.values(VIP_COMPONENTS).flat().length,
                by_category: VIP_COMPONENTS,
            };
        }
        const header = [
            "VIP Design System — Automattic",
            "Source: https://github.com/Automattic/vip-design-system",
            "Built on: Theme UI + Radix UI Primitives",
            `Section: ${section}`,
            "",
        ].join("\n");
        return { content: [{ type: "text", text: header + JSON.stringify(out, null, 2) }] };
    });
    // ── vip_design_theme_json ─────────────────────────────────────────────────
    server.tool("vip_design_theme_json", "Generate a WordPress theme.json using Automattic VIP Design System tokens. " +
        "Maps VIP DS palettes and typography scale to the WordPress Full Site Editing format. " +
        "Output can be written directly to an active theme via fs_write_file, or included in a blueprint. " +
        "Produces a production-ready theme.json aligned with Automattic's own design language.", {
        style: z.enum(["default", "minimal", "full", "dark"]).default("default").describe("default=brand palette + responsive type | minimal=gray/neutral only | " +
            "full=all 10 palettes + complete settings | dark=dark-mode semantic theme"),
        palette_names: z.array(z.enum(["gold", "gray", "green", "blue", "red", "yellow", "orange", "pink", "salmon", "parsely-green"])).optional().describe("Override which palettes to include (default depends on style)"),
        responsive_type: z.boolean().optional().default(true).describe("Use responsive clamp() font sizes (true) or static rem values (false)"),
        include_spacing: z.boolean().optional().default(true),
        include_shadows: z.boolean().optional().default(true),
    }, async ({ style, palette_names, responsive_type, include_spacing, include_shadows }) => {
        // ── choose palettes ─────────────────────────────────────────────────────
        const defaultPalettes = {
            default: ["gold", "gray", "blue", "green", "red"],
            minimal: ["gray"],
            full: ["gold", "gray", "green", "blue", "red", "yellow", "orange", "pink", "salmon", "parsely-green"],
            dark: ["gold", "gray", "blue", "green", "red"],
        };
        const chosenPalettes = (palette_names ?? defaultPalettes[style]);
        const colorPalette = [];
        // Semantic roles first (always included)
        const semanticColors = style === "dark" ? VIP_SEMANTIC_DARK : VIP_SEMANTIC_LIGHT;
        const semanticMap = {
            "primary": semanticColors["brand"],
            "secondary": semanticColors["bg-secondary"],
            "foreground": semanticColors["text-primary"],
            "background": style === "dark" ? VIP_COLORS.gray["95"] : VIP_COLORS.gray["0"],
            "muted": semanticColors["text-muted"],
            "border": semanticColors["border-default"],
            "success": semanticColors["success"],
            "warning": semanticColors["warning"],
            "danger": semanticColors["danger"],
            "info": semanticColors["info"],
            "link": semanticColors["link"],
        };
        for (const [slug, color] of Object.entries(semanticMap)) {
            colorPalette.push({
                slug,
                color,
                name: slug.charAt(0).toUpperCase() + slug.slice(1),
            });
        }
        // Raw palette stops
        for (const paletteName of chosenPalettes) {
            const pal = VIP_COLORS[paletteName];
            for (const [stop, hex] of Object.entries(pal)) {
                colorPalette.push({
                    slug: `${paletteName}-${stop}`,
                    color: hex,
                    name: `${paletteName.charAt(0).toUpperCase() + paletteName.slice(1)} ${stop}`,
                });
            }
        }
        // ── build typography.fontSizes array ─────────────────────────────────────
        const fontSizes = VIP_FONT_SIZES.map(f => ({
            slug: f.slug,
            size: responsive_type ? f.responsive : f.static,
            name: f.label,
        }));
        // ── build spacing.spacingSizes ────────────────────────────────────────────
        const spacingSizes = VIP_SPACING.map(s => ({
            slug: s.slug,
            size: s.value,
            name: `Space ${s.step} (${s.px})`,
        }));
        // ── shadows ───────────────────────────────────────────────────────────────
        const customTemplates = include_shadows ? {
            "vip/shadow-low": { shadow: VIP_SHADOWS.low },
            "vip/shadow-medium": { shadow: VIP_SHADOWS.medium },
            "vip/shadow-high": { shadow: VIP_SHADOWS.high },
        } : undefined;
        // ── assemble theme.json ───────────────────────────────────────────────────
        const themeJson = {
            "$schema": "https://schemas.wp.org/trunk/theme.json",
            "version": 3,
            "settings": {
                "color": {
                    "palette": colorPalette,
                    "background": true,
                    "text": true,
                    "link": true,
                    "gradients": [
                        { "slug": "brand-fade", "gradient": `linear-gradient(135deg, ${VIP_COLORS.gold["20"]} 0%, ${VIP_COLORS.gold["50"]} 100%)`, "name": "Brand Fade" },
                        { "slug": "subtle-gray", "gradient": `linear-gradient(180deg, ${VIP_COLORS.gray["0"]} 0%, ${VIP_COLORS.gray["5"]} 100%)`, "name": "Subtle Gray" },
                    ],
                },
                "typography": {
                    "fontSizes": fontSizes,
                    "fontFamilies": [
                        { "slug": "body", "name": "Body (System UI)", "fontFamily": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                        { "slug": "heading", "name": "Heading (Inherit)", "fontFamily": "inherit" },
                        { "slug": "mono", "name": "Monospace", "fontFamily": "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace" },
                        { "slug": "serif", "name": "Serif (Recoleta)", "fontFamily": "'Recoleta', Georgia, 'Times New Roman', serif" },
                    ],
                    "dropCap": false,
                    "fluid": responsive_type,
                },
                ...(include_spacing ? {
                    "spacing": {
                        "spacingSizes": spacingSizes,
                        "padding": true,
                        "margin": true,
                        "blockGap": true,
                        "units": ["px", "em", "rem", "vh", "vw", "%"],
                    },
                } : {}),
                "border": {
                    "color": true,
                    "radius": true,
                    "style": true,
                    "width": true,
                },
                "shadow": {
                    "presets": include_shadows ? [
                        { "slug": "low", "name": "Shadow Low", "shadow": VIP_SHADOWS.low },
                        { "slug": "medium", "name": "Shadow Medium", "shadow": VIP_SHADOWS.medium },
                        { "slug": "high", "name": "Shadow High", "shadow": VIP_SHADOWS.high },
                    ] : [],
                },
                "layout": {
                    "contentSize": "800px",
                    "wideSize": "1200px",
                },
                "blocks": {},
                "appearanceTools": true,
            },
            "styles": {
                "color": {
                    "background": style === "dark" ? VIP_COLORS.gray["95"] : VIP_COLORS.gray["0"],
                    "text": style === "dark" ? VIP_COLORS.gray["10"] : VIP_COLORS.gray["90"],
                },
                "typography": {
                    "fontFamily": "var(--wp--preset--font-family--body)",
                    "fontSize": "var(--wp--preset--font-size--base)",
                    "lineHeight": "1.5",
                },
                "spacing": include_spacing ? {
                    "blockGap": "var(--wp--preset--spacing--6)",
                } : {},
                "elements": {
                    "heading": {
                        "typography": { "fontFamily": "var(--wp--preset--font-family--heading)", "fontWeight": "700", "lineHeight": "1.2" },
                        "color": { "text": "var(--wp--preset--color--foreground)" },
                    },
                    "link": {
                        "color": { "text": "var(--wp--preset--color--link)" },
                        ":hover": { "color": { "text": semanticColors["link-hover"] } },
                    },
                    "button": {
                        "color": { "background": "var(--wp--preset--color--primary)", "text": "#ffffff" },
                        "typography": { "fontWeight": "600" },
                        "spacing": { "padding": "0.625rem 1.25rem" },
                        "border": { "radius": "0.25rem" },
                    },
                },
                "blocks": {
                    "core/code": {
                        "typography": { "fontFamily": "var(--wp--preset--font-family--mono)", "fontSize": "var(--wp--preset--font-size--sm)" },
                        "color": { "background": VIP_COLORS.gray["5"], "text": VIP_COLORS.gray["90"] },
                        "spacing": { "padding": "1rem" },
                        "border": { "radius": "0.25rem" },
                    },
                    "core/quote": {
                        "border": { "left": { "color": "var(--wp--preset--color--primary)", "style": "solid", "width": "4px" } },
                        "spacing": { "padding": { "left": "1.5rem" } },
                        "color": { "text": "var(--wp--preset--color--muted)" },
                    },
                    "core/table": {
                        "border": { "style": "solid", "width": "1px", "color": "var(--wp--preset--color--border)" },
                        "color": { "background": "var(--wp--preset--color--background)" },
                    },
                },
                ...(customTemplates ? { "customTemplates": customTemplates } : {}),
            },
        };
        const header = [
            `VIP Design System → WordPress theme.json`,
            `Style: ${style} | Responsive type: ${responsive_type} | Palettes: ${chosenPalettes.join(", ")}`,
            `Source: https://github.com/Automattic/vip-design-system`,
            "",
            "Tip: Write this to your theme with fs_write_file:",
            "  path: {sitePath}/wp-content/themes/{theme}/theme.json",
            "",
        ].join("\n");
        return {
            content: [{
                    type: "text",
                    text: header + JSON.stringify(themeJson, null, 2),
                }],
        };
    });
}
//# sourceMappingURL=vip-design.js.map