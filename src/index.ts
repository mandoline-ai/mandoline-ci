// Main exports for the library
export {
  discoverConfig,
  getDefaultThreshold,
  validateConfig,
  validateConfigs,
} from './config.js';
export {
  evaluateDiff,
  executeEvaluations,
  MandolineCI,
  prepareEvaluationContext,
  validateSetupEnvironment,
} from './core.js';
export {
  analyzeGitDiff,
  detectExecutionContext,
  getCurrentBranch,
  getSmartBaseForMainBranch,
  isHeadMergeCommit,
  resolveGitReferences,
  selectReferences,
  validateGitRefs,
  validateGitRepository,
  validateReferences,
} from './git.js';
export { extractIntent } from './intent.js';
export * from './types.js';
