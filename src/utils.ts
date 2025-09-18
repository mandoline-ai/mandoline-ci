import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { SimpleGit, simpleGit } from 'simple-git';

/**
 * Helper function to create git instance with consistent working directory handling
 */
export function createGit(workingDir?: string): SimpleGit {
  return simpleGit(workingDir || process.cwd());
}

/**
 * Safely read a file, returning null if it doesn't exist or can't be read
 */
export function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Safely parse JSON, returning fallback if parsing fails
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

/**
 * Get package version from package.json relative to import.meta.url
 */
export function getPackageVersion(importMetaUrl: string): string {
  const packageJsonPath = join(
    fileURLToPath(importMetaUrl),
    '../../../package.json'
  );
  const content = safeReadFile(packageJsonPath);
  if (!content) return 'unknown';

  const packageJson = safeJsonParse(content, { version: 'unknown' });
  return packageJson.version;
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid
  );
}
