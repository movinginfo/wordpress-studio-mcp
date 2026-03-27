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
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerVipDesignTools(server: McpServer): void;
//# sourceMappingURL=vip-design.d.ts.map