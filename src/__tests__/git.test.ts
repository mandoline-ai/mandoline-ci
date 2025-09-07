import { validateGitRepository, getCurrentBranch, isHeadMergeCommit, getSmartBaseForMainBranch } from '../git';

describe('git utilities', () => {
  describe('validateGitRepository', () => {
    it('should return true for valid git repository', async () => {
      // This test runs in the project directory which should be a git repo
      const isValid = await validateGitRepository();
      expect(isValid).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      // Test with a path that definitely doesn't exist as a git repo
      const isValid = await validateGitRepository('/non/existent/path');
      expect(isValid).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const branch = await getCurrentBranch();
      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
    });
  });

  describe('isHeadMergeCommit', () => {
    // Test using the actual git repository - this is an integration test
    it('should detect merge commit correctly', async () => {
      // This test will vary based on the current repository state
      // We'll just verify the function runs without error and returns a boolean
      const result = await isHeadMergeCommit();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getSmartBaseForMainBranch', () => {
    it('should return HEAD^1 or HEAD~1 based on merge status', async () => {
      // This is more of an integration test - verify it returns a valid git ref
      const result = await getSmartBaseForMainBranch();
      expect(['HEAD^1', 'HEAD~1']).toContain(result);
    });
  });
});
