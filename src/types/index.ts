export interface SemanticChangeKind {
  functionSignatureChanged: 'functionSignatureChanged';
  functionAdded: 'functionAdded';
  functionRemoved: 'functionRemoved';
  functionComplexityChanged: 'functionComplexityChanged';
  classStructureChanged: 'classStructureChanged';
  interfaceModified: 'interfaceModified';
  typeDefinitionChanged: 'typeDefinitionChanged';
  exportAdded: 'exportAdded';
  exportRemoved: 'exportRemoved';
  exportSignatureChanged: 'exportSignatureChanged';
  importAdded: 'importAdded';
  importRemoved: 'importRemoved';
  importStructureChanged: 'importStructureChanged';
  variableDeclarationChanged: 'variableDeclarationChanged';
  variableAssignmentChanged: 'variableAssignmentChanged';
  objectMutation: 'objectMutation';
  arrayMutation: 'arrayMutation';
  conditionalAdded: 'conditionalAdded';
  conditionalRemoved: 'conditionalRemoved';
  conditionalModified: 'conditionalModified';
  loopAdded: 'loopAdded';
  loopRemoved: 'loopRemoved';
  loopModified: 'loopModified';
  functionCallAdded: 'functionCallAdded';
  functionCallRemoved: 'functionCallRemoved';
  functionCallModified: 'functionCallModified';
  throwAdded: 'throwAdded';
  throwRemoved: 'throwRemoved';
  tryCatchAdded: 'tryCatchAdded';
  tryCatchModified: 'tryCatchModified';
  asyncAwaitAdded: 'asyncAwaitAdded';
  asyncAwaitRemoved: 'asyncAwaitRemoved';
  promiseAdded: 'promiseAdded';
  promiseRemoved: 'promiseRemoved';
  destructuringAdded: 'destructuringAdded';
  destructuringRemoved: 'destructuringRemoved';
  spreadOperatorAdded: 'spreadOperatorAdded';
  spreadOperatorRemoved: 'spreadOperatorRemoved';
  ternaryAdded: 'ternaryAdded';
  ternaryRemoved: 'ternaryRemoved';
  logicalOperatorChanged: 'logicalOperatorChanged';
  comparisonOperatorChanged: 'comparisonOperatorChanged';
  hookAdded: 'hookAdded';
  hookRemoved: 'hookRemoved';
  hookDependencyChanged: 'hookDependencyChanged';
  jsxElementAdded: 'jsxElementAdded';
  jsxElementRemoved: 'jsxElementRemoved';
  jsxLogicAdded: 'jsxLogicAdded';
  jsxPropsChanged: 'jsxPropsChanged';
  eventHandlerChanged: 'eventHandlerChanged';
  componentReferenceChanged: 'componentReferenceChanged';
  componentStructureChanged: 'componentStructureChanged';
  stateManagementChanged: 'stateManagementChanged';
  effectAdded: 'effectAdded';
  effectRemoved: 'effectRemoved';
}

export type SemanticChangeType = keyof SemanticChangeKind;
export type SeverityLevel = 'low' | 'medium' | 'high';

export interface SemanticChange {
  kind: SemanticChangeType;
  severity: SeverityLevel;
  line: number;
  column: number;
  detail: string;
  astNode: string;
  context?: string;
}

export interface DiffHunk {
  file: string;
  baseRange: { start: number; end: number };
  headRange: { start: number; end: number };
  addedLines: Array<{ lineNumber: number; content: string }>;
  removedLines: Array<{ lineNumber: number; content: string }>;
}

import type * as ts from 'typescript';

export interface SemanticContext {
  sourceFile: ts.SourceFile;
  imports: Array<{
    module: string;
    specifiers: string[];
    isDefault: boolean;
    isNamespace: boolean;
    line: number;
    column: number;
  }>;
  exports: Array<{
    name: string;
    type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const';
    isDefault: boolean;
    line: number;
    column: number;
    signature?: string;
  }>;
  functions: Array<{
    name: string;
    parameters: Array<{ name: string; type: string; optional: boolean }>;
    returnType: string;
    isAsync: boolean;
    complexity: number;
    line: number;
    column: number;
  }>;
  classes: Array<{
    name: string;
    extends?: string;
    implements: string[];
    line: number;
    column: number;
    methods: Array<{
      name: string;
      parameters: Array<{ name: string; type: string; optional: boolean }>;
      returnType: string;
      isAsync: boolean;
      isStatic: boolean;
      visibility: 'public' | 'private' | 'protected';
    }>;
    properties: Array<{
      name: string;
      type: string;
      isStatic: boolean;
      visibility: 'public' | 'private' | 'protected';
    }>;
  }>;
  interfaces: Array<{
    name: string;
    extends: string[];
    line: number;
    column: number;
    properties: Array<{
      name: string;
      type: string;
      optional: boolean;
    }>;
    methods: Array<{
      name: string;
      parameters: Array<{ name: string; type: string; optional: boolean }>;
      returnType: string;
    }>;
  }>;
  types: Array<{
    name: string;
    definition: string;
    line: number;
    column: number;
  }>;
  variables: Array<{
    name: string;
    type: string;
    isConst: boolean;
    hasInitializer: boolean;
    line: number;
    column: number;
  }>;
  reactHooks: Array<{
    name: string;
    dependencies: string[];
    type:
      | 'useState'
      | 'useEffect'
      | 'useCallback'
      | 'useMemo'
      | 'useContext'
      | 'useReducer'
      | 'custom';
  }>;
  jsxElements: Array<{
    tagName: string;
    props: Array<{ name: string; type: 'literal' | 'expression' | 'spread' }>;
    hasChildren: boolean;
    isComponent: boolean;
  }>;
  complexity: number;
  sideEffectCalls: Array<{
    name: string;
    line: number;
    column: number;
    arguments: number;
  }>;
}

export interface AnalyzerConfig {
  include: string[];
  exclude: string[];
  sideEffectCallees: string[];
  testGlobs: string[];
  bypassLabels: string[];
  timeoutMs?: number;
  maxMemoryMB?: number;
}

export interface AnalysisResult {
  requiresTests: boolean;
  summary: string;
  filesAnalyzed: number;
  totalChanges: number;
  severityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
  highSeverityChanges: number;
  topChangeTypes: Array<{
    kind: string;
    count: number;
    maxSeverity: SeverityLevel;
  }>;
  criticalChanges: Array<{
    file: string;
    line: number;
    column: number;
    kind: string;
    detail: string;
    severity: SeverityLevel;
  }>;
  changes: Array<{
    file: string;
    line: number;
    column: number;
    kind: string;
    detail: string;
    severity: SeverityLevel;
    astNode: string;
    context?: string;
  }>;
  failedFiles: Array<{ filePath: string; error: string }>; // New property
  hasReactChanges: boolean;
  performance: {
    analysisTimeMs: number;
    memoryUsageMB: number;
  };
}

export interface JSXAnalysisResult {
  elements: Array<{
    tagName: string;
    line: number;
    column: number;
    props: Array<{ name: string; type: 'literal' | 'expression' | 'spread' }>;
    hasChildren: boolean;
    isComponent: boolean;
  }>;
  eventHandlers: Array<{
    element: string;
    event: string;
    line: number;
    column: number;
    isInline: boolean;
    complexity: number;
  }>;
  logicalExpressions: Array<{
    line: number;
    column: number;
    operator: string;
    complexity: number;
  }>;
  conditionalRendering: Array<{
    line: number;
    column: number;
    type: 'ternary' | 'logical' | 'conditional';
  }>;
  componentReferences: string[];
}
