import type ts from 'typescript';
import type { SemanticChangeKind } from './semantic-change-kind.js';
export type { SemanticChangeKind } from './semantic-change-kind.js';

/**
 * SemanticChangeKind enumerates the categories of code changes that the
 * analyzer can detect. Each key corresponds to a specific rule and
 * includes a short string tag that is emitted with the change. The
 * documentation for each value explains what it means and why it
 * matters for behavior and tests.
 *
 * Notes
 * - These values are used in user-facing output and in CI annotations.
 * - Treat them as stable identifiers.
 *
 * @library-export
 */
// Moved to './semantic-change-kind.ts' for modularity and easier tooling.

/**
 * The union of all semantic change identifiers listed in
 * {@link SemanticChangeKind}. Useful for narrowing and switch
 * statements when handling results.
 *
 * @library-export
 */
export type SemanticChangeType = keyof SemanticChangeKind;

/**
 * The severity assigned to a change. This guides test requirements and
 * CI reporting.
 *
 * - low — Cosmetic or low-risk changes.
 * - medium — Potential behavior change; tests recommended.
 * - high — Likely behavior change; tests required.
 *
 * @library-export
 */
export type SeverityLevel = 'low' | 'medium' | 'high';

/**
 * A single detected semantic change.
 *
 * Fields
 * - kind — The change category.
 * - severity — The assigned impact level.
 * - line/column — Location in the modified file (1/0 indexed).
 * - detail — Human-readable explanation of the change.
 * - astNode — AST node kind near the change.
 * - context — Optional extra info (e.g., signatures before/after).
 *
 * @library-export
 */
export type SemanticChange = {
  /** The change category identifier. */
  kind: SemanticChangeType;
  /** Impact level for CI and test guidance. */
  severity: SeverityLevel;
  /** 1-indexed line number in the modified file. */
  line: number;
  /** 0-indexed column number in the modified file. */
  column: number;
  /** Human-readable description of the change. */
  detail: string;
  /** The AST node kind closest to the change. */
  astNode: string;
  /** Optional extra details like prior/next signatures. */
  context?: string;
};

/**
 * A compact representation of a unified diff hunk used to scope
 * analysis. Hunks provide line ranges and the added/removed lines.
 *
 * @library-export
 */
export type DiffHunk = {
  /** File path the hunk applies to. */
  file: string;
  /** Base (pre-change) line range covered by the hunk. */
  baseRange: { start: number; end: number };
  /** Head (post-change) line range covered by the hunk. */
  headRange: { start: number; end: number };
  /** Lines added in the head version (without leading '+'). */
  addedLines: Array<{ lineNumber: number; content: string }>;
  /** Lines removed from the base version (without leading '-'). */
  removedLines: Array<{ lineNumber: number; content: string }>;
};

/**
 * A summarized semantic view of a source file used by the structural
 * analyzer. This captures imports/exports, declarations, JSX surface,
 * hooks, and known side-effect calls.
 *
 * @library-export
 */
export type SemanticContext = {
  /** Parsed TypeScript source file. */
  sourceFile: ts.SourceFile;
  imports: Array<{
    /** Module specifier text (e.g., 'react'). */
    module: string;
    /** Imported names (post-alias). */
    specifiers: string[];
    /** Whether default import is present. */
    isDefault: boolean;
    /** Whether namespace import (import * as X) is present. */
    isNamespace: boolean;
    /** 1-indexed line of the import. */
    line: number;
    /** 0-indexed column of the import. */
    column: number;
  }>;
  exports: Array<{
    /** Exported symbol name. */
    name: string;
    /** Classifies export declaration kind. */
    type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const';
    /** True when exported as default. */
    isDefault: boolean;
    /** 1-indexed line of the export. */
    line: number;
    /** 0-indexed column of the export. */
    column: number;
    /** Optional signature text for callable exports. */
    signature?: string;
  }>;
  functions: Array<{
    /** Function name. */
    name: string;
    /** Parameter list with simple types and optionality. */
    parameters: Array<{
      /** Parameter name. */
      name: string;
      /** Parameter type (text). */
      type: string;
      /** Whether parameter is optional. */
      optional: boolean;
    }>;
    /** Return type (text). */
    returnType: string;
    /** Whether function is async. */
    isAsync: boolean;
    /** Cyclomatic complexity metric. */
    complexity: number;
    /** 1-indexed line of declaration. */
    line: number;
    /** 0-indexed column of declaration. */
    column: number;
  }>;
  classes: Array<{
    /** Class name. */
    name: string;
    /** Superclass name if present. */
    extends?: string;
    /** Implemented interface names. */
    implements: string[];
    /** 1-indexed line of class. */
    line: number;
    /** 0-indexed column of class. */
    column: number;
    methods: Array<{
      /** Method name. */
      name: string;
      /** Method parameters (simple representation). */
      parameters: Array<{
        /** Parameter name. */
        name: string;
        /** Parameter type (text). */
        type: string;
        /** Whether parameter is optional. */
        optional: boolean;
      }>;
      /** Declared return type (text). */
      returnType: string;
      /** Whether method is async. */
      isAsync: boolean;
      /** Whether method is static. */
      isStatic: boolean;
      /** Visibility modifier. */
      visibility: 'public' | 'private' | 'protected';
    }>;
    properties: Array<{
      /** Property name. */
      name: string;
      /** Declared type (text). */
      type: string;
      /** Whether property is static. */
      isStatic: boolean;
      /** Visibility modifier. */
      visibility: 'public' | 'private' | 'protected';
    }>;
  }>;
  interfaces: Array<{
    /** Interface name. */
    name: string;
    /** Extended interface names. */
    extends: string[];
    /** 1-indexed line of interface. */
    line: number;
    /** 0-indexed column of interface. */
    column: number;
    properties: Array<{
      /** Property name. */
      name: string;
      /** Property type (text). */
      type: string;
      /** Whether property is optional. */
      optional: boolean;
    }>;
    methods: Array<{
      /** Method name. */
      name: string;
      /** Parameters for the method. */
      parameters: Array<{
        /** Parameter name. */
        name: string;
        /** Parameter type. */
        type: string;
        /** Optional parameter flag. */
        optional: boolean;
      }>;
      /** Return type (text). */
      returnType: string;
    }>;
  }>;
  types: Array<{
    /** Type alias or interface name. */
    name: string;
    /** Normalized string for structural comparison. */
    definition: string;
    /** 1-indexed declaration line. */
    line: number;
    /** 0-indexed declaration column. */
    column: number;
  }>;
  variables: Array<{
    /** Variable name. */
    name: string;
    /** Declared type (text). */
    type: string;
    /** True when declared with const. */
    isConst: boolean;
    /** True if an initializer is present. */
    hasInitializer: boolean;
    /** 1-indexed line of declaration. */
    line: number;
    /** 0-indexed column of declaration. */
    column: number;
  }>;
  reactHooks: Array<{
    /** Hook name (e.g., useEffect). */
    name: string;
    /** Dependency identifiers as string form. */
    dependencies: string[];
    /** Hook classification. */
    type:
      | 'useState'
      | 'useEffect'
      | 'useCallback'
      | 'useMemo'
      | 'useContext'
      | 'useReducer'
      | 'custom';
    /** 1-indexed line of the hook call. */
    line: number;
    /** 0-indexed column of the hook call. */
    column: number;
  }>;
  jsxElements: Array<{
    /** Tag or component name. */
    tagName: string;
    /** Props with a coarse type for analysis. */
    props: Array<{
      /** Prop name. */
      name: string;
      /** Prop value classification. */
      type: 'literal' | 'expression' | 'spread';
    }>;
    /** Whether element contains children. */
    hasChildren: boolean;
    /** True when the tag is a React component (capitalized). */
    isComponent: boolean;
  }>;
  /** File-level complexity metric. */
  complexity: number;
  sideEffectCalls: Array<{
    /** Callee text for a known side-effect call. */
    name: string;
    /** 1-indexed call line. */
    line: number;
    /** 0-indexed call column. */
    column: number;
    /** Number of arguments passed. */
    arguments: number;
  }>;
};

/**
 * Configuration for the analyzer.
 *
 * - include/exclude — Glob patterns controlling files to analyze.
 * - sideEffectCallees — Callee patterns considered side-effectful
 *   (e.g., console.*, analytics.*). Supports wildcards.
 * - testGlobs — Test file patterns used to cross-reference imports.
 * - bypassLabels — Labels indicating that tests are not required.
 * - timeoutMs — Optional per-file timeout.
 * - maxMemoryMB — Optional soft cap for process memory.
 *
 * @library-export
 */
export type AnalyzerConfig = {
  /** Glob patterns to include in analysis. */
  include: string[];
  /** Glob patterns to exclude from analysis. */
  exclude: string[];
  /** Patterns of callees considered side-effectful. */
  sideEffectCallees: string[];
  /** Glob patterns for modules considered to have side effects. */
  sideEffectModules?: string[];
  /** Glob patterns matching test files. */
  testGlobs: string[];
  /** Labels that permit skipping tests. */
  bypassLabels: string[];
  /** Optional per-file timeout in milliseconds. */
  timeoutMs?: number;
  /** Optional soft memory cap in MB. */
  maxMemoryMB?: number;
};

/**
 * The aggregated result for a multi-file analysis.
 *
 * Fields
 * - requiresTests — Whether high-severity changes require tests.
 * - summary — A human-readable summary string.
 * - filesAnalyzed — Number of files processed.
 * - totalChanges — Total detected changes.
 * - severityBreakdown — Counts by severity.
 * - highSeverityChanges — Count of high severity changes.
 * - topChangeTypes — The most frequent change kinds.
 * - criticalChanges — High-severity changes with location and details.
 * - changes — All changes with file path and AST context.
 * - failedFiles — Files that failed to analyze with error message.
 * - hasReactChanges — True if JSX/React hooks changes were detected.
 * - performance — Timing and memory usage metrics.
 *
 * @library-export
 */
export type AnalysisResult = {
  /** True if tests are required due to high severity. */
  requiresTests: boolean;
  /** Human-readable summary of results. */
  summary: string;
  /** Number of files analyzed. */
  filesAnalyzed: number;
  /** Total number of detected changes. */
  totalChanges: number;
  /** Counts of changes by severity. */
  severityBreakdown: {
    /** High-severity changes count. */
    high: number;
    /** Medium-severity changes count. */
    medium: number;
    /** Low-severity changes count. */
    low: number;
  };
  /** Number of high-severity changes. */
  highSeverityChanges: number;
  /** Top occurring change kinds and their max severity. */
  topChangeTypes: Array<{
    /** Change kind identifier. */
    kind: string;
    /** Frequency of this change kind. */
    count: number;
    /** Max severity observed for this kind. */
    maxSeverity: SeverityLevel;
  }>;
  /** High-impact changes highlighted for quick review. */
  criticalChanges: Array<{
    /** File path. */
    file: string;
    /** 1-indexed line of change. */
    line: number;
    /** 0-indexed column of change. */
    column: number;
    /** Change kind. */
    kind: string;
    /** Human-readable details. */
    detail: string;
    /** Change severity. */
    severity: SeverityLevel;
  }>;
  /** All changes across analyzed files. */
  changes: Array<{
    /** File path. */
    file: string;
    /** 1-indexed line of change. */
    line: number;
    /** 0-indexed column of change. */
    column: number;
    /** Change kind. */
    kind: string;
    /** Human-readable details. */
    detail: string;
    /** Change severity. */
    severity: SeverityLevel;
    /** AST node near the change. */
    astNode: string;
    /** Optional extra information. */
    context?: string;
  }>;
  /** Files that failed analysis and their error messages. */
  failedFiles: Array<{ filePath: string; error: string }>;
  /** True if any React/JSX-related changes were found. */
  hasReactChanges: boolean;
  /** Performance metrics for the analysis run. */
  performance: {
    /** Total elapsed analysis time in ms. */
    analysisTimeMs: number;
    /** Peak memory usage in MB. */
    memoryUsageMB: number;
  };
};

/**
 * The extracted JSX structure and behavior signals used by the JSX
 * analyzer.
 *
 * @library-export
 */
export type JSXAnalysisResult = {
  /** JSX elements with basic metadata and prop classifications. */
  elements: Array<{
    /** Tag or component name. */
    tagName: string;
    /** 1-indexed element start line. */
    line: number;
    /** 0-indexed element start column. */
    column: number;
    /** Prop list with value kinds. */
    props: Array<{
      /** Prop name. */
      name: string;
      /** Prop value classification. */
      type: 'literal' | 'expression' | 'spread';
      /** Raw prop value text (normalized as needed). */
      value: string;
    }>;
    /** Whether the element has children. */
    hasChildren: boolean;
    /** True when component (capitalized) rather than DOM tag. */
    isComponent: boolean;
  }>;
  /** Event handlers discovered with basic complexity estimate. */
  eventHandlers: Array<{
    /** Host element tag or component name. */
    element: string;
    /** Event name (e.g., onClick). */
    event: string;
    /** 1-indexed handler line. */
    line: number;
    /** 0-indexed handler column. */
    column: number;
    /** Inline handler flag. */
    isInline: boolean;
    /** Rough complexity heuristic for the handler. */
    complexity: number;
  }>;
  /** Logical expressions used in JSX rendering. */
  logicalExpressions: Array<{
    /** 1-indexed line. */
    line: number;
    /** 0-indexed column. */
    column: number;
    /** Operator token (e.g., && or ||). */
    operator: string;
    /** Complexity heuristic for the expression. */
    complexity: number;
  }>;
  /** Conditional rendering sites (ternary / logical / conditional). */
  conditionalRendering: Array<{
    /** 1-indexed line. */
    line: number;
    /** 0-indexed column. */
    column: number;
    /** Conditional kind classification. */
    type: 'ternary' | 'logical' | 'conditional';
  }>;
  /** Component names referenced by JSX. */
  componentReferences: string[];
};
