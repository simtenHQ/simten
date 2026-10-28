/**
 * Verilog export for the session host, in a module of its own so the host can
 * load it on the first `export` request. The exporter and its eval translator
 * (with a JavaScript parser) are about a third of the worker otherwise, and
 * most pages never export.
 */

export { exportVerilogFromIR } from '@simten/core/internal';
