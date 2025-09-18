import type { GitFileChange } from '../types.js';

const SECTION_DELIMITER = '\n---\n';

function formatBeforeSection(file: GitFileChange): string | null {
  if (!file.beforeContent) {
    return null;
  }

  return `File: \`${file.path}\`\n\`\`\`\n${file.beforeContent}\n\`\`\``;
}

export function formatPrompt(intent: string, files: GitFileChange[]): string {
  const beforeSections = files
    .map(formatBeforeSection)
    .filter((value): value is string => Boolean(value));

  const segments = [intent];

  if (beforeSections.length > 0) {
    segments.push(beforeSections.join(SECTION_DELIMITER));
  }

  return segments.join(SECTION_DELIMITER);
}

export function formatResponse(files: GitFileChange[]): string {
  return files
    .map((file) => file.diff)
    .filter((diff): diff is string => Boolean(diff))
    .join(SECTION_DELIMITER);
}
