#!/usr/bin/env node
/**
 * Binary to DSL ROM Converter
 *
 * Converts a raw binary file to DSL ROM initialization format.
 * The binary is assumed to be loaded at $C000 (ROM start address).
 *
 * Usage: node bin2dsl.js program.bin > program.rom.dsl
 *
 * Output format:
 *   node rom: ROM(data={
 *     0xC000: 0xNN,
 *     0xC001: 0xNN,
 *     ...
 *   })
 */

const fs = require('fs');

if (process.argv.length < 3) {
    console.error('Usage: node bin2dsl.js program.bin');
    console.error('');
    console.error('Converts binary file to DSL ROM format.');
    console.error('Output is written to stdout.');
    process.exit(1);
}

const filename = process.argv[2];
const bin = fs.readFileSync(filename);

// ROM base address
const ROM_BASE = 0xC000;

console.log(`// ROM data generated from ${filename}`);
console.log(`// Size: ${bin.length} bytes`);
console.log('node rom: ROM(data={');

let nonZeroCount = 0;
for (let i = 0; i < bin.length; i++) {
    if (bin[i] !== 0) {
        const addr = ROM_BASE + i;
        const value = bin[i];
        console.log(`  0x${addr.toString(16).toUpperCase()}: 0x${value.toString(16).toUpperCase().padStart(2, '0')},`);
        nonZeroCount++;
    }
}

console.log('})');
console.log(`// Non-zero bytes: ${nonZeroCount}`);
