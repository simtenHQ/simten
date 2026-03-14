#!/usr/bin/env node
/**
 * Generate a raw Ethernet frame binary for testing.
 * Usage: node gen-frame.js [output.bin]
 *
 * Generates a minimum 64-byte IPv4 frame:
 *   DST: FF:FF:FF:FF:FF:FF (broadcast)
 *   SRC: DE:AD:BE:EF:CA:FE
 *   EtherType: 0x0800 (IPv4)
 *   Payload: 46 bytes of 0x42
 *   FCS: 4-byte CRC-32 (auto-computed)
 */

const fs = require('fs');

// CRC-32 table (reflected, polynomial 0xEDB88320)
const TABLE = new Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? ((c >>> 1) ^ 0xEDB88320) >>> 0 : (c >>> 1) >>> 0;
  }
  TABLE[i] = c >>> 0;
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (const b of data) {
    crc = (TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8)) >>> 0;
  }
  return (~crc) >>> 0;
}

// Build frame
const dst = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]; // broadcast
const src = [0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE];
const ethertype = [0x08, 0x00]; // IPv4
const payload = new Array(46).fill(0x42);

const frame = [...dst, ...src, ...ethertype, ...payload];
const fcs = crc32(frame);
frame.push(fcs & 0xFF, (fcs >> 8) & 0xFF, (fcs >> 16) & 0xFF, (fcs >> 24) & 0xFF);

const outFile = process.argv[2] || 'broadcast-ipv4.bin';
fs.writeFileSync(outFile, Buffer.from(frame));
console.log(`Wrote ${frame.length}-byte frame to ${outFile}`);
console.log(`  DST: FF:FF:FF:FF:FF:FF (broadcast)`);
console.log(`  SRC: DE:AD:BE:EF:CA:FE`);
console.log(`  EtherType: 0x0800 (IPv4)`);
console.log(`  Payload: 46 bytes`);
console.log(`  FCS: 0x${fcs.toString(16).padStart(8, '0')}`);
