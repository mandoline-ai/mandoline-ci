#!/usr/bin/env node

import { Command } from 'commander';

import { MandolineCI } from './core.js';
import {
  DEFAULT_THRESHOLD,
} from './constants.js';
import { resolveGitReferences } from './git.js';
import { getPackageVersion } from './utils.js';

function displayResults(results: any[]): void {
  // Display results
  console.log(`\n📊 Evaluation Results (${results.length} total):`);
  console.log('─'.repeat(60));

  const configGroups = groupBy(results, (r) => r.configName);
  let overallPassed = true;

  for (const [configName, configResults] of Object.entries(configGroups)) {
    console.log(`\n🔧 Configuration: ${configName}`);

    const configPassed = configResults.every((r) => r.success);
    overallPassed = overallPassed && configPassed;

    for (const result of configResults) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const score = result.evaluation.score.toFixed(3);
      const threshold =
        result.evaluation.properties?.threshold ?? DEFAULT_THRESHOLD;

      console.log(
        `  ${status} ${result.ruleId}: ${score} (threshold: ${threshold})`
      );
    }
  }

  console.log('\n' + '─'.repeat(60));

  if (overallPassed) {
    console.log('🎉 All evaluations passed!');
    process.exit(0);
  } else {
    console.log('💥 Some evaluations failed.');

    // Show summary of failures
    const failures = results.filter((r) => !r.success);
    console.log(`\n❌ Failed evaluations (${failures.length}):`);
    for (const failure of failures) {
      console.log(
        `  - ${failure.configName}.${
          failure.ruleId
        }: ${failure.evaluation.score.toFixed(3)}`
      );
    }

    process.exit(1);
  }
}

function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item);
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

// CLI Setup & Program Definition

const program = new Command();

program
  .name('mandoline-ci')
  .description(
    'Code evaluation tool that extends CI pipelines to assess intent and quality expectations'
  )
  .version(getPackageVersion(import.meta.url));

program
  .command('run')
  .description('Evaluate git diff using Mandoline metrics')
  .option('--config <path>', 'Custom config file path')
  .option('--base <branch>', 'Base branch for comparison')
  .option('--head <branch>', 'Head branch for comparison')
  .option('--intent <string>', 'Manual intent override')
  .option('--verbose', 'Enable verbose output', false)
  .option('--working-directory <path>', 'Working directory path')
  .action(async (options) => {
    try {
      // Use new context-driven reference resolution
      const gitContext = {
        env: process.env,
        options: { base: options.base, head: options.head },
        workingDir: options.workingDirectory || process.cwd()
      };
      
      const references = await resolveGitReferences(gitContext);
      const { base, head } = references;

      const client = new MandolineCI({
        workingDirectory: options.workingDirectory,
        verbose: options.verbose,
      });

      const results = await client.evaluateDiff({
        base,
        head,
        intent: options.intent,
        workingDirectory: options.workingDirectory,
        verbose: options.verbose,
      });

      displayResults(results);
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate setup and configuration')
  .option('--working-directory <path>', 'Working directory path')
  .action(async (options) => {
    try {
      const client = new MandolineCI({
        workingDirectory: options.workingDirectory,
        verbose: true,
      });

      console.log('Validating setup...');
      const result = await client.validateSetup();

      if (result.success) {
        console.log('✅ Setup validation passed');
        if (result.warnings.length > 0) {
          console.warn('Warnings:');
          result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
        }
      } else {
        console.error('❌ Setup validation failed');
        result.errors.forEach((error) => console.error(`  - ${error}`));
        if (result.warnings.length > 0) {
          console.warn('Warnings:');
          result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(
        'Validation error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

// Error Handling & Program Execution

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// Parse CLI arguments
program.parse();
