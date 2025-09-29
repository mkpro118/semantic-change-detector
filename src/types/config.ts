import type { SemanticChangeType, SeverityLevel } from './index.js';

/**
 * Configuration groups that logically organize change kinds for easier management.
 * Each group can be enabled/disabled as a unit, with fine-grained overrides available.
 */
export type ChangeKindGroup =
  | 'core-structural' // Functions, classes, exports, interfaces - core API changes
  | 'data-flow' // Variables, assignments, mutations, destructuring
  | 'control-flow' // Conditionals, loops, try-catch, logical operators
  | 'react-hooks' // All React hook related changes
  | 'jsx-rendering' // JSX elements, props, conditional rendering
  | 'jsx-logic' // JSX logical expressions, event handlers
  | 'imports-exports' // Import/export structure changes
  | 'async-patterns' // Promises, async/await, effects
  | 'type-system' // Type definitions, interfaces (type-only changes)
  | 'side-effects' // Function calls, mutations, side effect imports
  | 'complexity' // Complexity metrics and spread operators
  | 'error-handling'; // Try-catch, throw statements

/**
 * Maps change kinds to their logical groups for organization and bulk control.
 */
export const CHANGE_KIND_GROUPS: Record<ChangeKindGroup, SemanticChangeType[]> = {
  'core-structural': [
    'functionAdded',
    'functionRemoved',
    'functionSignatureChanged',
    'classStructureChanged',
    'exportAdded',
    'exportRemoved',
    'exportSignatureChanged',
    'interfaceModified',
  ],
  'data-flow': [
    'variableDeclarationChanged',
    'variableAssignmentChanged',
    'destructuringAdded',
    'destructuringRemoved',
    'arrayMutation',
    'objectMutation',
  ],
  'control-flow': [
    'conditionalAdded',
    'conditionalModified',
    'conditionalRemoved',
    'loopAdded',
    'loopModified',
    'loopRemoved',
    'logicalOperatorChanged',
    'comparisonOperatorChanged',
    'ternaryAdded',
    'ternaryRemoved',
  ],
  'react-hooks': ['hookAdded', 'hookRemoved', 'hookDependencyChanged'],
  'jsx-rendering': [
    'jsxElementAdded',
    'jsxElementRemoved',
    'jsxPropsChanged',
    'componentReferenceChanged',
    'componentStructureChanged',
  ],
  'jsx-logic': ['jsxLogicAdded', 'eventHandlerChanged'],
  'imports-exports': [
    'importAdded',
    'importRemoved',
    'importStructureChanged',
    'sideEffectImportAdded',
  ],
  'async-patterns': [
    'asyncAwaitAdded',
    'asyncAwaitRemoved',
    'promiseAdded',
    'promiseRemoved',
    'effectAdded',
    'effectRemoved',
  ],
  'type-system': ['typeDefinitionChanged'],
  'side-effects': [
    'functionCallAdded',
    'functionCallChanged',
    'functionCallModified',
    'functionCallRemoved',
  ],
  complexity: ['functionComplexityChanged', 'spreadOperatorAdded', 'spreadOperatorRemoved'],
  'error-handling': ['throwAdded', 'throwRemoved', 'tryCatchAdded', 'tryCatchModified'],
};

/**
 * Default severity assignments for each change kind.
 * These represent the baseline production-ready severity levels.
 */
export const DEFAULT_CHANGE_SEVERITIES: Record<SemanticChangeType, SeverityLevel> = {
  // CRITICAL CHANGES - Always require tests
  functionSignatureChanged: 'high',
  exportRemoved: 'high',
  exportSignatureChanged: 'high',
  hookDependencyChanged: 'high',
  functionCallAdded: 'high',
  classStructureChanged: 'high',
  interfaceModified: 'high',
  conditionalAdded: 'high',
  conditionalModified: 'high',
  loopAdded: 'high',
  loopModified: 'high',
  functionComplexityChanged: 'high',

  // SIGNIFICANT CHANGES - Usually require tests
  functionAdded: 'medium',
  exportAdded: 'medium',
  functionRemoved: 'medium',
  hookAdded: 'medium',
  hookRemoved: 'medium',
  variableAssignmentChanged: 'medium',
  arrayMutation: 'medium',
  objectMutation: 'medium',
  conditionalRemoved: 'medium',
  loopRemoved: 'medium',
  functionCallChanged: 'medium',
  functionCallModified: 'medium',
  functionCallRemoved: 'medium',
  asyncAwaitAdded: 'medium',
  asyncAwaitRemoved: 'medium',
  promiseAdded: 'medium',
  promiseRemoved: 'medium',
  throwAdded: 'medium',
  throwRemoved: 'medium',
  tryCatchAdded: 'medium',
  tryCatchModified: 'medium',
  logicalOperatorChanged: 'medium',
  comparisonOperatorChanged: 'medium',
  typeDefinitionChanged: 'medium',
  sideEffectImportAdded: 'medium',
  stateManagementChanged: 'medium',

  // MINOR CHANGES - Often cosmetic but context-dependent
  importAdded: 'low',
  importRemoved: 'low',
  importStructureChanged: 'low',
  variableDeclarationChanged: 'low',
  destructuringAdded: 'low',
  destructuringRemoved: 'low',
  ternaryAdded: 'low',
  ternaryRemoved: 'low',
  spreadOperatorAdded: 'low',
  spreadOperatorRemoved: 'low',
  effectAdded: 'low',
  effectRemoved: 'low',

  // JSX CHANGES - Context dependent, often low unless behavioral
  jsxElementAdded: 'low',
  jsxElementRemoved: 'low',
  jsxPropsChanged: 'low',
  jsxLogicAdded: 'medium', // Conditional rendering is more significant
  componentReferenceChanged: 'medium',
  componentStructureChanged: 'low',
  eventHandlerChanged: 'low', // Often just prop drilling
};

/**
 * Analyzer configuration with granular control over change detection,
 * severity overrides, and group-based enabling/disabling.
 */
export type AnalyzerConfig = {
  /** Glob patterns to include in analysis. */
  include: string[];
  /** Glob patterns to exclude from analysis. */
  exclude: string[];
  /** Patterns of callees considered side-effectful. */
  sideEffectCallees: string[];
  /** Glob patterns for modules considered to have side effects. */
  sideEffectModules: string[];
  /** Glob patterns matching test files. */
  testGlobs: string[];
  /** Labels that permit skipping tests. */
  bypassLabels: string[];
  /** Optional per-file timeout in milliseconds. */
  timeoutMs: number;
  /** Optional soft memory cap in MB. */
  maxMemoryMB: number;

  // NEW CONFIGURATION OPTIONS

  /** Control which change kind groups are enabled/disabled. */
  changeKindGroups: {
    /** Groups that are enabled (default: all enabled). */
    enabled: ChangeKindGroup[];
    /** Groups that are explicitly disabled (takes precedence over enabled). */
    disabled: ChangeKindGroup[];
  };

  /** Override default severities for specific change kinds. */
  severityOverrides: Partial<Record<SemanticChangeType, SeverityLevel>>;

  /** Disable specific change kinds regardless of group settings. */
  disabledChangeKinds: SemanticChangeType[];

  /** JSX-specific configuration controls. */
  jsxConfig: {
    /** Enable/disable JSX analysis entirely. */
    enabled: boolean;
    /** Disable JSX logic analysis (conditional rendering, etc.) but keep structural changes. */
    ignoreLogicChanges: boolean;
    /** Treat all JSX changes as low severity (useful for teams that don't test JSX logic). */
    treatAsLowSeverity: boolean;
    /** Minimum complexity threshold for JSX event handlers to be flagged. */
    eventHandlerComplexityThreshold: number;
  };

  /** Performance optimization settings. */
  performance: {
    /** Skip analysis for change kinds in disabled groups (true) or run but filter results (false). */
    skipDisabledAnalyzers: boolean;
    /** Enable early exit optimizations when no changes detected in a group. */
    enableEarlyExit: boolean;
  };

  /** Test requirement configuration. */
  testRequirements: {
    /** Change kinds that always require tests regardless of severity. */
    alwaysRequireTests: SemanticChangeType[];
    /** Change kinds that never require tests regardless of severity. */
    neverRequireTests: SemanticChangeType[];
    /** Minimum severity level to require tests (overrides individual change settings). */
    minimumSeverityForTests: SeverityLevel | null;
  };
};

/**
 * Default configuration with production-ready settings.
 */
export const DEFAULT_CONFIG: AnalyzerConfig = {
  include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  exclude: ['node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts', 'dist/**', 'build/**'],
  sideEffectCallees: [
    'console.*',
    'fetch',
    '*.api.*',
    '*.service.*',
    'track*',
    'log*',
    'analytics.*',
    'gtag',
    'dataLayer.*',
  ],
  sideEffectModules: [],
  testGlobs: ['**/*.test.*', '**/*.spec.*'],
  bypassLabels: ['skip-tests', 'docs-only', 'trivial'],
  timeoutMs: 120000,
  maxMemoryMB: 512,
  changeKindGroups: {
    enabled: [
      'core-structural',
      'data-flow',
      'control-flow',
      'react-hooks',
      'jsx-rendering',
      'imports-exports',
      'async-patterns',
      'type-system',
      'side-effects',
      'complexity',
      'error-handling',
    ],
    disabled: [
      'jsx-logic', // Disabled by default as requested - JSX logic often not semantically important
    ],
  },

  severityOverrides: {
    // Example overrides for teams that want stricter/looser requirements
    // 'importAdded': 'medium', // Some teams want to flag all new dependencies
    // 'jsxElementAdded': 'high', // Some teams want to test all UI changes
  },

  disabledChangeKinds: [
    // Individual change kinds that are typically noise
    // Teams can add specific changes they don't care about
  ],

  jsxConfig: {
    enabled: true,
    ignoreLogicChanges: true, // Don't flag "isLoading ? 'Loading' : 'Load More'" type changes
    treatAsLowSeverity: false, // Keep normal severity assessment for structural JSX changes
    eventHandlerComplexityThreshold: 3, // Only flag complex event handlers
  },

  performance: {
    skipDisabledAnalyzers: true, // Skip analysis for disabled groups for better performance
    enableEarlyExit: true, // Enable early exit optimizations
  },

  testRequirements: {
    alwaysRequireTests: [
      'functionSignatureChanged',
      'exportRemoved',
      'hookDependencyChanged',
      'classStructureChanged',
    ],
    neverRequireTests: [
      // JSX logic changes as requested
      'jsxLogicAdded',
      'eventHandlerChanged',
    ],
    minimumSeverityForTests: null, // Use individual change kind settings
  },
};

/**
 * Resolves the effective severity for a change kind, considering config overrides.
 */
export function getEffectiveSeverity(
  changeKind: SemanticChangeType,
  config: AnalyzerConfig,
): SeverityLevel {
  return config.severityOverrides[changeKind] ?? DEFAULT_CHANGE_SEVERITIES[changeKind];
}

/**
 * Checks if a change kind is enabled based on group and individual settings.
 */
export function isChangeKindEnabled(
  changeKind: SemanticChangeType,
  config: AnalyzerConfig,
): boolean {
  // Check if explicitly disabled
  if (config.disabledChangeKinds.includes(changeKind)) {
    return false;
  }

  // Find which group this change kind belongs to
  const group = Object.entries(CHANGE_KIND_GROUPS).find(([, kinds]) =>
    kinds.includes(changeKind),
  )?.[0] as ChangeKindGroup | undefined;

  if (!group) {
    // If not in any group, default to enabled
    return true;
  }

  // Check if group is explicitly disabled
  if (config.changeKindGroups.disabled.includes(group)) {
    return false;
  }

  // Check if group is in enabled list (if enabled list is not empty, use it as allowlist)
  if (config.changeKindGroups.enabled.length > 0) {
    return config.changeKindGroups.enabled.includes(group);
  }

  // Default to enabled
  return true;
}

/**
 * Determines if tests should be required for a specific change based on configuration.
 */
export function shouldRequireTestsForChange(
  changeKind: SemanticChangeType,
  severity: SeverityLevel,
  config: AnalyzerConfig,
): boolean {
  // Check explicit always/never lists first
  if (config.testRequirements.alwaysRequireTests.includes(changeKind)) {
    return true;
  }
  if (config.testRequirements.neverRequireTests.includes(changeKind)) {
    return false;
  }

  // Check minimum severity requirement
  if (config.testRequirements.minimumSeverityForTests) {
    const severityLevels = { low: 0, medium: 1, high: 2 };
    return (
      severityLevels[severity] >= severityLevels[config.testRequirements.minimumSeverityForTests]
    );
  }

  // Default to requiring tests for high severity changes
  return severity === 'high';
}

/**
 * Gets all change kinds in a specific group.
 */
export function getChangeKindsInGroup(group: ChangeKindGroup): SemanticChangeType[] {
  return CHANGE_KIND_GROUPS[group] || [];
}

/**
 * Gets the group that a change kind belongs to.
 */
export function getGroupForChangeKind(changeKind: SemanticChangeType): ChangeKindGroup | null {
  const entry = Object.entries(CHANGE_KIND_GROUPS).find(([, kinds]) => kinds.includes(changeKind));
  return entry ? (entry[0] as ChangeKindGroup) : null;
}
