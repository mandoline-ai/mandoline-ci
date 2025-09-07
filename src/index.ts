// Main exports for the library
export {
  discoverConfig,
  getDefaultThreshold,
  validateConfig,
  validateConfigs,
} from './config.js';
export { evaluateDiff, MandolineCI } from './core.js';
export {
  analyzeGitDiff,
  getCurrentBranch,
  validateGitRefs,
  validateGitRepository,
  isHeadMergeCommit,
  getSmartBaseForMainBranch,
  detectExecutionContext,
  selectReferences,
  validateReferences,
  resolveGitReferences,
} from './git.js';
export { extractIntent } from './intent.js';
export * from './types.js';
