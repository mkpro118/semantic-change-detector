import type { SemanticChange, SemanticContext } from '../types/index.js';

/**
 * Analyzes variable declaration changes
 * Variable changes are typically low-severity unless they affect exported scope
 */
export function analyzeVariables(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const headVariable of headContext.variables) {
    const baseVariable = baseContext.variables.find((v) => v.name === headVariable.name);
    if (!baseVariable) {
      changes.push({
        kind: 'variableDeclarationChanged',
        severity: 'low',
        line: headVariable.line,
        column: headVariable.column,
        detail: `Variable added: ${headVariable.name}`,
        astNode: 'VariableDeclaration',
      });
    } else if (baseVariable.type !== headVariable.type) {
      changes.push({
        kind: 'variableDeclarationChanged',
        severity: 'medium',
        line: headVariable.line,
        column: headVariable.column,
        detail: `Variable type changed: ${headVariable.name}`,
        astNode: 'VariableDeclaration',
      });
    }
  }

  return changes;
}
