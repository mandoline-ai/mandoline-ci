import { readFile } from 'fs/promises';

import { IntentSource } from './types.js';
import { createGit, formatError } from './utils.js';
import { EMPTY_TREE_HASH } from './constants.js';

export async function extractIntent(
  base: string,
  head: string,
  manualIntent?: string,
  workingDir?: string
): Promise<IntentSource> {
  if (manualIntent) {
    return {
      source: 'manual',
      content: manualIntent,
      success: true,
      confidence: 1.0,
      extractedAt: new Date(),
    };
  }

  // Try GitHub PR extraction
  const githubIntent = await extractGitHubPRIntent();
  if (githubIntent) {
    return githubIntent;
  }

  // Try commit message extraction
  const commitIntent = await extractCommitIntent(base, head, workingDir);
  if (commitIntent) {
    return commitIntent;
  }

  // No intent found
  throw new Error(
    'Unable to extract intent: no manual intent provided, no GitHub PR detected, and no commits found between base and head'
  );
}

async function extractGitHubPRIntent(): Promise<IntentSource | null> {
  try {
    // Check for GitHub PR environment variables
    const prNumber =
      process.env.GITHUB_PR_NUMBER ||
      process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER ||
      extractPRFromRef(process.env.GITHUB_REF);

    if (!prNumber) {
      return null;
    }

    // Try to get PR description from GitHub event
    let prDescription = await getPRDescriptionFromEvent();

    if (!prDescription) {
      // If we have a PR number but no description, create a generic intent
      prDescription = `Implement changes from GitHub PR #${prNumber}`;
    }

    return {
      source: 'github_pr',
      content: prDescription,
      success: true,
      confidence: 0.8,
      extractedAt: new Date(),
    };
  } catch (error) {
    console.warn(formatError(error, 'Failed to extract GitHub PR intent'));
    return null;
  }
}

function extractPRFromRef(ref?: string): string | null {
  if (!ref) return null;

  // Match refs/pull/{number}/merge or refs/pull/{number}/head
  const match = ref.match(/refs\/pull\/(\d+)\/(merge|head)/);
  return match ? match[1] : null;
}

async function getPRDescriptionFromEvent(): Promise<string | null> {
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) {
      return null;
    }

    const eventData = JSON.parse(await readFile(eventPath, 'utf-8'));

    if (eventData.pull_request?.body) {
      return eventData.pull_request.body;
    }

    if (eventData.pull_request?.title) {
      return eventData.pull_request.title;
    }

    return null;
  } catch (error) {
    console.warn(formatError(error, 'Failed to read GitHub event'));
    return null;
  }
}

async function extractCommitIntent(
  base: string,
  head: string,
  workingDir?: string
): Promise<IntentSource | null> {
  try {
    const git = createGit(workingDir);

    let log;
    
    // Handle special case: EMPTY_TREE_HASH cannot be used in git log ranges
    if (base === EMPTY_TREE_HASH) {
      // For first commit scenarios, just get the HEAD commit message
      log = await git.log({ maxCount: 1 });
    } else {
      // Normal case: get commits between base and head
      log = await git.log({ from: base, to: head });
    }

    if (log.all.length === 0) {
      return null;
    }

    // Get all commit messages and join with newlines
    const messages = log.all.map((commit) => commit.message);

    return {
      source: 'commit_message',
      content: messages.join('\n'),
      success: true,
      confidence: 0.6,
      extractedAt: new Date(),
    };
  } catch (error) {
    console.warn(formatError(error, 'Failed to extract commit intent'));
    return null;
  }
}
