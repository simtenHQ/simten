/**
 * Metadata Persistence Utilities
 *
 * Save and load circuit metadata (positions, viewport) for DSL circuits.
 * Metadata is stored separately from DSL code to keep DSL clean.
 *
 * Storage format: localStorage (browser environment)
 * Key format: `dsl-metadata-${circuitName}`
 *
 * File format (for future file-based storage):
 * <circuit-name>.dsl.meta.json
 */

import type { Position } from '../types';

export interface CircuitMetadataFile {
  version: string;
  circuit: string;
  positions: Record<string, Position>; // nodeId -> position
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  lastSync?: string; // ISO timestamp
}

const METADATA_VERSION = '1.0';
const STORAGE_PREFIX = 'dsl-metadata-';

/**
 * Save circuit metadata to localStorage
 */
export function saveCircuitMetadata(
  circuitName: string,
  positions: Record<string, Position>,
  viewport?: { x: number; y: number; zoom: number }
): void {
  const metadata: CircuitMetadataFile = {
    version: METADATA_VERSION,
    circuit: circuitName,
    positions,
    viewport,
    lastSync: new Date().toISOString(),
  };

  const key = `${STORAGE_PREFIX}${circuitName}`;

  try {
    localStorage.setItem(key, JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to save circuit metadata:', error);
  }
}

/**
 * Load circuit metadata from localStorage
 */
export function loadCircuitMetadata(circuitName: string): CircuitMetadataFile | null {
  const key = `${STORAGE_PREFIX}${circuitName}`;

  try {
    const data = localStorage.getItem(key);
    if (!data) return null;

    const metadata = JSON.parse(data) as CircuitMetadataFile;

    // Validate version
    if (metadata.version !== METADATA_VERSION) {
      console.warn(`Metadata version mismatch for ${circuitName}. Expected ${METADATA_VERSION}, got ${metadata.version}`);
      return null;
    }

    return metadata;
  } catch (error) {
    console.error('Failed to load circuit metadata:', error);
    return null;
  }
}

/**
 * Delete circuit metadata from localStorage
 */
export function deleteCircuitMetadata(circuitName: string): void {
  const key = `${STORAGE_PREFIX}${circuitName}`;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to delete circuit metadata:', error);
  }
}

/**
 * List all stored circuit metadata keys
 */
export function listCircuitMetadata(): string[] {
  const keys: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const circuitName = key.substring(STORAGE_PREFIX.length);
        keys.push(circuitName);
      }
    }
  } catch (error) {
    console.error('Failed to list circuit metadata:', error);
  }

  return keys;
}

/**
 * Clear all circuit metadata from localStorage
 */
export function clearAllCircuitMetadata(): void {
  const keys = listCircuitMetadata();

  keys.forEach((circuitName) => {
    deleteCircuitMetadata(circuitName);
  });
}

/**
 * Export circuit metadata as JSON string (for download/file export)
 */
export function exportCircuitMetadata(circuitName: string): string | null {
  const metadata = loadCircuitMetadata(circuitName);
  if (!metadata) return null;

  return JSON.stringify(metadata, null, 2);
}

/**
 * Import circuit metadata from JSON string (for upload/file import)
 */
export function importCircuitMetadata(jsonString: string): boolean {
  try {
    const metadata = JSON.parse(jsonString) as CircuitMetadataFile;

    // Validate required fields
    if (!metadata.circuit || !metadata.positions || !metadata.version) {
      console.error('Invalid metadata format');
      return false;
    }

    saveCircuitMetadata(metadata.circuit, metadata.positions, metadata.viewport);
    return true;
  } catch (error) {
    console.error('Failed to import circuit metadata:', error);
    return false;
  }
}
