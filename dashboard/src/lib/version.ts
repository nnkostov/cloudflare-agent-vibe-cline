/**
 * Version utilities for dynamic version display
 */

// Get version from package.json at build time
// This will be replaced by Vite during build process
export const APP_VERSION = (import.meta as any).env?.VITE_APP_VERSION || '1.0.0';

// Build timestamp (will be injected at build time)
export const BUILD_TIMESTAMP = (import.meta as any).env?.VITE_BUILD_TIMESTAMP || new Date().toISOString();

// Git commit hash (optional, will be injected if available)
export const GIT_COMMIT = (import.meta as any).env?.VITE_GIT_COMMIT || 'unknown';

/**
 * Get formatted version string
 */
export function getVersionString(): string {
  return `v${APP_VERSION}`;
}

/**
 * Get detailed version info
 */
export function getVersionInfo() {
  return {
    version: APP_VERSION,
    buildTimestamp: BUILD_TIMESTAMP,
    gitCommit: GIT_COMMIT,
    formatted: getVersionString()
  };
}

/**
 * Get version for display in UI
 */
export function getDisplayVersion(): string {
  return getVersionString();
}
