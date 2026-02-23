/**
 * DSL Preprocessor
 *
 * Handles include directives before parsing.
 * Syntax: include "path/to/file.dsl"
 *
 * This is a simple text-substitution preprocessor that:
 * 1. Scans for include directives
 * 2. Replaces them with the contents of the included file
 * 3. Handles nested includes (with cycle detection)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export type FileResolver = (path: string, fromPath?: string) => string | null;

export interface PreprocessResult {
  source: string;
  errors: Array<{ message: string; line: number }>;
  includedFiles: string[];
}

/**
 * Preprocess DSL source, resolving include directives
 *
 * @param source - The DSL source code
 * @param resolver - Function to resolve file paths to their contents
 * @param currentPath - Path of the current file (for relative includes)
 * @param visited - Set of already included files (for cycle detection)
 */
export function preprocessDSL(
  source: string,
  resolver: FileResolver,
  currentPath?: string,
  visited: Set<string> = new Set()
): PreprocessResult {
  const errors: Array<{ message: string; line: number }> = [];
  const includedFiles: string[] = [];

  // Regex to match include directives: include "path"
  const includeRegex = /^(\s*)include\s+"([^"]+)"\s*$/gm;

  let result = source;
  let match;
  let offset = 0;

  // Reset regex
  includeRegex.lastIndex = 0;

  // Process includes
  const matches: Array<{
    fullMatch: string;
    indent: string;
    path: string;
    index: number;
    line: number;
  }> = [];

  // First pass: collect all matches with line numbers
  let lineNumber = 1;
  let lastIndex = 0;

  while ((match = includeRegex.exec(source)) !== null) {
    // Count lines up to this match
    const textBefore = source.substring(lastIndex, match.index);
    lineNumber += (textBefore.match(/\n/g) || []).length;

    matches.push({
      fullMatch: match[0],
      indent: match[1],
      path: match[2],
      index: match.index,
      line: lineNumber
    });

    lastIndex = match.index + match[0].length;
  }

  // Process matches in reverse order to maintain correct offsets
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const includePath = m.path;

    // Check for cycles
    if (visited.has(includePath)) {
      errors.push({
        message: `Circular include detected: ${includePath}`,
        line: m.line
      });
      continue;
    }

    // Resolve the file
    const content = resolver(includePath, currentPath);

    if (content === null) {
      errors.push({
        message: `Cannot resolve include: ${includePath}`,
        line: m.line
      });
      continue;
    }

    // Track included file
    includedFiles.push(includePath);

    // Recursively preprocess the included content
    const newVisited = new Set(visited);
    newVisited.add(includePath);

    const nested = preprocessDSL(content, resolver, includePath, newVisited);

    // Merge errors and included files
    errors.push(...nested.errors.map(e => ({
      message: `In ${includePath}: ${e.message}`,
      line: m.line
    })));
    includedFiles.push(...nested.includedFiles);

    // Add a comment showing where the include came from
    const replacement = `// === BEGIN include "${includePath}" ===\n${nested.source}\n// === END include "${includePath}" ===`;

    // Replace the include directive with the content
    result = result.substring(0, m.index + offset) + replacement + result.substring(m.index + offset + m.fullMatch.length);

    // Update offset for subsequent replacements
    offset += replacement.length - m.fullMatch.length;
  }

  return {
    source: result,
    errors,
    includedFiles
  };
}

/**
 * Create a file resolver for Node.js filesystem.
 *
 * @param basePath - Base directory for resolving relative paths
 */
export function createNodeFileResolver(basePath: string): FileResolver {
  return (filePath: string, fromPath?: string) => {
    const base = fromPath ? dirname(fromPath) : basePath;
    try {
      return readFileSync(resolve(base, filePath), 'utf-8');
    } catch {
      return null;
    }
  };
}

/**
 * Create a file resolver from a map of paths to contents
 * Useful for testing and browser environments
 */
export function createMapFileResolver(files: Map<string, string> | Record<string, string>): FileResolver {
  const fileMap = files instanceof Map ? files : new Map(Object.entries(files));

  return (path: string, _fromPath?: string) => {
    return fileMap.get(path) ?? null;
  };
}
