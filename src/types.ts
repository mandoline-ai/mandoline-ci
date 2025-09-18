import type { Mandoline } from 'mandoline';

export type UUID = string;

/**
 * Base interface for all operation results
 */
export interface BaseResult {
  success: boolean;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Base interface for all configuration objects
 */
export interface BaseConfig {
  name: string;
  enabled?: boolean;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface EvalConfig extends BaseConfig {
  files: string[];
  ignores?: string[];
  rules: Record<string, RuleConfig>;

  // Helper methods would be added via implementation
}

export interface RuleConfig extends BaseConfig {
  metricId: UUID;
  threshold?: number; // default: DEFAULT_THRESHOLD
  weight?: number; // For future weighted scoring
}

export interface EvaluateDiffOptions {
  base: string;
  head: string;
  intent?: string;
  workingDirectory?: string;
  verbose?: boolean;
  configPath?: string;
}

export interface EvalResult extends BaseResult {
  evaluation: any; // Use Mandoline's native Evaluation type
  success: boolean; // Renamed from 'passed' for consistency
  ruleId: string;
  configName: string;
  score?: number;
  threshold?: number;
}

export type LogFunction = (message: string) => void;

export interface EvaluationPreparation {
  configs: EvalConfig[];
  intentSource: IntentSource;
  gitDiff: GitDiffResult;
}

export interface PrepareEvaluationContextOptions {
  base: string;
  head: string;
  manualIntent?: string;
  workingDirectory: string;
  configPath?: string;
  log?: LogFunction;
}

export interface ExecuteEvaluationsParams {
  base: string;
  configs: EvalConfig[];
  intentSource: IntentSource;
  gitDiff: GitDiffResult;
  workingDirectory: string;
  client: Mandoline;
  verbose?: boolean;
  log?: LogFunction;
}

export interface ValidateSetupEnvironmentOptions {
  client: Mandoline;
  workingDirectory: string;
  configPath?: string;
  log?: LogFunction;
}

/**
 * Base interface for git operations
 */
export interface GitOperationResult extends BaseResult {
  workingDirectory: string;
  command: string;
  executedAt: Date;
}

/**
 * Enhanced git file status enum
 */
export enum GitFileStatus {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed',
  COPIED = 'copied',
}

/**
 * Git diff summary with helper methods
 */
export interface GitDiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface GitDiffResult extends GitOperationResult {
  base: string;
  head: string;
  files: GitFileChange[];
  summary: GitDiffSummary;
}

export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  oldPath?: string; // For renamed files
  beforeContent?: string;
  afterContent?: string;
  diff: string;
}

export interface IntentSource extends BaseResult {
  source: 'manual' | 'github_pr' | 'commit_message';
  content: string;
  success: boolean;
  confidence: number; // 0.0 to 1.0 confidence score
  extractedAt: Date;
}

export interface ConfigDiscoveryOptions {
  configPath?: string;
  workingDirectory?: string;
}

export interface ValidationResult extends BaseResult {
  success: boolean; // Renamed from 'valid' for consistency
  errors: string[];
  warnings: string[];
}

export interface MandolineCIOptions {
  apiKey?: string;
  workingDirectory?: string;
  verbose?: boolean;
}

export interface GitContext {
  env: Record<string, string | undefined>;
  options: { base?: string; head?: string };
  workingDir: string;
}

export interface ReferenceSelection {
  base: string;
  head: string;
  strategy: string;
}
