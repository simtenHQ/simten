#!/usr/bin/env node
/**
 * Patch ROM Data into cpu6502-system.dsl
 *
 * Reads a compiled binary and updates the ROM data section in the system DSL file.
 * This enables the workflow: edit C code -> compile -> run in simulator
 *
 * Usage: node patch-rom.js program.bin [target.dsl]
 *
 * If target.dsl is not specified, patches ../cpu6502-system.dsl
 */

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
    console.error('Usage: node patch-rom.js program.bin [target.dsl]');
    console.error('');
    console.error('Patches ROM data from binary into the system DSL file.');
    process.exit(1);
}

const binFile = process.argv[2];
const targetFile = process.argv[3] || path.join(__dirname, '..', 'cpu6502-system.dsl');

// Read binary file
const bin = fs.readFileSync(binFile);
const ROM_BASE = 0xC000;

// Generate ROM data entries
const romEntries = [];
for (let i = 0; i < bin.length; i++) {
    if (bin[i] !== 0) {
        const addr = ROM_BASE + i;
        romEntries.push(`      0x${addr.toString(16).toUpperCase()}: 0x${bin[i].toString(16).toUpperCase().padStart(2, '0')},`);
    }
}

// Build the new ROM data block
const programName = path.basename(binFile, '.bin');
const romDataBlock = `    // ROM with ${programName} program
    // Auto-generated from cc65/${programName}.bin
    node rom: ROM(data={
      // Reset vector points to $C000
      0xFFFD: 0xC0,

      // Program data (${romEntries.length} non-zero bytes)
${romEntries.join('\n')}
    })`;

// Read target DSL file
let dsl = fs.readFileSync(targetFile, 'utf-8');

// Find and replace the ROM data section
// Look for the ROM data block within ROM16K circuit
// Pattern: from "// ROM with" through the ROM data closing "})"
const startMarker = '    // ROM with';
const startIdx = dsl.indexOf(startMarker);

if (startIdx === -1) {
    console.error('Error: Could not find ROM data section in', targetFile);
    console.error('Expected marker: "// ROM with"');
    process.exit(1);
}

// Find the matching closing })" for the ROM(data={...})
// We need to count braces to find the right one
let braceCount = 0;
let inRomData = false;
let endIdx = startIdx;

for (let i = startIdx; i < dsl.length; i++) {
    if (dsl.substring(i, i + 11) === 'ROM(data={') {
        inRomData = true;
        braceCount = 1;
        i += 10; // Skip past "ROM(data={"
        continue;
    }
    if (inRomData) {
        if (dsl[i] === '{') braceCount++;
        if (dsl[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                // Found the closing }, now find the )
                endIdx = i + 1;
                if (dsl[endIdx] === ')') endIdx++;
                break;
            }
        }
    }
}

if (endIdx <= startIdx) {
    console.error('Error: Could not find end of ROM data section');
    process.exit(1);
}

// Replace the ROM data section
dsl = dsl.substring(0, startIdx) + romDataBlock + dsl.substring(endIdx);

// Write updated file
fs.writeFileSync(targetFile, dsl);

console.log(`Patched ${targetFile} with ROM data from ${binFile}`);
console.log(`  ${romEntries.length} non-zero bytes`);
