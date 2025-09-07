import { validateConfig, validateConfigs } from '../config';
import { EvalConfig } from '../types';

describe('config validation', () => {
  const validConfig: EvalConfig = {
    name: 'test-config',
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'test-rule': {
        name: 'test-rule',
        metricId: '12345678-1234-5678-9012-123456789012',
        threshold: 0.5,
      },
    },
  };

  describe('validateConfig', () => {
    it('should pass for valid configuration', () => {
      const result = validateConfig(validConfig);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing name', () => {
      const config = { ...validConfig, name: '' };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Configuration must have a "name" property of type string'
      );
    });

    it('should fail for invalid UUID', () => {
      const config = {
        ...validConfig,
        rules: {
          'test-rule': {
            name: 'test-rule',
            metricId: 'invalid-uuid',
          },
        },
      };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Rule "test-rule" metricId "invalid-uuid" is not a valid UUID'
      );
    });

    it('should fail for threshold outside range', () => {
      const config = {
        ...validConfig,
        rules: {
          'test-rule': {
            name: 'test-rule',
            metricId: '12345678-1234-5678-9012-123456789012',
            threshold: 2.0,
          },
        },
      };
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Rule "test-rule" threshold must be between -1 and 1'
      );
    });

    it('should warn for empty files array', () => {
      const config = { ...validConfig, files: [] };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Configuration has empty "files" array - no files will be evaluated'
      );
    });

    it('should warn for no rules', () => {
      const config = { ...validConfig, rules: {} };
      const result = validateConfig(config);
      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Configuration has no rules defined');
    });
  });

  describe('validateConfigs', () => {
    it('should pass for valid configurations', () => {
      const configs = [validConfig];
      const result = validateConfigs(configs);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for duplicate configuration names', () => {
      const configs = [validConfig, { ...validConfig }];
      const result = validateConfigs(configs);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Duplicate configuration name: "test-config"'
      );
    });

    it('should fail for empty configuration array', () => {
      const result = validateConfigs([]);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'At least one configuration must be provided'
      );
    });

    it('should aggregate errors from individual configs', () => {
      const invalidConfig = { ...validConfig, name: '' };
      const configs = [invalidConfig];
      const result = validateConfigs(configs);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Config 1 (unnamed): Configuration must have a "name" property of type string'
      );
    });
  });
});
