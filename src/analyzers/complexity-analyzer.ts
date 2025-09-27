import type { SemanticChange, SemanticContext } from '../types/index.js';

/**
 * Analyzes cyclomatic complexity changes across the entire file
 * Large complexity increases may indicate need for additional testing
 */
export function analyzeComplexity(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  const complexityDiff = headContext.complexity - baseContext.complexity;
  if (complexityDiff > 5) {
    changes.push({
      kind: 'functionSignatureChanged',
      severity: 'medium',
      line: 1,
      column: 1,
      detail: `Overall complexity increased significantly (+${complexityDiff})`,
      astNode: 'SourceFile',
    });
  }

  return changes;
}
