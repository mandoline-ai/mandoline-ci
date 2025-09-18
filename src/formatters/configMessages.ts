function getConfigLabel(name: string | undefined, index: number): string {
  return `Config ${index + 1} (${name || 'unnamed'})`;
}

export function formatConfigErrors(
  name: string | undefined,
  index: number,
  errors: string[]
): string[] {
  if (errors.length === 0) {
    return [];
  }

  const label = getConfigLabel(name, index);
  return errors.map((error) => `${label}: ${error}`);
}

export function formatConfigWarnings(
  name: string | undefined,
  index: number,
  warnings: string[]
): string[] {
  if (warnings.length === 0) {
    return [];
  }

  const label = getConfigLabel(name, index);
  return warnings.map((warning) => `${label}: ${warning}`);
}
