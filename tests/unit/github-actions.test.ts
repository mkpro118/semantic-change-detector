#!/usr/bin/env bun

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  convertToAnnotations,
  formatAnnotation,
  formatForGitHubActions,
  mapSeverityToAnnotationType,
  type GitHubActionsAnnotation,
} from '../../src/formatters/github-actions.js';
import type { AnalysisResult } from '../../src/types/index.js';
import { logger } from '../../src/utils/logger.js';

describe('GitHub Actions Formatter', () => {
  let outputSpy: ReturnType<typeof spyOn>;
  let consoleLogSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    outputSpy = spyOn(logger, 'output').mockImplementation(() => {});
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    outputSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('mapSeverityToAnnotationType', () => {
    test('maps low severity to notice', () => {
      expect(mapSeverityToAnnotationType('low')).toBe('notice');
    });

    test('maps medium severity to warning', () => {
      expect(mapSeverityToAnnotationType('medium')).toBe('warning');
    });

    test('maps high severity to error', () => {
      expect(mapSeverityToAnnotationType('high')).toBe('error');
    });
  });

  describe('formatAnnotation', () => {
    test('formats basic annotation correctly', () => {
      const annotation: GitHubActionsAnnotation = {
        type: 'warning',
        file: 'src/utils.ts',
        line: 42,
        title: 'Function signature changed',
        message: 'Function add parameter count changed from 2 to 3',
      };

      const expected =
        '::warning file=src/utils.ts,line=42,title=Function signature changed::Function add parameter count changed from 2 to 3';
      expect(formatAnnotation(annotation)).toBe(expected);
    });

    test('formats annotation with endLine', () => {
      const annotation: GitHubActionsAnnotation = {
        type: 'error',
        file: 'src/components/Button.tsx',
        line: 15,
        endLine: 20,
        title: 'Component structure changed',
        message: 'JSX structure modified, may affect rendering',
      };

      const expected =
        '::error file=src/components/Button.tsx,line=15,endLine=20,title=Component structure changed::JSX structure modified, may affect rendering';
      expect(formatAnnotation(annotation)).toBe(expected);
    });

    test('formats notice annotation', () => {
      const annotation: GitHubActionsAnnotation = {
        type: 'notice',
        file: 'src/types.ts',
        line: 8,
        title: 'Type definition changed',
        message: 'Interface property added: newField',
      };

      const expected =
        '::notice file=src/types.ts,line=8,title=Type definition changed::Interface property added: newField';
      expect(formatAnnotation(annotation)).toBe(expected);
    });

    test('escapes special characters in file paths and messages', () => {
      const annotation: GitHubActionsAnnotation = {
        type: 'warning',
        file: 'src/folder with spaces/utils.ts',
        line: 1,
        title: 'Change with "quotes"',
        message: 'Message with newlines\nand :: colons',
      };

      const result = formatAnnotation(annotation);
      expect(result).toContain('src/folder with spaces/utils.ts');
      expect(result).not.toContain('\n'); // Should escape or handle newlines
    });
  });

  describe('convertToAnnotations', () => {
    test('converts analysis result with multiple changes to annotations', () => {
      const result: AnalysisResult = {
        requiresTests: true,
        summary: 'Test summary',
        filesAnalyzed: 2,
        totalChanges: 3,
        severityBreakdown: { high: 1, medium: 1, low: 1 },
        highSeverityChanges: 1,
        topChangeTypes: [],
        criticalChanges: [],
        changes: [
          {
            file: 'src/utils.ts',
            line: 42,
            column: 10,
            kind: 'functionSignatureChanged',
            detail: 'Function add parameter count changed from 2 to 3',
            severity: 'high',
            astNode: 'FunctionDeclaration',
          },
          {
            file: 'src/components/Button.tsx',
            line: 15,
            column: 5,
            kind: 'jsxPropsChanged',
            detail: 'Props structure modified',
            severity: 'medium',
            astNode: 'JSXElement',
          },
          {
            file: 'src/types.ts',
            line: 8,
            column: 1,
            kind: 'typeDefinitionChanged',
            detail: 'Interface property added: newField',
            severity: 'low',
            astNode: 'InterfaceDeclaration',
          },
        ],
        failedFiles: [],
        hasReactChanges: true,
        performance: { analysisTimeMs: 100, memoryUsageMB: 50 },
      };

      const annotations = convertToAnnotations(result);

      expect(annotations).toHaveLength(3);

      // Check high severity -> error
      expect(annotations[0]).toEqual({
        type: 'error',
        file: 'src/utils.ts',
        line: 42,
        title: 'functionSignatureChanged',
        message: 'Function add parameter count changed from 2 to 3',
      });

      // Check medium severity -> warning
      expect(annotations[1]).toEqual({
        type: 'warning',
        file: 'src/components/Button.tsx',
        line: 15,
        title: 'jsxPropsChanged',
        message: 'Props structure modified',
      });

      // Check low severity -> notice
      expect(annotations[2]).toEqual({
        type: 'notice',
        file: 'src/types.ts',
        line: 8,
        title: 'typeDefinitionChanged',
        message: 'Interface property added: newField',
      });
    });

    test('handles empty analysis result', () => {
      const result: AnalysisResult = {
        requiresTests: false,
        summary: 'No changes',
        filesAnalyzed: 0,
        totalChanges: 0,
        severityBreakdown: { high: 0, medium: 0, low: 0 },
        highSeverityChanges: 0,
        topChangeTypes: [],
        criticalChanges: [],
        changes: [],
        failedFiles: [],
        hasReactChanges: false,
        performance: { analysisTimeMs: 10, memoryUsageMB: 20 },
      };

      const annotations = convertToAnnotations(result);
      expect(annotations).toHaveLength(0);
    });

    test('groups multiple changes in same file', () => {
      const result: AnalysisResult = {
        requiresTests: true,
        summary: 'Multiple changes in one file',
        filesAnalyzed: 1,
        totalChanges: 2,
        severityBreakdown: { high: 0, medium: 2, low: 0 },
        highSeverityChanges: 0,
        topChangeTypes: [],
        criticalChanges: [],
        changes: [
          {
            file: 'src/utils.ts',
            line: 10,
            column: 1,
            kind: 'functionAdded',
            detail: 'New function helper() added',
            severity: 'medium',
            astNode: 'FunctionDeclaration',
          },
          {
            file: 'src/utils.ts',
            line: 25,
            column: 1,
            kind: 'variableDeclarationChanged',
            detail: 'Variable type changed from string to number',
            severity: 'medium',
            astNode: 'VariableDeclaration',
          },
        ],
        failedFiles: [],
        hasReactChanges: false,
        performance: { analysisTimeMs: 50, memoryUsageMB: 30 },
      };

      const annotations = convertToAnnotations(result);
      expect(annotations).toHaveLength(2);
      expect(annotations[0].file).toBe('src/utils.ts');
      expect(annotations[0].line).toBe(10);
      expect(annotations[1].file).toBe('src/utils.ts');
      expect(annotations[1].line).toBe(25);
    });
  });

  describe('formatForGitHubActions', () => {
    test('formats complete analysis result as GitHub Actions commands', () => {
      const result: AnalysisResult = {
        requiresTests: true,
        summary: 'Test changes',
        filesAnalyzed: 1,
        totalChanges: 2,
        severityBreakdown: { high: 1, medium: 0, low: 1 },
        highSeverityChanges: 1,
        topChangeTypes: [],
        criticalChanges: [],
        changes: [
          {
            file: 'src/math.ts',
            line: 5,
            column: 1,
            kind: 'functionRemoved',
            detail: 'Function subtract was removed',
            severity: 'high',
            astNode: 'FunctionDeclaration',
          },
          {
            file: 'src/math.ts',
            line: 12,
            column: 1,
            kind: 'commentAdded',
            detail: 'Documentation comment added',
            severity: 'low',
            astNode: 'Comment',
          },
        ],
        failedFiles: [],
        hasReactChanges: false,
        performance: { analysisTimeMs: 25, memoryUsageMB: 15 },
      };

      const commands = formatForGitHubActions(result);
      expect(commands).toHaveLength(2);
      expect(commands[0]).toContain('::error file=src/math.ts,line=5');
      expect(commands[0]).toContain('Function subtract was removed');
      expect(commands[1]).toContain('::notice file=src/math.ts,line=12');
      expect(commands[1]).toContain('Documentation comment added');
    });

    test('handles analysis result with no changes', () => {
      const result: AnalysisResult = {
        requiresTests: false,
        summary: 'No changes',
        filesAnalyzed: 0,
        totalChanges: 0,
        severityBreakdown: { high: 0, medium: 0, low: 0 },
        highSeverityChanges: 0,
        topChangeTypes: [],
        criticalChanges: [],
        changes: [],
        failedFiles: [],
        hasReactChanges: false,
        performance: { analysisTimeMs: 5, memoryUsageMB: 10 },
      };

      const commands = formatForGitHubActions(result);
      expect(commands).toHaveLength(0);
    });
  });

  describe('Integration with logger output', () => {
    test('logger.output method exists and can be called', () => {
      // Don't mock logger.output for this test, let it call through to console.log
      outputSpy.mockRestore();
      logger.output('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('test message');
    });

    test('logger.output always writes regardless of log level', () => {
      // Don't mock logger.output for this test, let it call through to console.log
      outputSpy.mockRestore();
      logger.setLevel(0); // QUIET level
      logger.output('test output');
      expect(consoleLogSpy).toHaveBeenCalledWith('test output');
    });
  });
});

describe('GitHub Actions Output Format Integration', () => {
  test('validates exact GitHub Actions annotation format', () => {
    const annotation: GitHubActionsAnnotation = {
      type: 'warning',
      file: 'src/example.ts',
      line: 42,
      endLine: 45,
      title: 'Semantic Change Detected',
      message: 'Function signature modified - tests may be required',
    };

    const formatted = formatAnnotation(annotation);

    // Exact format validation
    expect(formatted).toMatch(/^::warning file=.+,line=\d+,endLine=\d+,title=.+::.+$/);
    expect(formatted).toBe(
      '::warning file=src/example.ts,line=42,endLine=45,title=Semantic Change Detected::Function signature modified - tests may be required',
    );
  });

  test('validates all severity mappings work correctly', () => {
    const severities = ['low', 'medium', 'high'] as const;
    const expectedTypes = ['notice', 'warning', 'error'] as const;

    severities.forEach((severity, index) => {
      expect(mapSeverityToAnnotationType(severity)).toBe(expectedTypes[index]);
    });
  });

  test('handles complex real-world scenario', () => {
    const complexResult: AnalysisResult = {
      requiresTests: true,
      summary: 'Complex changes requiring tests',
      filesAnalyzed: 3,
      totalChanges: 5,
      severityBreakdown: { high: 2, medium: 2, low: 1 },
      highSeverityChanges: 2,
      topChangeTypes: [
        { kind: 'functionSignatureChanged', count: 2, maxSeverity: 'high' },
        { kind: 'jsxPropsChanged', count: 1, maxSeverity: 'medium' },
      ],
      criticalChanges: [],
      changes: [
        {
          file: 'src/api/client.ts',
          line: 15,
          column: 1,
          kind: 'functionSignatureChanged',
          detail: 'API method fetchUser signature changed - breaking change',
          severity: 'high',
          astNode: 'MethodDefinition',
        },
        {
          file: 'src/components/UserCard.tsx',
          line: 28,
          column: 5,
          kind: 'jsxPropsChanged',
          detail: 'UserCard component props interface updated',
          severity: 'medium',
          astNode: 'JSXElement',
        },
        {
          file: 'src/components/UserCard.tsx',
          line: 45,
          column: 10,
          kind: 'hookDependencyChanged',
          detail: 'useEffect dependency array modified',
          severity: 'high',
          astNode: 'CallExpression',
        },
        {
          file: 'src/utils/validation.ts',
          line: 8,
          column: 1,
          kind: 'functionAdded',
          detail: 'New validation function validateEmail added',
          severity: 'medium',
          astNode: 'FunctionDeclaration',
        },
        {
          file: 'src/constants.ts',
          line: 12,
          column: 1,
          kind: 'variableDeclarationChanged',
          detail: 'Constant API_VERSION updated',
          severity: 'low',
          astNode: 'VariableDeclaration',
        },
      ],
      failedFiles: [],
      hasReactChanges: true,
      performance: { analysisTimeMs: 150, memoryUsageMB: 75 },
    };

    const formatted = formatForGitHubActions(complexResult);

    expect(formatted).toHaveLength(5);

    // Check that high severity changes become errors
    const errorAnnotations = formatted.filter((cmd) => cmd.startsWith('::error'));
    expect(errorAnnotations).toHaveLength(2);

    // Check that medium severity changes become warnings
    const warningAnnotations = formatted.filter((cmd) => cmd.startsWith('::warning'));
    expect(warningAnnotations).toHaveLength(2);

    // Check that low severity changes become notices
    const noticeAnnotations = formatted.filter((cmd) => cmd.startsWith('::notice'));
    expect(noticeAnnotations).toHaveLength(1);

    // Verify specific annotation content
    expect(errorAnnotations[0]).toContain('src/api/client.ts');
    expect(errorAnnotations[0]).toContain('line=15');
    expect(errorAnnotations[0]).toContain('API method fetchUser signature changed');

    expect(warningAnnotations[0]).toContain('src/components/UserCard.tsx');
    expect(warningAnnotations[0]).toContain('line=28');

    expect(noticeAnnotations[0]).toContain('src/constants.ts');
    expect(noticeAnnotations[0]).toContain('line=12');
  });
});
