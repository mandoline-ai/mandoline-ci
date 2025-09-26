import { jest } from '@jest/globals';
import type { Mandoline } from 'mandoline';

import * as configModule from '../config';
import {
  executeEvaluations,
  prepareEvaluationContext,
  validateSetupEnvironment,
} from '../core';
import * as gitModule from '../git';
import * as intentModule from '../intent';
import {
  EvalConfig,
  GitDiffResult,
  GitFileChange,
  GitFileStatus,
  IntentSource,
} from '../types';

const mockGlobby = jest.fn(
  async (...args: unknown[]): Promise<string[]> => {
    void args;
    return [];
  }
);

jest.mock('globby', () => ({
  globby: (...args: unknown[]) => mockGlobby(...args),
}));

jest.mock('../context', () => ({
  getEnvironmentContext: () => ({}),
}));

describe('core pipeline helpers', () => {
  const workingDirectory = process.cwd();
  const base = 'main';
  const head = 'feature/refactor';

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockGlobby.mockReset();
  });

  describe('prepareEvaluationContext', () => {
    it('returns configs, intent, and git diff for valid setup', async () => {
      const configs: EvalConfig[] = [
        {
          name: 'src',
          files: ['src/**/*.ts'],
          rules: {
            quality: {
              name: 'quality',
              metricId: '12345678-1234-5678-9012-123456789012',
            },
          },
        },
      ];

      const intentSource: IntentSource = {
        source: 'manual',
        content: 'Implement feature',
        success: true,
        confidence: 1,
        extractedAt: new Date(),
      };

      const gitDiff: GitDiffResult = {
        base,
        head,
        files: [],
        summary: { filesChanged: 0, insertions: 0, deletions: 0 },
        workingDirectory,
        command: '',
        executedAt: new Date(),
        success: true,
      };

      jest.spyOn(gitModule, 'validateGitRefs').mockResolvedValue();
      jest
        .spyOn(configModule, 'discoverConfig')
        .mockResolvedValue(configs);
      jest
        .spyOn(configModule, 'validateConfigs')
        .mockReturnValue({ success: true, errors: [], warnings: [] });
      jest
        .spyOn(intentModule, 'extractIntent')
        .mockResolvedValue(intentSource);
      jest
        .spyOn(gitModule, 'analyzeGitDiff')
        .mockResolvedValue(gitDiff);

      const result = await prepareEvaluationContext({
        base,
        head,
        manualIntent: 'Implement feature',
        workingDirectory,
      });

      expect(result.configs).toEqual(configs);
      expect(result.intentSource).toBe(intentSource);
      expect(result.gitDiff).toBe(gitDiff);
      expect(gitModule.validateGitRefs).toHaveBeenCalledWith(
        base,
        head,
        workingDirectory
      );
    });

    it('throws when configuration validation fails', async () => {
      jest.spyOn(gitModule, 'validateGitRefs').mockResolvedValue();
      jest.spyOn(configModule, 'discoverConfig').mockResolvedValue([]);
      jest.spyOn(configModule, 'validateConfigs').mockReturnValue({
        success: false,
        errors: ['Bad config'],
        warnings: [],
      });

      await expect(
        prepareEvaluationContext({
          base,
          head,
          workingDirectory,
        })
      ).rejects.toThrow('Configuration validation failed: Bad config');
    });
  });

  describe('executeEvaluations', () => {
    const gitFile: GitFileChange = {
      path: 'src/index.ts',
      status: GitFileStatus.MODIFIED,
      beforeContent: 'console.log(1);',
      afterContent: 'console.log(2);',
      diff: 'diff --git',
    };

    const gitDiff: GitDiffResult = {
      base,
      head,
      files: [gitFile],
      summary: { filesChanged: 1, insertions: 1, deletions: 0 },
      workingDirectory,
      command: '',
      executedAt: new Date(),
      success: true,
    };

    const intentSource: IntentSource = {
      source: 'manual',
      content: 'Implement feature',
      success: true,
      confidence: 1,
      extractedAt: new Date(),
    };

    const config: EvalConfig = {
      name: 'src',
      files: ['src/**/*.ts'],
      rules: {
        quality: {
          name: 'quality',
          metricId: '12345678-1234-5678-9012-123456789012',
        },
      },
    };

    it('evaluates matching files and returns results', async () => {
      mockGlobby.mockResolvedValue(['src/index.ts']);

      const mockClient = {
        createEvaluation: jest.fn(async () => ({
          score: 0.5,
          properties: {},
        })),
      } as unknown as Mandoline;

      const results = await executeEvaluations({
        base,
        configs: [config],
        intentSource,
        gitDiff,
        workingDirectory,
        client: mockClient,
      });

      expect(mockGlobby).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].ruleId).toBe('quality');
    });

    it('honors minimize score objective when evaluating success', async () => {
      mockGlobby.mockResolvedValue(['src/index.ts']);

      const minimizingConfig: EvalConfig = {
        name: 'src',
        files: ['src/**/*.ts'],
        rules: {
          regression: {
            name: 'regression',
            metricId: '12345678-1234-5678-9012-123456789012',
            threshold: 0.2,
            scoreObjective: 'minimize',
          },
        },
      };

      const clientImpl = {
        createEvaluation: jest.fn(async (payload: unknown) => ({
          score: 0.1,
          properties: (payload as { properties?: Record<string, unknown> })
            .properties,
        })),
      };

      const mockClient = clientImpl as unknown as Mandoline;

      const passResults = await executeEvaluations({
        base,
        configs: [minimizingConfig],
        intentSource,
        gitDiff,
        workingDirectory,
        client: mockClient,
      });

      expect(passResults[0].success).toBe(true);
      expect(passResults[0].scoreObjective).toBe('minimize');
      const firstCall = clientImpl.createEvaluation.mock.calls[0]?.[0] as {
        properties?: Record<string, unknown>;
      };
      expect(firstCall?.properties).toEqual(
        expect.objectContaining({ threshold: 0.2, scoreObjective: 'minimize' })
      );

      clientImpl.createEvaluation.mockReset().mockImplementation(
        async (payload: unknown) => ({
          score: 0.3,
          properties: (payload as { properties?: Record<string, unknown> })
            .properties,
        })
      );

      const failResults = await executeEvaluations({
        base,
        configs: [minimizingConfig],
        intentSource,
        gitDiff,
        workingDirectory,
        client: mockClient,
      });

      expect(failResults[0].success).toBe(false);
    });

    it('skips configs with no matching files', async () => {
      mockGlobby.mockResolvedValue([]);

      const mockClient = {
        createEvaluation: jest.fn(),
      } as unknown as Mandoline;

      const results = await executeEvaluations({
        base,
        configs: [config],
        intentSource,
        gitDiff,
        workingDirectory,
        client: mockClient,
      });

      expect(results).toHaveLength(0);
      expect(mockClient.createEvaluation).not.toHaveBeenCalled();
    });
  });

  describe('validateSetupEnvironment', () => {
    it('aggregates warnings and errors from validation', async () => {
      const mockClient = {
        getMetrics: jest.fn(async () => ({ data: [] })),
      } as unknown as Mandoline;

      jest
        .spyOn(gitModule, 'validateGitRepository')
        .mockResolvedValue(true);
      jest
        .spyOn(configModule, 'discoverConfig')
        .mockResolvedValue([]);
      jest.spyOn(configModule, 'validateConfigs').mockReturnValue({
        success: false,
        errors: ['Missing rule'],
        warnings: ['No files'],
      });

      const result = await validateSetupEnvironment({
        client: mockClient,
        workingDirectory,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing rule');
      expect(result.warnings).toContain('No files');
    });

    it('reports API connectivity issues', async () => {
      const mockClient = {
        getMetrics: jest.fn(async () => {
          throw new Error('Unauthorized');
        }),
      } as unknown as Mandoline;

      jest
        .spyOn(gitModule, 'validateGitRepository')
        .mockResolvedValue(false);
      jest
        .spyOn(configModule, 'discoverConfig')
        .mockRejectedValue(new Error('Missing config'));

      const result = await validateSetupEnvironment({
        client: mockClient,
        workingDirectory,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Working directory is not a git repository',
          'API connection failed: Unauthorized',
          'Configuration discovery failed: Missing config',
        ])
      );
    });
  });
});
