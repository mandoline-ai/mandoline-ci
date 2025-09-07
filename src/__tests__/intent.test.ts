import { extractIntent } from '../intent';

describe('intent extraction', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.GITHUB_PR_NUMBER;
    delete process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER;
    delete process.env.GITHUB_REF;
    delete process.env.GITHUB_EVENT_PATH;
  });

  it('should return manual intent', async () => {
    const result = await extractIntent('main', 'feature', 'Test manual intent');

    expect(result.source).toBe('manual');
    expect(result.content).toBe('Test manual intent');
  });

  it('should extract GitHub PR number from GITHUB_REF', async () => {
    process.env.GITHUB_REF = 'refs/pull/123/merge';

    const result = await extractIntent('main', 'feature');

    expect(result.source).toBe('github_pr');
    expect(result.content).toBe('Implement changes from GitHub PR #123');
  });

  it('should use GitHub PR number directly', async () => {
    process.env.GITHUB_PR_NUMBER = '456';

    const result = await extractIntent('main', 'feature');

    expect(result.source).toBe('github_pr');
    expect(result.content).toBe('Implement changes from GitHub PR #456');
  });

  it('should throw when no sources available', async () => {
    // Use same ref for base and head to simulate no commits
    await expect(extractIntent('HEAD', 'HEAD')).rejects.toThrow(
      'Unable to extract intent'
    );
  });

  it('should handle git errors gracefully', async () => {
    // Use invalid refs that will cause git errors
    await expect(extractIntent('nonexistent-branch', 'another-nonexistent-branch')).rejects.toThrow(
      'Unable to extract intent'
    );
  });
});
