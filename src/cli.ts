#!/usr/bin/env node

import { Command } from 'commander';

import { MandolineCI } from './core.js';
import { resolveGitReferences } from './git.js';
import { formatCliResults } from './formatters/cliResults.js';
import { getPackageVersion } from './utils.js';
import type { EvalResult } from './types.js';

function displayResults(results: EvalResult[]): void {
  const { lines, hasFailures } = formatCliResults(results);

  for (const line of lines) {
    console.log(line);
  }

  process.exit(hasFailures ? 1 : 0);
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
        workingDir: options.workingDirectory || process.cwd(),
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
        configPath: options.config,
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
  .option('--config <path>', 'Custom config file path')
  .option('--working-directory <path>', 'Working directory path')
  .action(async (options) => {
    try {
      const client = new MandolineCI({
        workingDirectory: options.workingDirectory,
        verbose: true,
      });

      console.log('Validating setup...');
      const result = await client.validateSetup({
        configPath: options.config,
      });

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
