import { formatPrompt, formatResponse } from '../../formatters/payload.js';
import { GitFileStatus } from '../../types.js';

describe('payload formatters', () => {
  const baseFile = {
    path: 'src/example.ts',
    status: GitFileStatus.MODIFIED,
    beforeContent: 'console.log(1);',
    afterContent: 'console.log(2);',
    diff: 'diff --git a/src/example.ts b/src/example.ts',
  };

  it('builds prompts with intent and before-content sections', () => {
    const prompt = formatPrompt('Implement feature', [baseFile]);

    expect(prompt).toBe(
      [
        'Implement feature',
        'File: `src/example.ts`\n```\nconsole.log(1);\n```',
      ].join('\n---\n')
    );
  });

  it('omits before-content when none available', () => {
    const prompt = formatPrompt('Intent only', [
      { ...baseFile, beforeContent: undefined },
    ]);

    expect(prompt).toBe('Intent only');
  });

  it('joins diffs into the response payload', () => {
    const response = formatResponse([
      baseFile,
      { ...baseFile, path: 'src/second.ts', diff: 'diff --git second' },
    ]);

    expect(response).toBe(
      [
        'diff --git a/src/example.ts b/src/example.ts',
        'diff --git second',
      ].join('\n---\n')
    );
  });
});
