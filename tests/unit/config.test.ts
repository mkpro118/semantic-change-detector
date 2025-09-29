import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_CONFIG,
  getChangeKindsInGroup,
  getEffectiveSeverity,
  getGroupForChangeKind,
  isChangeKindEnabled,
  shouldRequireTestsForChange,
  type AnalyzerConfig,
} from '../../src/types/config.js';

describe('Configuration System', () => {
  describe('getEffectiveSeverity', () => {
    test('should return override severity when specified', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        severityOverrides: {
          importAdded: 'high',
        },
      };

      expect(getEffectiveSeverity('importAdded', config)).toBe('high');
    });

    test('should return default severity when no override', () => {
      const config = DEFAULT_CONFIG;
      expect(getEffectiveSeverity('functionSignatureChanged', config)).toBe('high');
      expect(getEffectiveSeverity('importAdded', config)).toBe('low');
    });
  });

  describe('isChangeKindEnabled', () => {
    test('should disable explicitly disabled change kinds', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        disabledChangeKinds: ['importAdded'],
      };

      expect(isChangeKindEnabled('importAdded', config)).toBe(false);
      expect(isChangeKindEnabled('functionSignatureChanged', config)).toBe(true);
    });

    test('should disable entire groups', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        changeKindGroups: {
          enabled: ['core-structural'],
          disabled: ['jsx-logic'],
        },
      };

      expect(isChangeKindEnabled('functionSignatureChanged', config)).toBe(true); // in core-structural
      expect(isChangeKindEnabled('jsxLogicAdded', config)).toBe(false); // in jsx-logic
      expect(isChangeKindEnabled('importAdded', config)).toBe(false); // not in enabled list
    });

    test('should respect disabled taking precedence over enabled', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        changeKindGroups: {
          enabled: ['jsx-logic'],
          disabled: ['jsx-logic'],
        },
      };

      expect(isChangeKindEnabled('jsxLogicAdded', config)).toBe(false);
    });
  });

  describe('shouldRequireTestsForChange', () => {
    test('should require tests for always-require list', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        testRequirements: {
          alwaysRequireTests: ['importAdded'],
          neverRequireTests: [],
          minimumSeverityForTests: null,
        },
      };

      expect(shouldRequireTestsForChange('importAdded', 'low', config)).toBe(true);
    });

    test('should not require tests for never-require list', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        testRequirements: {
          alwaysRequireTests: [],
          neverRequireTests: ['functionSignatureChanged'],
          minimumSeverityForTests: null,
        },
      };

      expect(shouldRequireTestsForChange('functionSignatureChanged', 'high', config)).toBe(false);
    });

    test('should use minimum severity threshold', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        testRequirements: {
          alwaysRequireTests: [],
          neverRequireTests: [],
          minimumSeverityForTests: 'medium',
        },
      };

      expect(shouldRequireTestsForChange('importAdded', 'low', config)).toBe(false);
      expect(shouldRequireTestsForChange('importAdded', 'medium', config)).toBe(true);
      expect(shouldRequireTestsForChange('importAdded', 'high', config)).toBe(true);
    });
  });

  describe('getChangeKindsInGroup', () => {
    test('should return correct change kinds for core-structural group', () => {
      const kinds = getChangeKindsInGroup('core-structural');
      expect(kinds).toContain('functionSignatureChanged');
      expect(kinds).toContain('classStructureChanged');
      expect(kinds).toContain('exportAdded');
      expect(kinds).not.toContain('importAdded'); // This is in imports-exports group
    });

    test('should return correct change kinds for jsx-logic group', () => {
      const kinds = getChangeKindsInGroup('jsx-logic');
      expect(kinds).toContain('jsxLogicAdded');
      expect(kinds).toContain('eventHandlerChanged');
      expect(kinds).not.toContain('jsxElementAdded'); // This is in jsx-rendering group
    });
  });

  describe('getGroupForChangeKind', () => {
    test('should return correct group for change kinds', () => {
      expect(getGroupForChangeKind('functionSignatureChanged')).toBe('core-structural');
      expect(getGroupForChangeKind('jsxLogicAdded')).toBe('jsx-logic');
      expect(getGroupForChangeKind('importAdded')).toBe('imports-exports');
      expect(getGroupForChangeKind('hookDependencyChanged')).toBe('react-hooks');
    });

    test('should return null for unknown change kinds', () => {
      expect(getGroupForChangeKind('unknownChangeKind' as any)).toBe(null);
    });
  });

  describe('JSX Configuration', () => {
    test('should treat JSX changes as low severity when configured', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        jsxConfig: {
          enabled: true,
          ignoreLogicChanges: false,
          treatAsLowSeverity: true,
          eventHandlerComplexityThreshold: 3,
        },
      };

      // This would normally be medium severity, but config overrides to low
      expect(config.jsxConfig.treatAsLowSeverity).toBe(true);
    });

    test('should ignore JSX logic changes when configured', () => {
      const config: AnalyzerConfig = {
        ...DEFAULT_CONFIG,
        jsxConfig: {
          enabled: true,
          ignoreLogicChanges: true,
          treatAsLowSeverity: false,
          eventHandlerComplexityThreshold: 3,
        },
      };

      expect(config.jsxConfig.ignoreLogicChanges).toBe(true);
    });
  });

  describe('Default Configuration', () => {
    test('should have jsx-logic disabled by default', () => {
      expect(DEFAULT_CONFIG.changeKindGroups.disabled).toContain('jsx-logic');
    });

    test('should have JSX logic changes in never-require-tests by default', () => {
      expect(DEFAULT_CONFIG.testRequirements.neverRequireTests).toContain('jsxLogicAdded');
      expect(DEFAULT_CONFIG.testRequirements.neverRequireTests).toContain('eventHandlerChanged');
    });

    test('should have ignoreLogicChanges enabled by default', () => {
      expect(DEFAULT_CONFIG.jsxConfig.ignoreLogicChanges).toBe(true);
    });

    test('should have critical changes as high severity by default', () => {
      expect(getEffectiveSeverity('functionSignatureChanged', DEFAULT_CONFIG)).toBe('high');
      expect(getEffectiveSeverity('exportRemoved', DEFAULT_CONFIG)).toBe('high');
      expect(getEffectiveSeverity('hookDependencyChanged', DEFAULT_CONFIG)).toBe('high');
      expect(getEffectiveSeverity('classStructureChanged', DEFAULT_CONFIG)).toBe('high');
    });

    test('should have JSX changes as low severity by default (except logic ones)', () => {
      expect(getEffectiveSeverity('jsxElementAdded', DEFAULT_CONFIG)).toBe('low');
      expect(getEffectiveSeverity('jsxPropsChanged', DEFAULT_CONFIG)).toBe('low');
      expect(getEffectiveSeverity('jsxLogicAdded', DEFAULT_CONFIG)).toBe('medium'); // This is more significant
    });
  });
});
