import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';

/**
 * Analyzes TypeScript type alias changes
 * Type changes can affect type checking and consuming code compilation
 */
export function analyzeTypes(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const headType of headContext.types) {
    const baseType = baseContext.types.find((t) => t.name === headType.name);
    if (!baseType) {
      changes.push({
        kind: 'typeDefinitionChanged',
        severity: 'low',
        line: headType.line,
        column: headType.column,
        detail: `Type alias added: ${headType.name}`,
        astNode: 'TypeAliasDeclaration',
      });
    } else if (
      normalizeWhitespace(baseType.definition) !== normalizeWhitespace(headType.definition)
    ) {
      changes.push({
        kind: 'typeDefinitionChanged',
        severity: 'medium',
        line: headType.line,
        column: headType.column,
        detail: `Type definition changed: ${headType.name}`,
        astNode: 'TypeAliasDeclaration',
      });
    }
  }

  return changes;
}
