#!/usr/bin/env node
/**
 * Convert chained component() syntax to object syntax in source files.
 * Run: node scripts/chained-to-object.js apps/tanstack/src/features/splash/circuits.ts
 */

const fs = require('fs');

function convertChainedToObject(source) {
  // Match: component('Name')\n  .in(...)\n  .out(...)\n  ... .build()
  // This regex captures everything from component('...') to .build()
  return source.replace(
    /component\('([^']+)'\)\s*\n((?:\s+\.(?:in|out|node|connect|eval|state|onTick|meta|impl|build)\([^]*?))\s*\.build\(\)/g,
    (match, name, chainedBody) => {
      return convertOneComponent(name, chainedBody);
    }
  );
}

function convertOneComponent(name, body) {
  const ins = [];
  const outs = [];
  const nodes = [];
  const nodeArgs = [];
  let connectStr = null;
  let evalStr = null;
  let stateStr = null;
  let onTickStr = null;
  let metaStr = null;

  // Parse each .method() call
  // Split by lines and process
  const lines = body.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // .in('name', type)
    const inMatch = line.match(/^\.in\('([^']+)',\s*(.+)\)$/);
    if (inMatch) {
      ins.push(`${inMatch[1]}: ${inMatch[2]}`);
      i++;
      continue;
    }

    // .out('name', type)
    const outMatch = line.match(/^\.out\('([^']+)',\s*(.+)\)$/);
    if (outMatch) {
      outs.push(`${outMatch[1]}: ${outMatch[2]}`);
      i++;
      continue;
    }

    // .node('name', Type) or .node('name', Type, { args })
    const nodeMatch = line.match(/^\.node\('([^']+)',\s*(\w+)(?:,\s*(\{[^}]+\}))?\)$/);
    if (nodeMatch) {
      nodes.push(`${nodeMatch[1]}: ${nodeMatch[2]}`);
      if (nodeMatch[3]) {
        nodeArgs.push(`${nodeMatch[1]}: ${nodeMatch[3]}`);
      }
      i++;
      continue;
    }

    // .connect(... multi-line until matching ])
    if (line.startsWith('.connect(')) {
      let depth = 0;
      let connectLines = [];
      for (let j = i; j < lines.length; j++) {
        connectLines.push(lines[j]);
        depth += (lines[j].match(/\[/g) || []).length;
        depth -= (lines[j].match(/\]/g) || []).length;
        if (depth <= 0 && lines[j].includes('])')) {
          i = j + 1;
          break;
        }
      }
      // Extract the function body from .connect(fn)
      const full = connectLines.join('\n').trim();
      // Remove .connect( prefix and ) suffix
      connectStr = full.replace(/^\.connect\(/, '').replace(/\)$/, '');
      continue;
    }

    // .eval(...)
    if (line.startsWith('.eval(')) {
      let depth = 0;
      let evalLines = [];
      for (let j = i; j < lines.length; j++) {
        evalLines.push(lines[j]);
        depth += (lines[j].match(/\(/g) || []).length;
        depth -= (lines[j].match(/\)/g) || []).length;
        if (depth <= 0) { i = j + 1; break; }
      }
      const full = evalLines.join('\n').trim();
      evalStr = full.replace(/^\.eval\(/, '').replace(/\)$/, '');
      continue;
    }

    // .state(...)
    const stateMatch = line.match(/^\.state\((.+)\)$/);
    if (stateMatch) {
      stateStr = stateMatch[1];
      i++;
      continue;
    }

    // .onTick(...)
    if (line.startsWith('.onTick(')) {
      let depth = 0;
      let tickLines = [];
      for (let j = i; j < lines.length; j++) {
        tickLines.push(lines[j]);
        depth += (lines[j].match(/\(/g) || []).length;
        depth -= (lines[j].match(/\)/g) || []).length;
        if (depth <= 0) { i = j + 1; break; }
      }
      const full = tickLines.join('\n').trim();
      onTickStr = full.replace(/^\.onTick\(/, '').replace(/\)$/, '');
      continue;
    }

    // .meta(...)
    const metaMatch = line.match(/^\.meta\((.+)\)$/);
    if (metaMatch) {
      metaStr = metaMatch[1];
      i++;
      continue;
    }

    i++;
  }

  // Build object syntax
  const parts = [];
  if (ins.length > 0) parts.push(`  in: { ${ins.join(', ')} },`);
  if (outs.length > 0) parts.push(`  out: { ${outs.join(', ')} },`);
  if (metaStr) parts.push(`  meta: ${metaStr},`);
  if (nodes.length > 0) parts.push(`  nodes: { ${nodes.join(', ')} },`);
  if (nodeArgs.length > 0) parts.push(`  nodeArgs: { ${nodeArgs.join(', ')} },`);
  if (connectStr) parts.push(`  connect: ${connectStr},`);
  if (evalStr) parts.push(`  eval: ${evalStr},`);
  if (stateStr) parts.push(`  state: ${stateStr},`);
  if (onTickStr) parts.push(`  onTick: ${onTickStr},`);

  return `component('${name}', {\n${parts.join('\n')}\n})`;
}

// Process files
const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('Usage: node scripts/chained-to-object.js <file1> [file2] ...');
  process.exit(1);
}

for (const file of files) {
  const source = fs.readFileSync(file, 'utf-8');
  if (!source.includes('.build()')) {
    console.log(`SKIP ${file} (no .build())`);
    continue;
  }
  const result = convertChainedToObject(source);
  if (result !== source) {
    fs.writeFileSync(file, result, 'utf-8');
    console.log(`OK   ${file}`);
  } else {
    console.log(`SKIP ${file} (no changes)`);
  }
}
