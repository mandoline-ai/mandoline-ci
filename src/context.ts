import { getPackageVersion } from './utils.js';

export function getEnvironmentContext(
  intentSource: string
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    client: 'mandoline-ci',
    client_version: getPackageVersion(import.meta.url),
    intent_source: intentSource,
    environment: process.env.CI ? 'ci' : 'local',
  };

  // Add GitHub Actions context if available
  if (process.env.GITHUB_ACTIONS) {
    context.github_repository = process.env.GITHUB_REPOSITORY;
    context.github_ref = process.env.GITHUB_REF;
    context.github_sha = process.env.GITHUB_SHA;
    context.github_workflow = process.env.GITHUB_WORKFLOW;
  }

  return context;
}
