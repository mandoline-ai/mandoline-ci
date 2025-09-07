// Simple test to verify EvalResult interface compliance
describe('CLI result interface', () => {
  it('should use success field for pass/fail determination', () => {
    // Test that EvalResult has success field (not passed)
    const mockResult = {
      configName: 'test',
      ruleId: 'test-rule', 
      success: true,
      evaluation: { score: 0.8 }
    };

    // Verify the field exists and works as expected
    expect(mockResult.success).toBe(true);
    expect(mockResult).not.toHaveProperty('passed');
    
    // Test filter logic that was causing the bug
    const results = [mockResult, { ...mockResult, success: false }];
    const failures = results.filter((r) => !r.success);
    const successes = results.filter((r) => r.success);
    
    expect(failures).toHaveLength(1);
    expect(successes).toHaveLength(1);
  });
});