#!/usr/bin/env node
/**
 * Update ROM Data in cpu6502-system.dsl
 *
 * Replaces the ROM data section with compiled program data.
 * Uses clear markers to find the replacement region.
 *
 * Usage: node update-rom.js program.bin
 */

const fs = require('fs');
const path = require('path');

const ROM_BASE = 0xC000;
const START_MARKER = '    // ROM_DATA_START';
const END_MARKER = '    // ROM_DATA_END';

if (process.argv.length < 3) {
    console.error('Usage: node update-rom.js program.bin');
    process.exit(1);
}

const binFile = process.argv[2];
const targetFile = path.join(__dirname, '..', 'cpu6502-system.dsl');
const programName = path.basename(binFile, '.bin');

// Read binary
const bin = fs.readFileSync(binFile);

// Generate ROM data entries
const entries = [];
for (let i = 0; i < bin.length; i++) {
    if (bin[i] !== 0) {
        const addr = ROM_BASE + i;
        entries.push(`      0x${addr.toString(16).toUpperCase()}: 0x${bin[i].toString(16).toUpperCase().padStart(2, '0')},`);
    }
}

// Build replacement block
const romBlock = `    // ROM_DATA_START - Auto-generated, do not edit manually
    // Program: ${programName}
    // Generated: ${new Date().toISOString()}
    node rom: ROM(data={
${entries.join('\n')}
    })
    // ROM_DATA_END`;

// Read target file
let dsl = fs.readFileSync(targetFile, 'utf-8');

// Check for markers
if (!dsl.includes(START_MARKER) || !dsl.includes(END_MARKER)) {
    console.error('Error: ROM data markers not found in', targetFile);
    console.error('Expected markers:', START_MARKER, 'and', END_MARKER);
    console.error('');
    console.error('Add these markers around the ROM data in ROM16K circuit:');
    console.error('    // ROM_DATA_START');
    console.error('    node rom: ROM(data={...})');
    console.error('    // ROM_DATA_END');
    process.exit(1);
}

// Replace between markers
const startIdx = dsl.indexOf(START_MARKER);
const endIdx = dsl.indexOf(END_MARKER) + END_MARKER.length;
dsl = dsl.substring(0, startIdx) + romBlock + dsl.substring(endIdx);

// Write back
fs.writeFileSync(targetFile, dsl);
console.log(`Updated ${targetFile}`);
console.log(`  Program: ${programName}`);
console.log(`  ROM entries: ${entries.length}`);
