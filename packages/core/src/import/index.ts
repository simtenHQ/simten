/**
 * Verilog import (`@simten/core/import`)
 *
 * Translate a yosys JSON netlist into simten Circuit IR that simulates with the
 * existing engine. See import-netlist.ts for scope and the toolchain command.
 */

export { type ImportResult, importNetlist, type YosysNetlist } from './import-netlist.js';
export { type BitDriver, type Segment, segmentBits, type YosysBit } from './net-map.js';
