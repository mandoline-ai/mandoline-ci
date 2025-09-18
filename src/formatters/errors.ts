/**
 * Format an error with additional context for human-readable logging.
 */
export function formatError(error: unknown, context: string): string {
  return `${context}: ${error instanceof Error ? error.message : String(error)}`;
}
