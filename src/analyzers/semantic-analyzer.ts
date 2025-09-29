import type { DiffHunk, SemanticChange, SemanticContext } from '../types/index.js';
import type { AnalyzerConfig, ChangeKindGroup } from '../types/config.js';
import { isChangeKindEnabled, getEffectiveSeverity } from '../types/config.js';
import { analyzeClasses } from './class-analyzer.js';
import { analyzeComparisonOperators } from './comparison-operator-analyzer.js';
import { analyzeComplexity } from './complexity-analyzer.js';
import { analyzeConditionals } from './conditional-analyzer.js';
import { analyzeDestructuring } from './destructuring-analyzer.js';
import { analyzeExports } from './export-analyzer.js';
import { analyzeFunctions } from './function-analyzer.js';
import { analyzeFunctionCalls } from './function-call-analysis.js';
import { analyzeImports } from './import-analyzer.js';
import { analyzeInterfaces } from './interface-analyzer.js';
import { analyzeJSXChanges } from './jsx-analyzer.js';
import { analyzeLogicalOperators } from './logical-operator-analyzer.js';
import { analyzeLoops } from './loop-analyzer.js';
import { analyzeArrayMutations, analyzeObjectMutations } from './mutation-analyzer.js';
import { analyzePromiseUsage } from './promise-analyzer.js';
import { analyzeReactHooks } from './react-hook-analyzer.js';
import { analyzeSideEffects } from './side-effect-analyzer.js';
import { analyzeSpreadOperators } from './spread-analyzer.js';
import { analyzeStateManagement } from './state-management-analyzer.js';
import { analyzeTernaryExpressions } from './ternary-analyzer.js';
import { analyzeThrowStatements } from './throw-analyzer.js';
import { analyzeTryCatch } from './try-catch-analyzer.js';
import { analyzeTypes } from './type-analyzer.js';
import { analyzeVariables } from './variable-analyzer.js';
import { analyzeVariableAssignments } from './variable-assignment-analyzer.js';

/**
 * Analyzes semantic changes between two versions of a TypeScript/React file
 *
 * @param baseContext - Semantic context from the base version
 * @param headContext - Semantic context from the head version
 * @param diffHunks - Git diff hunks (currently unused but kept for future enhancement)
 * @param config - Analysis configuration
 * @returns Array of detected semantic changes
 */
export function analyzeSemanticChanges(
  baseContext: SemanticContext,
  headContext: SemanticContext,
  diffHunks: DiffHunk[],
  config: AnalyzerConfig,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Analyze different semantic aspects in parallel
  // Each analyzer function focuses on a specific language construct
  changes.push(...analyzeArrayMutations(baseContext, headContext));
  changes.push(...analyzeClasses(baseContext, headContext));
  changes.push(...analyzeComparisonOperators(baseContext, headContext));
  changes.push(...analyzeComplexity(baseContext, headContext));
  changes.push(...analyzeConditionals(baseContext, headContext));
  changes.push(...analyzeDestructuring(baseContext, headContext));
  changes.push(...analyzeExports(baseContext, headContext));
  changes.push(...analyzeFunctionCalls(baseContext, headContext));
  changes.push(...analyzeFunctions(baseContext, headContext));
  changes.push(...analyzeImports(baseContext, headContext, config));
  changes.push(...analyzeInterfaces(baseContext, headContext));
  changes.push(...analyzeJSXChanges(baseContext, headContext));
  changes.push(...analyzeLogicalOperators(baseContext, headContext));
  changes.push(...analyzeLoops(baseContext, headContext));
  changes.push(...analyzeObjectMutations(baseContext, headContext));
  changes.push(...analyzePromiseUsage(baseContext, headContext));
  changes.push(...analyzeReactHooks(baseContext, headContext));
  changes.push(...analyzeSideEffects(baseContext, headContext));
  changes.push(...analyzeSpreadOperators(baseContext, headContext));
  changes.push(...analyzeStateManagement(baseContext, headContext));
  changes.push(...analyzeTernaryExpressions(baseContext, headContext));
  changes.push(...analyzeThrowStatements(baseContext, headContext));
  changes.push(...analyzeTryCatch(baseContext, headContext));
  changes.push(...analyzeTypes(baseContext, headContext));
  changes.push(...analyzeVariableAssignments(baseContext, headContext));
  changes.push(...analyzeVariables(baseContext, headContext));

  // Scope to diff hunks to reduce noise
  const scoped = scopeChangesToHunks(deduplicateChanges(changes), diffHunks);
  return scoped;
}

/**
 * Analyzer that supports selective analysis based on configuration.
 *
 * @param baseContext - Semantic context from the base version
 * @param headContext - Semantic context from the head version
 * @param diffHunks - Git diff hunks
 * @param config - Analysis configuration
 * @returns Array of detected semantic changes with applied severity overrides
 */
export function analyzeSemanticChangesWithConfig(
  baseContext: SemanticContext,
  headContext: SemanticContext,
  diffHunks: DiffHunk[],
  config: AnalyzerConfig,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Map analyzers to their corresponding change kind groups for selective execution
  const analyzerGroups = {
    'data-flow': () => [
      ...analyzeArrayMutations(baseContext, headContext),
      ...analyzeObjectMutations(baseContext, headContext),
      ...analyzeDestructuring(baseContext, headContext),
      ...analyzeVariables(baseContext, headContext),
      ...analyzeVariableAssignments(baseContext, headContext),
    ],
    'core-structural': () => [
      ...analyzeClasses(baseContext, headContext),
      ...analyzeExports(baseContext, headContext),
      ...analyzeFunctions(baseContext, headContext),
      ...analyzeInterfaces(baseContext, headContext),
    ],
    'control-flow': () => [
      ...analyzeComparisonOperators(baseContext, headContext),
      ...analyzeConditionals(baseContext, headContext),
      ...analyzeLogicalOperators(baseContext, headContext),
      ...analyzeLoops(baseContext, headContext),
      ...analyzeTernaryExpressions(baseContext, headContext),
    ],
    'react-hooks': () => [...analyzeReactHooks(baseContext, headContext)],
    'jsx-rendering': () => {
      if (!config.jsxConfig.enabled) return [];
      const jsxChanges = analyzeJSXChanges(baseContext, headContext);

      // Filter out logic changes if configured
      if (config.jsxConfig.ignoreLogicChanges) {
        return jsxChanges.filter(
          (change) => !['jsxLogicAdded', 'eventHandlerChanged'].includes(change.kind),
        );
      }
      return jsxChanges;
    },
    'jsx-logic': () => {
      if (!config.jsxConfig.enabled || config.jsxConfig.ignoreLogicChanges) return [];
      const jsxChanges = analyzeJSXChanges(baseContext, headContext);
      return jsxChanges.filter((change) =>
        ['jsxLogicAdded', 'eventHandlerChanged'].includes(change.kind),
      );
    },
    'imports-exports': () => [...analyzeImports(baseContext, headContext, config)],
    'async-patterns': () => [
      ...analyzePromiseUsage(baseContext, headContext),
      // Note: async/await and effects would be analyzed by function analyzer
    ],
    'type-system': () => [...analyzeTypes(baseContext, headContext)],
    'side-effects': () => [
      ...analyzeFunctionCalls(baseContext, headContext),
      ...analyzeSideEffects(baseContext, headContext),
    ],
    complexity: () => [
      ...analyzeComplexity(baseContext, headContext),
      ...analyzeSpreadOperators(baseContext, headContext),
    ],
    'error-handling': () => [
      ...analyzeThrowStatements(baseContext, headContext),
      ...analyzeTryCatch(baseContext, headContext),
    ],
  };

  // State management analyzer - not in core groups, always run if enabled
  if (isGroupEnabled('react-hooks', config) || isGroupEnabled('side-effects', config)) {
    changes.push(...analyzeStateManagement(baseContext, headContext));
  }

  // Run analyzers based on configuration
  for (const [groupName, analyzerFn] of Object.entries(analyzerGroups)) {
    const group = groupName as ChangeKindGroup;

    if (config.performance.skipDisabledAnalyzers && !isGroupEnabled(group, config)) {
      // Skip analysis entirely for performance
      continue;
    }

    const groupChanges = analyzerFn();

    if (config.performance.skipDisabledAnalyzers || isGroupEnabled(group, config)) {
      changes.push(...groupChanges);
    }
  }

  // Apply configuration filters and transformations
  const filteredChanges = applyConfigurationFilters(changes, config);

  // Apply severity overrides
  const changesWithSeverity = applySeverityOverrides(filteredChanges, config);

  // Scope to diff hunks to reduce noise
  const scoped = scopeChangesToHunks(deduplicateChanges(changesWithSeverity), diffHunks);
  return scoped;
}

/**
 * Checks if a change kind group is enabled in the configuration.
 */
function isGroupEnabled(groupName: ChangeKindGroup, config: AnalyzerConfig): boolean {
  // Check if explicitly disabled
  if (config.changeKindGroups.disabled.includes(groupName)) {
    return false;
  }

  // Check if in enabled list (if enabled list is not empty, use as allowlist)
  if (config.changeKindGroups.enabled.length > 0) {
    return config.changeKindGroups.enabled.includes(groupName);
  }

  return true;
}

/**
 * Applies configuration filters to remove unwanted changes.
 */
function applyConfigurationFilters(
  changes: SemanticChange[],
  config: AnalyzerConfig,
): SemanticChange[] {
  return changes.filter((change) => {
    // Check if change kind is specifically disabled
    if (config.disabledChangeKinds.includes(change.kind)) {
      return false;
    }

    // Check if change kind is enabled based on group settings
    if (!isChangeKindEnabled(change.kind, config)) {
      return false;
    }

    return true;
  });
}

/**
 * Applies severity overrides from configuration to changes.
 */
function applySeverityOverrides(
  changes: SemanticChange[],
  config: AnalyzerConfig,
): SemanticChange[] {
  return changes.map((change) => {
    const effectiveSeverity = getEffectiveSeverity(change.kind, config);

    // Apply JSX-specific severity rules
    if (
      config.jsxConfig.treatAsLowSeverity &&
      (change.kind.includes('jsx') || change.kind.includes('component'))
    ) {
      return { ...change, severity: 'low' };
    }

    // Return change with effective severity
    return { ...change, severity: effectiveSeverity };
  });
}

/**
 * Removes duplicate changes that might be detected by multiple analyzers
 * Uses a composite key of change type, location, and detail for deduplication
 */
function deduplicateChanges(changes: SemanticChange[]): SemanticChange[] {
  const seen = new Set<string>();
  return changes.filter((change) => {
    const key = `${change.kind}-${change.line}-${change.column}-${change.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scopeChangesToHunks(changes: SemanticChange[], hunks: DiffHunk[]): SemanticChange[] {
  if (!hunks || hunks.length === 0) return changes;

  const isBaseLocated = (kind: string) => /Removed$/.test(kind);

  return changes.filter((change) => {
    // File-level signals: keep if there are any hunks
    if (change.astNode === 'SourceFile') return true;

    const ranges = hunks.map((h) => ({ base: h.baseRange, head: h.headRange }));
    if (isBaseLocated(change.kind)) {
      return ranges.some((r) => change.line >= r.base.start && change.line <= r.base.end);
    } else {
      return ranges.some((r) => change.line >= r.head.start && change.line <= r.head.end);
    }
  });
}
