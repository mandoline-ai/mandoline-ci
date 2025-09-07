import { DiffResult, SimpleGit } from 'simple-git';

import { GitDiffResult, GitFileChange, GitFileStatus, GitContext, ReferenceSelection } from './types.js';
import { createGit, formatError } from './utils.js';
import { EMPTY_TREE_HASH, DEFAULT_BASE_BRANCH, DEFAULT_HEAD_BRANCH } from './constants.js';

export async function analyzeGitDiff(
  base: string,
  head: string,
  workingDir?: string
): Promise<GitDiffResult> {
  const git = createGit(workingDir);

  try {
    // Ensure we're in a git repository
    await git.checkIsRepo();

    // Get the diff between base and head
    let diff: DiffResult;
    
    // Handle special case: EMPTY_TREE_HASH cannot be used in range expressions
    if (base === EMPTY_TREE_HASH) {
      // For first commit scenarios, compare empty tree to HEAD directly
      diff = await git.diffSummary([EMPTY_TREE_HASH, head]);
    } else {
      // Normal case: use range expression
      diff = await git.diffSummary([`${base}...${head}`]);
    }

    // Get detailed file changes
    const files: GitFileChange[] = [];

    for (const file of diff.files) {
      const fileChange: GitFileChange = {
        path: file.file,
        status: determineFileStatus(file),
        diff: await getFileDiff(git, base, head, file.file),
      };

      // Get file contents before and after changes
      if (fileChange.status === 'added') {
        fileChange.afterContent = await getFileContent(git, head, file.file);
      } else if (fileChange.status === 'deleted') {
        fileChange.beforeContent = await getFileContent(git, base, file.file);
      } else if (fileChange.status === 'modified') {
        fileChange.beforeContent = await getFileContent(git, base, file.file);
        fileChange.afterContent = await getFileContent(git, head, file.file);
      } else if (fileChange.status === 'renamed') {
        // For renames, we need to handle the old path
        const renameInfo = await getRenameInfo(git, base, head, file.file);
        if (renameInfo) {
          fileChange.oldPath = renameInfo.oldPath;
          fileChange.beforeContent = await getFileContent(
            git,
            base,
            renameInfo.oldPath
          );
          fileChange.afterContent = await getFileContent(git, head, file.file);
        }
      }

      files.push(fileChange);
    }

    return {
      base,
      head,
      files,
      summary: {
        filesChanged: diff.files.length,
        insertions: diff.insertions,
        deletions: diff.deletions,
      },
      workingDirectory: workingDir || process.cwd(),
      command: `git diff ${base}...${head}`,
      executedAt: new Date(),
      success: true,
    };
  } catch (error) {
    throw new Error(formatError(error, 'Git analysis failed'));
  }
}

function determineFileStatus(file: any): GitFileChange['status'] {
  if (file.binary) {
    // For binary files, we need to check insertions/deletions
    if (file.insertions > 0 && file.deletions === 0) return GitFileStatus.ADDED;
    if (file.insertions === 0 && file.deletions > 0) return GitFileStatus.DELETED;
    return GitFileStatus.MODIFIED;
  }

  // For text files, use insertions/deletions pattern
  if (file.insertions > 0 && file.deletions === 0) return GitFileStatus.ADDED;
  if (file.insertions === 0 && file.deletions > 0) return GitFileStatus.DELETED;
  return GitFileStatus.MODIFIED;
}

async function getFileDiff(
  git: SimpleGit,
  base: string,
  head: string,
  filePath: string
): Promise<string> {
  try {
    // Handle special case: EMPTY_TREE_HASH cannot be used in range expressions
    if (base === EMPTY_TREE_HASH) {
      return await git.diff([EMPTY_TREE_HASH, head, '--', filePath]);
    } else {
      return await git.diff([`${base}...${head}`, '--', filePath]);
    }
  } catch (error) {
    // If we can't get the diff for this file, return empty string
    console.warn(formatError(error, `Could not get diff for file ${filePath}`));
    return '';
  }
}

async function getFileContent(
  git: SimpleGit,
  ref: string,
  filePath: string
): Promise<string | undefined> {
  try {
    return await git.show([`${ref}:${filePath}`]);
  } catch (error) {
    // File doesn't exist at this ref (normal for added/deleted files)
    return undefined;
  }
}

async function getRenameInfo(
  git: SimpleGit,
  base: string,
  head: string,
  currentPath: string
): Promise<{ oldPath: string } | null> {
  try {
    // Get detailed diff with rename detection
    let diffArgs: string[];
    if (base === EMPTY_TREE_HASH) {
      diffArgs = ['diff', '--name-status', '-M', EMPTY_TREE_HASH, head];
    } else {
      diffArgs = ['diff', '--name-status', '-M', `${base}...${head}`];
    }
    const diffOutput = await git.raw(diffArgs);

    for (const line of diffOutput.split('\n')) {
      const parts = line.trim().split('\t');
      if (parts.length >= 3 && parts[0].startsWith('R')) {
        const [, oldPath, newPath] = parts;
        if (newPath === currentPath) {
          return { oldPath };
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(formatError(error, `Could not detect rename info for ${currentPath}`));
    return null;
  }
}

export async function validateGitRepository(
  workingDir?: string
): Promise<boolean> {
  try {
    const git = createGit(workingDir);
    await git.checkIsRepo();
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(workingDir?: string): Promise<string> {
  const git = createGit(workingDir);
  try {
    const branch = await git.branch();
    return branch.current;
  } catch (error) {
    throw new Error(formatError(error, 'Failed to get current branch'));
  }
}

export async function validateGitRefs(
  base: string,
  head: string,
  workingDir?: string
): Promise<void> {
  const git = createGit(workingDir);

  try {
    // Check if base ref exists
    await git.raw(['rev-parse', '--verify', base]);
  } catch {
    throw new Error(`Base reference "${base}" does not exist`);
  }

  try {
    // Check if head ref exists
    await git.raw(['rev-parse', '--verify', head]);
  } catch {
    throw new Error(`Head reference "${head}" does not exist`);
  }
}

export async function isHeadMergeCommit(workingDir?: string): Promise<boolean> {
  const git = createGit(workingDir);
  try {
    // Get parent count for HEAD commit
    const output = await git.raw(['rev-list', '--parents', '-n', '1', 'HEAD']);
    const parentCount = output.trim().split(' ').length - 1; // Subtract 1 for the commit hash itself
    return parentCount >= 2; // Merge commits have 2+ parents
  } catch (error) {
    console.warn(formatError(error, 'Failed to check if HEAD is merge commit'));
    return false;
  }
}

export async function getSmartBaseForMainBranch(workingDir?: string): Promise<string> {
  const isMergeCommit = await isHeadMergeCommit(workingDir);
  if (isMergeCommit) {
    // Merge commit: use first parent (main before merge)
    return 'HEAD^1';
  } else {
    // Regular commit: use previous commit
    return 'HEAD~1';
  }
}

// New context-driven reference resolution functions

export function detectExecutionContext(context: GitContext): 'github-pr' | 'github-main' | 'manual' {
  const { env } = context;
  
  // Check for GitHub PR context
  if (env.GITHUB_BASE_REF || env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA) {
    return 'github-pr';
  }
  
  // Check for GitHub main branch push context
  if (env.GITHUB_ACTIONS && env.GITHUB_REF === 'refs/heads/main') {
    return 'github-main';
  }
  
  return 'manual';
}

export async function selectReferences(contextType: string, context: GitContext): Promise<ReferenceSelection> {
  switch (contextType) {
    case 'github-pr':
      return selectGitHubPRRefs(context);
    case 'github-main':
      return await selectMainBranchRefs(context);
    case 'manual':
      return selectManualRefs(context);
    default:
      throw new Error(`Unknown context type: ${contextType}`);
  }
}

function selectGitHubPRRefs(context: GitContext): ReferenceSelection {
  const { env } = context;
  
  if (env.GITHUB_BASE_REF) {
    return {
      base: `origin/${env.GITHUB_BASE_REF}`,
      head: 'HEAD',
      strategy: 'github-pr-base-ref'
    };
  }
  
  if (env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA) {
    return {
      base: env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA,
      head: 'HEAD',
      strategy: 'github-pr-base-sha'
    };
  }
  
  throw new Error('GitHub PR context detected but no base reference found');
}

async function selectMainBranchRefs(context: GitContext): Promise<ReferenceSelection> {
  const isMergeCommit = await isHeadMergeCommit(context.workingDir);
  
  if (isMergeCommit) {
    return {
      base: 'HEAD^1',
      head: 'HEAD',
      strategy: 'merge-commit'
    };
  } else {
    return {
      base: 'HEAD~1', 
      head: 'HEAD',
      strategy: 'regular-commit'
    };
  }
}

function selectManualRefs(context: GitContext): ReferenceSelection {
  const { options } = context;
  
  return {
    base: options.base || DEFAULT_BASE_BRANCH,
    head: options.head || DEFAULT_HEAD_BRANCH,
    strategy: 'manual'
  };
}

export async function validateReferences(selection: ReferenceSelection, workingDir: string): Promise<ReferenceSelection> {
  const git = createGit(workingDir);
  
  try {
    // Validate base reference
    await git.raw(['rev-parse', '--verify', selection.base]);
    return selection; // All good
  } catch {
    // 80/20: Only handle the critical cases (shallow clone, initial commit)
    if (selection.strategy === 'merge-commit' || selection.strategy === 'regular-commit') {
      return {
        ...selection,
        base: EMPTY_TREE_HASH,
        strategy: `${selection.strategy}-fallback`
      };
    }
    
    // For other cases, re-throw the error with context
    throw new Error(`Base reference "${selection.base}" does not exist`);
  }
}

export async function resolveGitReferences(context: GitContext): Promise<ReferenceSelection> {
  const contextType = detectExecutionContext(context);
  const selection = await selectReferences(contextType, context);
  return await validateReferences(selection, context.workingDir);
}
