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
  EvaluationPreparation,
  ExecuteEvaluationsParams,
  GitFileChange,
  LogFunction,
  MandolineCIOptions,
  PrepareEvaluationContextOptions,
  ValidateSetupEnvironmentOptions,
  ValidationResult,
} from './types.js';

function emitLog(log: LogFunction | undefined, message: string): void {
  if (log) {
    log(message);
  }
}

function emitWarning(log: LogFunction | undefined, message: string): void {
  if (log) {
    log(message);
  } else {
    console.warn(message);
  }
}

async function filterFilesForConfig(
  files: GitFileChange[],
  config: EvalConfig,
  workingDirectory: string
): Promise<GitFileChange[]> {
  const includedPaths = await globby(config.files, {
    cwd: workingDirectory,
    absolute: false,
    onlyFiles: false,
  });

  let filteredPaths = includedPaths;
  if (config.ignores && config.ignores.length > 0) {
    const ignoredPaths = await globby(config.ignores, {
      cwd: workingDirectory,
      absolute: false,
      onlyFiles: false,
    });
    filteredPaths = includedPaths.filter(
      (path) => !ignoredPaths.includes(path)
    );
  }

  return files.filter((file) => filteredPaths.includes(file.path));
}

export async function validateSetupEnvironment(
  options: ValidateSetupEnvironmentOptions
): Promise<ValidationResult> {
  const { client, workingDirectory, configPath, log } = options;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    emitLog(log, 'Validating git repository...');
    const isGitRepo = await validateGitRepository(workingDirectory);
    if (!isGitRepo) {
      errors.push('Working directory is not a git repository');
    }

    emitLog(log, 'Validating Mandoline API connectivity...');
    try {
      await client.getMetrics({ limit: 1 });
    } catch (error) {
      errors.push(
        `API connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    emitLog(log, 'Discovering evaluation configuration...');
    try {
      const configs = await discoverConfig({
        workingDirectory,
        configPath,
      });
      const validation = validateConfigs(configs);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
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

export async function prepareEvaluationContext(
  options: PrepareEvaluationContextOptions
): Promise<EvaluationPreparation> {
  const { base, head, manualIntent, workingDirectory, configPath, log } =
    options;

  emitLog(log, `Validating git references: ${base}...${head}`);
  await validateGitRefs(base, head, workingDirectory);

  emitLog(log, 'Loading evaluation configuration...');
  const configs = await discoverConfig({
    workingDirectory,
    configPath,
  });

  const validation = validateConfigs(configs);
  if (!validation.success) {
    throw new Error(
      `Configuration validation failed: ${validation.errors.join('; ')}`
    );
  }

  if (validation.warnings.length > 0) {
    emitWarning(
      log,
      `Configuration warnings: ${validation.warnings.join('; ')}`
    );
  }

  emitLog(log, 'Extracting intent...');
  const intentSource = await extractIntent(
    base,
    head,
    manualIntent,
    workingDirectory
  );
  emitLog(log, `Intent extracted from ${intentSource.source}`);

  emitLog(log, 'Analyzing git diff...');
  const gitDiff = await analyzeGitDiff(base, head, workingDirectory);
  emitLog(log, `Found ${gitDiff.files.length} changed files`);

  return {
    configs,
    intentSource,
    gitDiff,
  };
}

export async function executeEvaluations(
  options: ExecuteEvaluationsParams
): Promise<EvalResult[]> {
  const {
    base,
    configs,
    intentSource,
    gitDiff,
    workingDirectory,
    client,
    log,
  } = options;

  const results: EvalResult[] = [];

  for (const config of configs) {
    emitLog(log, `Processing configuration: ${config.name}`);

    const filteredFiles = await filterFilesForConfig(
      gitDiff.files,
      config,
      workingDirectory
    );

    if (filteredFiles.length === 0) {
      emitLog(log, `No files match configuration ${config.name}, skipping`);
      continue;
    }

    const ruleCount = Object.keys(config.rules).length;
    emitLog(
      log,
      `Executing ${ruleCount} evaluation${ruleCount === 1 ? '' : 's'} for ${
        config.name
      }...`
    );

    for (const [ruleId, rule] of Object.entries(config.rules)) {
      const threshold = rule.threshold ?? getDefaultThreshold();

      const beforeSections = filteredFiles
        .map((file) =>
          file.beforeContent
            ? `File: \`${file.path}\`\n\`\`\`\n${file.beforeContent}\n\`\`\``
            : null
        )
        .filter((value): value is string => Boolean(value));

      const promptSegments = [intentSource.content];
      if (beforeSections.length > 0) {
        promptSegments.push(beforeSections.join('\n---\n'));
      }
      const prompt = promptSegments.join('\n---\n');

      const response = filteredFiles
        .map((file) => file.diff)
        .filter(Boolean)
        .join('\n---\n');

      const evaluation = await client.createEvaluation({
        metricId: rule.metricId,
        prompt,
        response,
        properties: {
          threshold,
          config: config.name,
          base_ref: base,
          head_ref: gitDiff.head,
          file_count: filteredFiles.length,
          file_paths: filteredFiles.map((file) => file.path),
          ...getEnvironmentContext(intentSource.source),
        },
      });

      const success = evaluation.score >= threshold;

      results.push({
        evaluation,
        success,
        ruleId,
        configName: config.name,
        score: evaluation.score,
        threshold,
      });
    }
  }

  emitLog(log, `Evaluation complete. ${results.length} total results.`);
  return results;
}

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

  async validateSetup(
    options: { configPath?: string } = {}
  ): Promise<ValidationResult> {
    const log = this.verbose ? this.log.bind(this) : undefined;
    return await validateSetupEnvironment({
      client: this.client,
      workingDirectory: this.workingDirectory,
      configPath: options.configPath,
      log,
    });
  }

  async evaluateDiff(options: EvaluateDiffOptions): Promise<EvalResult[]> {
    const {
      base,
      head,
      intent: manualIntent,
      workingDirectory,
      verbose,
      configPath,
    } = options;

    if (workingDirectory) {
      this.workingDirectory = workingDirectory;
    }

    if (verbose !== undefined) {
      this.verbose = verbose;
    }

    const log = this.verbose ? this.log.bind(this) : undefined;

    this.log(`Starting evaluation: ${base}...${head}`);

    const { configs, intentSource, gitDiff } = await prepareEvaluationContext({
      base,
      head,
      manualIntent,
      workingDirectory: this.workingDirectory,
      configPath,
      log,
    });

    if (gitDiff.files.length === 0) {
      this.log('No files changed, skipping evaluation');
      return [];
    }

    return await executeEvaluations({
      base,
      configs,
      intentSource,
      gitDiff,
      workingDirectory: this.workingDirectory,
      client: this.client,
      verbose: this.verbose,
      log,
    });
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[MandolineCI] ${message}`);
    }
  }
}

export async function evaluateDiff(
  options: EvaluateDiffOptions
): Promise<EvalResult[]> {
  const client = new MandolineCI({
    workingDirectory: options.workingDirectory,
    verbose: options.verbose,
  });

  return await client.evaluateDiff(options);
}
