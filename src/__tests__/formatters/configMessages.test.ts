import {
  formatConfigErrors,
  formatConfigWarnings,
} from '../../formatters/configMessages.js';

describe('config message formatters', () => {
  it('prefixes errors with config context', () => {
    expect(
      formatConfigErrors('src', 0, ['Missing files', 'Invalid rule'])
    ).toEqual([
      'Config 1 (src): Missing files',
      'Config 1 (src): Invalid rule',
    ]);
  });

  it('falls back to unnamed config label', () => {
    expect(formatConfigWarnings(undefined, 1, ['No rules'])).toEqual([
      'Config 2 (unnamed): No rules',
    ]);
  });

  it('returns empty arrays when no messages exist', () => {
    expect(formatConfigErrors('src', 0, [])).toEqual([]);
    expect(formatConfigWarnings('src', 0, [])).toEqual([]);
  });
});
