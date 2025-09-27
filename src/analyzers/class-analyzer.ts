import type { SemanticChange, SemanticContext } from '../types/index.js';

/**
 * Analyzes class structure changes including inheritance, methods, and properties
 * Class changes are typically high-severity as they affect object-oriented contracts
 */
export function analyzeClasses(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const headClass of headContext.classes) {
    const baseClass = baseContext.classes.find((c) => c.name === headClass.name);
    if (!baseClass) {
      changes.push({
        kind: 'classStructureChanged',
        severity: 'high',
        line: headClass.line,
        column: headClass.column,
        detail: `Class added: ${headClass.name}`,
        astNode: 'ClassDeclaration',
      });
    } else {
      // Check for structural changes
      if (baseClass.extends !== headClass.extends) {
        changes.push({
          kind: 'classStructureChanged',
          severity: 'high',
          line: headClass.line,
          column: headClass.column,
          detail: `Class inheritance changed: ${headClass.name}`,
          astNode: 'ClassDeclaration',
        });
      }

      // Check for new methods
      for (const method of headClass.methods) {
        const baseMethod = baseClass.methods.find((m) => m.name === method.name);
        if (!baseMethod) {
          changes.push({
            kind: 'classStructureChanged',
            severity: 'high',
            line: headClass.line,
            column: headClass.column,
            detail: `Method added to class: ${headClass.name}.${method.name}`,
            astNode: 'MethodDeclaration',
          });
        }
      }

      // Check for new properties
      for (const property of headClass.properties) {
        const baseProperty = baseClass.properties.find((p) => p.name === property.name);
        if (!baseProperty) {
          changes.push({
            kind: 'classStructureChanged',
            severity: 'medium',
            line: headClass.line,
            column: headClass.column,
            detail: `Property added to class: ${headClass.name}.${property.name}`,
            astNode: 'PropertyDeclaration',
          });
        }
      }
    }
  }

  return changes;
}
