import ts from 'typescript';

// Main analysis functions
export { analyzeJSX } from './analyzers/jsx-analyzer.js';
export { analyzeSemanticChanges } from './analyzers/semantic-analyzer.js';
export { createSemanticContext } from './context/semantic-context-builder.js';

// Analyzer functions
export {
  analyzeFunctionCallChanges,
  analyzeFunctionSignatureChanges,
  analyzeImportStructureChanges,
  analyzeTypeDefinitionChanges,
  detectSemanticChanges,
} from './analyzers/index.js';

// Type exports
export type {
  AnalysisResult,
  AnalyzerConfig,
  DiffHunk,
  JSXAnalysisResult,
  SemanticChange,
  SemanticChangeKind,
  SemanticChangeType,
  SemanticContext,
  SeverityLevel,
} from './types/index.js';

// Analyzer types
export type { AnalyzeFileParams, LocatedSemanticChange } from './analyzers/types.js';

// Utility exports
export * from './utils/ast-utils.js';

// Re-export for convenience (compatible with TS export =)
export { ts };
