import type { SemanticChange, SemanticContext } from '../types/index.js';

/**
 * Analyzes side effect function calls (console, fetch, API calls, etc.)
 * Side effect additions are high-severity as they change runtime behavior
 */
export function analyzeSideEffects(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Find new side effect calls
  for (const headCall of headContext.sideEffectCalls) {
    const baseCall = baseContext.sideEffectCalls.find(
      (c) => c.name === headCall.name && Math.abs(c.line - headCall.line) <= 2,
    );
    if (!baseCall) {
      changes.push({
        kind: 'functionCallAdded',
        severity: 'high',
        line: headCall.line,
        column: headCall.column,
        detail: `Side effect call added: ${headCall.name}`,
        astNode: 'CallExpression',
      });
    }
  }

  return changes;
}
