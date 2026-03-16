/**
 * Schema Compatibility
 *
 * Protocol versioning and capability evolution.
 */

import { SCHEMA_COMPAT, PROTOCOL_VERSION } from '../constants';

// ============================================================================
// Version Compatibility
// ============================================================================

/**
 * Check if a schema version is supported.
 */
export function isVersionSupported(version: string): boolean {
  return version in SCHEMA_COMPAT;
}

/**
 * Get supported action types for a schema version.
 */
export function getSupportedActions(version: string): string[] {
  return SCHEMA_COMPAT[version] ?? [];
}

/**
 * Get the current protocol version.
 */
export function getCurrentVersion(): string {
  return PROTOCOL_VERSION;
}

// ============================================================================
// Client Capabilities
// ============================================================================

export interface ClientCapabilities {
  supportedActions: string[];
  schemaVersion: string;
}

/**
 * Build client capabilities for current version.
 */
export function buildClientCapabilities(): ClientCapabilities {
  return {
    supportedActions: getSupportedActions(PROTOCOL_VERSION),
    schemaVersion: PROTOCOL_VERSION,
  };
}

/**
 * Check if an action type is supported by the client.
 */
export function isActionSupported(
  actionType: string,
  capabilities: ClientCapabilities
): boolean {
  return capabilities.supportedActions.includes(actionType);
}

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * Parse a version string into components.
 */
function parseVersion(version: string): { major: number; minor: number } {
  const [major, minor] = version.split('.').map(Number);
  return { major: major || 0, minor: minor || 0 };
}

/**
 * Check if version A is compatible with version B.
 * A is compatible with B if:
 * - Same major version
 * - A's minor version >= B's minor version
 */
export function isVersionCompatible(
  clientVersion: string,
  serverVersion: string
): boolean {
  const client = parseVersion(clientVersion);
  const server = parseVersion(serverVersion);

  // Major version must match
  if (client.major !== server.major) {
    return false;
  }

  // Client minor version must be >= server minor version
  return client.minor >= server.minor;
}

/**
 * Get version compatibility status.
 */
export function getVersionStatus(
  clientVersion: string,
  serverVersion: string
): 'compatible' | 'upgrade-recommended' | 'incompatible' {
  const client = parseVersion(clientVersion);
  const server = parseVersion(serverVersion);

  // Different major versions are incompatible
  if (client.major !== server.major) {
    return 'incompatible';
  }

  // Client is behind server minor version
  if (client.minor < server.minor) {
    return 'upgrade-recommended';
  }

  return 'compatible';
}

// ============================================================================
// Action Type Guards
// ============================================================================

/**
 * Check if an action type is known in the current protocol version.
 */
export function isKnownActionType(type: string): boolean {
  return getSupportedActions(PROTOCOL_VERSION).includes(type);
}

/**
 * Filter actions to only those supported by the client.
 */
export function filterSupportedActions<T extends { type: string }>(
  actions: T[],
  capabilities: ClientCapabilities
): T[] {
  return actions.filter((action) =>
    isActionSupported(action.type, capabilities)
  );
}
