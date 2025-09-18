import { DEFAULT_THRESHOLD } from '../constants.js';
import type { EvalResult } from '../types.js';

const SEPARATOR = '─'.repeat(60);

interface CliResults {
  lines: string[];
  hasFailures: boolean;
}

function groupByConfig(results: EvalResult[]): Record<string, EvalResult[]> {
  return results.reduce<Record<string, EvalResult[]>>((acc, result) => {
    const key = result.configName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {});
}

export function formatCliResults(results: EvalResult[]): CliResults {
  const lines: string[] = [
    `\n📊 Evaluation Results (${results.length} total):`,
    SEPARATOR,
  ];

  const groupedResults = groupByConfig(results);
  let hasFailures = false;

  for (const [configName, configResults] of Object.entries(groupedResults)) {
    lines.push(`\n🔧 Configuration: ${configName}`);

    if (!configResults.every((result) => result.success)) {
      hasFailures = true;
    }

    for (const result of configResults) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const score = result.evaluation.score.toFixed(3);
      const threshold =
        result.evaluation.properties?.threshold ?? DEFAULT_THRESHOLD;

      lines.push(
        `  ${status} ${result.ruleId}: ${score} (threshold: ${threshold})`
      );
    }
  }

  lines.push(`\n${SEPARATOR}`);

  if (!hasFailures) {
    lines.push('🎉 All evaluations passed!');
    return { lines, hasFailures };
  }

  lines.push('💥 Some evaluations failed.');

  const failures = results.filter((result) => !result.success);
  lines.push(`\n❌ Failed evaluations (${failures.length}):`);

  for (const failure of failures) {
    lines.push(
      `  - ${failure.configName}.${failure.ruleId}: ${failure.evaluation.score.toFixed(
        3
      )}`
    );
  }

  return { lines, hasFailures };
}
