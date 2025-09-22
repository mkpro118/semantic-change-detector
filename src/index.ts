// Main analysis functions
export { analyzeSemanticChanges } from './analyzers/semantic-analyzer.js';
export { createSemanticContext } from './context/semantic-context-builder.js';
export { analyzeJSX } from './analyzers/jsx-analyzer.js';

// Type exports
export type {
  SemanticChange,
  SemanticContext,
  DiffHunk,
  AnalyzerConfig,
  AnalysisResult,
  JSXAnalysisResult,
  SemanticChangeType,
  SeverityLevel,
  SemanticChangeKind,
} from './types/index.js';

// Utility exports
export * from './utils/ast-utils.js';

// Re-export for convenience (compatible with TS export =)
import * as ts from 'typescript';
export { ts };
