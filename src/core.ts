import { globby } from 'globby';
import { Mandoline } from 'mandoline';

import {
  discoverConfig,
  getDefaultThreshold,
  validateConfigs,
} from './config.js';
import { getEnvironmentContext } from './context.js';
import {
  analyzeGitDiff,
  validateGitRefs,
  validateGitRepository,
} from './git.js';
import { extractIntent } from './intent.js';
import {
  EvalConfig,
  EvalResult,
  EvaluateDiffOptions,
  GitFileChange,
  MandolineCIOptions,
  ValidationResult,
} from './types.js';

export class MandolineCI {
  private client: Mandoline;
  private workingDirectory: string;
  private verbose: boolean;

  constructor(options: MandolineCIOptions = {}) {
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.verbose = options.verbose || false;

    const apiKey = options.apiKey || process.env.MANDOLINE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'MANDOLINE_API_KEY environment variable or apiKey parameter is required'
      );
    }

    this.client = new Mandoline({ apiKey });
  }

  async validateSetup(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate git repository
      const isGitRepo = await validateGitRepository(this.workingDirectory);
      if (!isGitRepo) {
        errors.push('Working directory is not a git repository');
      }

      // Validate API connection
      try {
        await this.client.getMetrics({ limit: 1 });
      } catch (error) {
        errors.push(
          `API connection failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Validate configuration discovery
      try {
        const configs = await discoverConfig({
          workingDirectory: this.workingDirectory,
        });
        const configValidation = validateConfigs(configs);
        errors.push(...configValidation.errors);
        warnings.push(...configValidation.warnings);
      } catch (error) {
        errors.push(
          `Configuration discovery failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } catch (error) {
      errors.push(
        `Setup validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  async evaluateDiff(options: EvaluateDiffOptions): Promise<EvalResult[]> {
    const {
      base,
      head,
      intent: manualIntent,
      workingDirectory,
      verbose,
    } = options;

    if (workingDirectory) {
      this.workingDirectory = workingDirectory;
    }

    if (verbose !== undefined) {
      this.verbose = verbose;
    }

    this.log(`Starting evaluation: ${base}...${head}`);

    // Pre-flight validation
    await validateGitRefs(base, head, this.workingDirectory);

    // Load and validate configuration
    this.log('Loading configuration...');
    const configs = await discoverConfig({
      workingDirectory: this.workingDirectory,
    });
    const configValidation = validateConfigs(configs);

    if (!configValidation.success) {
      throw new Error(
        `Configuration validation failed: ${configValidation.errors.join('; ')}`
      );
    }

    if (configValidation.warnings.length > 0) {
      console.warn(
        'Configuration warnings:',
        configValidation.warnings.join('; ')
      );
    }

    // Extract intent
    this.log('Extracting intent...');
    const intentSource = await extractIntent(
      base,
      head,
      manualIntent,
      this.workingDirectory
    );
    this.log(
      `Intent extracted from ${intentSource.source}: ${intentSource.content}`
    );

    // Analyze git diff
    this.log('Analyzing git diff...');
    const gitDiff = await analyzeGitDiff(base, head, this.workingDirectory);
    this.log(`Found ${gitDiff.files.length} changed files`);

    if (gitDiff.files.length === 0) {
      this.log('No files changed, skipping evaluation');
      return [];
    }

    // Process each configuration independently
    const allResults: EvalResult[] = [];

    for (const config of configs) {
      this.log(`Processing configuration: ${config.name}`);

      // Filter files for this configuration (post-analysis)
      const filteredFiles = await this.filterFilesForConfig(
        gitDiff.files,
        config
      );

      if (filteredFiles.length === 0) {
        this.log(`No files match configuration ${config.name}, skipping`);
        continue;
      }

      this.log(
        `Configuration ${config.name} matches ${filteredFiles.length} files`
      );

      // Execute evaluations directly with Mandoline client
      this.log(
        `Executing ${Object.keys(config.rules).length} evaluations for ${
          config.name
        }...`
      );

      for (const [ruleId, rule] of Object.entries(config.rules)) {
        // Build the prompt (intent + concatenated before file contents)
        const beforeContents = filteredFiles
          .map((file) => {
            if (file.beforeContent) {
              return `File: ${file.path}\n${file.beforeContent}`;
            }
            return null;
          })
          .filter(Boolean)
          .join('\n---\n');

        const prompt = `${intentSource.content}\n---\n${beforeContents}`;

        // Build the response (concatenated diff output)
        const response = filteredFiles
          .map((file) => file.diff)
          .filter(Boolean)
          .join('\n---\n');

        // Create evaluation directly with Mandoline
        const evaluation = await this.client.createEvaluation({
          metricId: rule.metricId,
          prompt,
          response,
          properties: {
            threshold: rule.threshold ?? getDefaultThreshold(),
            ...getEnvironmentContext(intentSource.source),
          },
        });

        const passed =
          evaluation.score >= (rule.threshold ?? getDefaultThreshold());

        allResults.push({
          evaluation,
          success: passed,
          ruleId,
          configName: config.name,
        });
      }
    }

    this.log(`Evaluation complete. ${allResults.length} total results.`);
    return allResults;
  }

  private async filterFilesForConfig(
    files: GitFileChange[],
    config: EvalConfig
  ): Promise<GitFileChange[]> {
    // Apply include patterns
    const includedPaths = await globby(config.files, {
      cwd: this.workingDirectory,
      absolute: false,
      onlyFiles: false, // Allow directories in patterns
    });

    // Apply ignore patterns if they exist
    let filteredPaths = includedPaths;
    if (config.ignores && config.ignores.length > 0) {
      const ignoredPaths = await globby(config.ignores, {
        cwd: this.workingDirectory,
        absolute: false,
        onlyFiles: false,
      });
      filteredPaths = includedPaths.filter(
        (path) => !ignoredPaths.includes(path)
      );
    }

    // Return only files that were both changed and match the configuration patterns
    return files.filter((file) => filteredPaths.includes(file.path));
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[MandolineCI] ${message}`);
    }
  }
}

// Standalone evaluation function for programmatic API
export async function evaluateDiff(
  options: EvaluateDiffOptions
): Promise<EvalResult[]> {
  const client = new MandolineCI({
    workingDirectory: options.workingDirectory,
    verbose: options.verbose,
  });

  return await client.evaluateDiff(options);
}
