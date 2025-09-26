// Global constants used across the project

export const DEFAULT_THRESHOLD = -0.333;
export const DEFAULT_BASE_BRANCH = 'main';
export const DEFAULT_HEAD_BRANCH = 'HEAD';
export const DEFAULT_SCORE_OBJECTIVE = 'maximize';

// Git's empty tree hash - used for comparing against initial commits or shallow clones
export const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export const CONFIG_FILENAMES = [
  'mandoline-ci.config.js',
  '.mandoline-ci.js',
  'mandoline-ci.config.mjs',
  '.mandoline-ci.mjs',
];
