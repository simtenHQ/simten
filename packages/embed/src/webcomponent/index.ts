/**
 * Web component registration for Turing Incomplete embeds.
 *
 * Registers a custom element:
 *   <circuit-embed>  — interactive circuit viewer
 *
 * Usage:
 *   <link rel="stylesheet" href="https://unpkg.com/@turing-incomplete/embed/dist/styles.css">
 *   <script src="https://unpkg.com/@turing-incomplete/embed/dist/circuit-embed.js"></script>
 *
 *   <circuit-embed code="const Demo = circuit('Demo', { ... })" height="300"></circuit-embed>
 *
 * Light DOM (no Shadow DOM) — ReactFlow requires direct DOM access.
 * Style isolation via class prefix.
 */

import "../styles/embed.css";
import r2wc from "@r2wc/react-to-web-component";
import { WebComponentEmbed, type WebComponentEmbedProps } from "./WebComponentEmbed";

// --- <circuit-embed> ---

const CircuitEmbedWC = r2wc<WebComponentEmbedProps>(WebComponentEmbed, {
  props: {
    code: "string",
    height: "number",
    showControls: "boolean",
    title: "string",
    subtitle: "string",
    description: "string",
    href: "string",
    autoRunSpeed: "number",
    theme: "string",
  },
});

// --- Register ---

if (!customElements.get("circuit-embed")) {
  customElements.define("circuit-embed", CircuitEmbedWC);
}

export { CircuitEmbedWC };
