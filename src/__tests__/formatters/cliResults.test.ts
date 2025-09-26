import { formatCliResults } from '../../formatters/cliResults.js';

const baseEvaluation = {
  score: 0.5,
  properties: {
    threshold: 0.1,
  },
};

describe('cli result formatter', () => {
  it('signals success when all evaluations pass', () => {
    const { lines, hasFailures } = formatCliResults([
      {
        success: true,
        ruleId: 'quality',
        configName: 'src',
        evaluation: baseEvaluation,
      },
    ]);

    expect(hasFailures).toBe(false);
    expect(lines[0]).toBe('\n📊 Evaluation Results (1 total):');
    expect(lines).toContain('🎉 All evaluations passed!');
    expect(lines).toContain(
      '  ✅ PASS quality: score 0.500 >= threshold 0.100 (maximize)'
    );
  });

  it('signals failure details when an evaluation fails', () => {
    const { lines, hasFailures } = formatCliResults([
      {
        success: true,
        ruleId: 'quality',
        configName: 'src',
        evaluation: baseEvaluation,
      },
      {
        success: false,
        ruleId: 'coverage',
        configName: 'tests',
        evaluation: {
          score: 0.2,
          properties: {
            threshold: 0.1,
          },
        },
      },
    ]);

    expect(hasFailures).toBe(true);
    expect(lines).toContain('💥 Some evaluations failed.');
    expect(lines).toContain('\n❌ Failed evaluations (1):');
    expect(lines).toContain('  - tests.coverage: 0.200');
  });

  it('renders comparator for minimize objective', () => {
    const { lines } = formatCliResults([
      {
        success: true,
        ruleId: 'regression',
        configName: 'src',
        evaluation: {
          score: 0.12,
          properties: {
            threshold: 0.3,
            scoreObjective: 'minimize',
          },
        },
        scoreObjective: 'minimize',
        threshold: 0.3,
      },
    ]);

    expect(lines).toContain(
      '  ✅ PASS regression: score 0.120 <= threshold 0.300 (minimize)'
    );
  });
});
