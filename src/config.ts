import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

import { access } from 'fs/promises';

import {
  ConfigDiscoveryOptions,
  EvalConfig,
  ValidationResult,
} from './types.js';
import { isValidUUID } from './utils.js';
import { CONFIG_FILENAMES, DEFAULT_THRESHOLD } from './constants.js';
import { formatError } from './utils.js';

export async function discoverConfig(
  options: ConfigDiscoveryOptions = {}
): Promise<EvalConfig[]> {
  const { configPath, workingDirectory = process.cwd() } = options;

  if (configPath) {
    return loadConfigFromPath(resolve(workingDirectory, configPath));
  }

  for (const filename of CONFIG_FILENAMES) {
    const fullPath = join(workingDirectory, filename);
    try {
      await access(fullPath);
      return loadConfigFromPath(fullPath);
    } catch {
      // Continue to next filename
    }
  }

  throw new Error(
    `No configuration file found. Expected one of: ${CONFIG_FILENAMES.join(
      ', '
    )}`
  );
}

async function loadConfigFromPath(configPath: string): Promise<EvalConfig[]> {
  try {
    let configModule;

    if (configPath.endsWith('.mjs')) {
      configModule = await import(pathToFileURL(configPath).href);
    } else {
      delete require.cache[require.resolve(configPath)];
      configModule = require(configPath);
    }

    const config = configModule.default || configModule;

    if (Array.isArray(config)) {
      return config;
    } else if (typeof config === 'object' && config !== null) {
      return [config];
    } else {
      throw new Error(
        'Configuration must export an EvalConfig object or array of EvalConfig objects'
      );
    }
  } catch (error) {
    throw new Error(formatError(error, `Failed to load configuration from ${configPath}`));
  }
}

export function validateConfig(config: EvalConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.name || typeof config.name !== 'string') {
    errors.push('Configuration must have a "name" property of type string');
  }

  if (!Array.isArray(config.files)) {
    errors.push('Configuration must have a "files" property of type string[]');
  } else if (config.files.length === 0) {
    warnings.push(
      'Configuration has empty "files" array - no files will be evaluated'
    );
  }

  if (config.ignores && !Array.isArray(config.ignores)) {
    errors.push('Configuration "ignores" property must be of type string[]');
  }

  if (!config.rules || typeof config.rules !== 'object') {
    errors.push('Configuration must have a "rules" property of type object');
  } else {
    for (const [ruleId, rule] of Object.entries(config.rules)) {
      if (!rule.metricId || typeof rule.metricId !== 'string') {
        errors.push(
          `Rule "${ruleId}" must have a "metricId" property of type string`
        );
      } else if (!isValidUUID(rule.metricId)) {
        errors.push(
          `Rule "${ruleId}" metricId "${rule.metricId}" is not a valid UUID`
        );
      }

      if (rule.threshold !== undefined && typeof rule.threshold !== 'number') {
        errors.push(`Rule "${ruleId}" threshold must be a number`);
      }

      if (
        rule.threshold !== undefined &&
        (rule.threshold < -1 || rule.threshold > 1)
      ) {
        errors.push(`Rule "${ruleId}" threshold must be between -1 and 1`);
      }
    }

    if (Object.keys(config.rules).length === 0) {
      warnings.push('Configuration has no rules defined');
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateConfigs(configs: EvalConfig[]): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const configNames = new Set<string>();

  for (const [index, config] of configs.entries()) {
    const result = validateConfig(config);

    // Add context to errors and warnings
    result.errors.forEach((error) =>
      allErrors.push(
        `Config ${index + 1} (${config.name || 'unnamed'}): ${error}`
      )
    );
    result.warnings.forEach((warning) =>
      allWarnings.push(
        `Config ${index + 1} (${config.name || 'unnamed'}): ${warning}`
      )
    );

    // Check for duplicate names
    if (config.name) {
      if (configNames.has(config.name)) {
        allErrors.push(`Duplicate configuration name: "${config.name}"`);
      } else {
        configNames.add(config.name);
      }
    }
  }

  if (configs.length === 0) {
    allErrors.push('At least one configuration must be provided');
  }

  return {
    success: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}


export function getDefaultThreshold(): number {
  return DEFAULT_THRESHOLD;
}
