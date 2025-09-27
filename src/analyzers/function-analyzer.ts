import type { SemanticChange, SemanticContext } from '../types/index.js';
import { isAlphaConversion } from '../utils/ast-utils.js';

/**
 * Analyzes function declaration changes between two versions
 * Function signature changes are high-severity as they affect calling code
 */
export function analyzeFunctions(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Find new functions
  for (const headFunction of headContext.functions) {
    const baseFunction = baseContext.functions.find((f) => f.name === headFunction.name);
    if (!baseFunction) {
      changes.push({
        kind: 'functionAdded',
        severity: 'medium',
        line: headFunction.line,
        column: headFunction.column,
        detail: `Function added: ${headFunction.name}`,
        astNode: 'FunctionDeclaration',
      });
    } else {
      if (!baseFunction.isAsync && headFunction.isAsync) {
        changes.push({
          kind: 'asyncAwaitAdded',
          severity: 'medium',
          line: headFunction.line,
          column: headFunction.column,
          detail: `Async/await usage added to function: ${headFunction.name}`,
          astNode: 'FunctionDeclaration',
        });
      } else if (baseFunction.isAsync && !headFunction.isAsync) {
        changes.push({
          kind: 'asyncAwaitRemoved',
          severity: 'medium',
          line: headFunction.line,
          column: headFunction.column,
          detail: `Async/await usage removed from function: ${headFunction.name}`,
          astNode: 'FunctionDeclaration',
        });
      }

      // Check for signature changes
      const baseSignature = getFunctionSignatureString(baseFunction);
      const headSignature = getFunctionSignatureString(headFunction);

      if (
        baseSignature !== headSignature &&
        !isAlphaConversion(baseSignature, headSignature, baseSignature + headSignature)
      ) {
        changes.push({
          kind: 'functionSignatureChanged',
          severity: 'high',
          line: headFunction.line,
          column: headFunction.column,
          detail: `Function signature changed: ${headFunction.name}`,
          astNode: 'FunctionDeclaration',
          context: `${baseSignature} -> ${headSignature}`,
        });
      }

      // Check for complexity changes
      if (Math.abs(headFunction.complexity - baseFunction.complexity) > 3) {
        changes.push({
          kind: 'functionComplexityChanged',
          severity: 'medium',
          line: headFunction.line,
          column: headFunction.column,
          detail: `Function complexity changed significantly: ${headFunction.name} (${baseFunction.complexity} -> ${headFunction.complexity})`,
          astNode: 'FunctionDeclaration',
        });
      }
    }
  }

  // Find removed functions
  for (const baseFunction of baseContext.functions) {
    const headFunction = headContext.functions.find((f) => f.name === baseFunction.name);
    if (!headFunction) {
      changes.push({
        kind: 'functionRemoved',
        severity: 'high',
        line: baseFunction.line,
        column: baseFunction.column,
        detail: `Function removed: ${baseFunction.name}`,
        astNode: 'FunctionDeclaration',
      });
    }
  }

  return changes;
}

/**
 * Generates a normalized string representation of a function signature
 * Used for comparing function signatures between versions
 */
function getFunctionSignatureString(func: {
  name: string;
  parameters: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string;
}): string {
  const params = func.parameters
    .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
    .join(', ');
  return `${func.name}(${params}): ${func.returnType}`;
}
