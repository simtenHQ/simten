/**
 * Web component registration for Turing Incomplete embeds.
 *
 * Registers two custom elements:
 *   <circuit-embed>  — read-only interactive circuit viewer
 *   <circuit-editor> — editable playground with code panel
 *
 * Usage:
 *   <link rel="stylesheet" href="https://unpkg.com/@turing-incomplete/embed/dist/styles.css">
 *   <script src="https://unpkg.com/@turing-incomplete/embed/dist/circuit-embed.js"></script>
 *
 *   <circuit-embed dsl="circuit HalfAdder { ... }" height="300"></circuit-embed>
 *   <circuit-editor initial-dsl="..." height="500"></circuit-editor>
 *
 * Light DOM (no Shadow DOM) — ReactFlow requires direct DOM access.
 * Style isolation via  class prefix.
 */

import "../styles/embed.css";
import r2wc from "@r2wc/react-to-web-component";
import { CircuitEmbed, type CircuitEmbedProps } from "../CircuitEmbed";
import { CircuitEditor, type CircuitEditorProps } from "../editor/CircuitEditor";

// --- <circuit-embed> ---

const CircuitEmbedWC = r2wc<CircuitEmbedProps>(CircuitEmbed, {
  props: {
    dsl: "string",
    height: "number",
    showControls: "boolean",
    showCode: "boolean",
    displayDsl: "string",
    autoRunSpeed: "number",
    title: "string",
    description: "string",
    autoHarness: "boolean",
    theme: "string",
  },
});

// --- <circuit-editor> ---

const CircuitEditorWC = r2wc<CircuitEditorProps>(CircuitEditor, {
  props: {
    initialDsl: "string",
    height: "number",
    title: "string",
    description: "string",
    theme: "string",
  },
});

// --- Register ---

if (!customElements.get("circuit-embed")) {
  customElements.define("circuit-embed", CircuitEmbedWC);
}

if (!customElements.get("circuit-editor")) {
  customElements.define("circuit-editor", CircuitEditorWC);
}

export { CircuitEmbedWC, CircuitEditorWC };
