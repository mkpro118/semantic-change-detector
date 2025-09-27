import type { SemanticChange, SemanticContext } from '../types/index.js';

/**
 * Analyzes TypeScript interface changes including properties and methods
 * Interface changes affect type contracts and can break consuming code
 */
export function analyzeInterfaces(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const headInterface of headContext.interfaces) {
    const baseInterface = baseContext.interfaces.find((i) => i.name === headInterface.name);
    if (!baseInterface) {
      changes.push({
        kind: 'interfaceModified',
        severity: 'medium',
        line: headInterface.line,
        column: headInterface.column,
        detail: `Interface added: ${headInterface.name}`,
        astNode: 'InterfaceDeclaration',
      });
    } else {
      // Check for property changes
      for (const property of headInterface.properties) {
        const baseProperty = baseInterface.properties.find((p) => p.name === property.name);
        if (!baseProperty) {
          changes.push({
            kind: 'interfaceModified',
            severity: 'medium',
            line: headInterface.line,
            column: headInterface.column,
            detail: `Property added to interface: ${headInterface.name}.${property.name}`,
            astNode: 'PropertySignature',
          });
        } else if (
          baseProperty.type !== property.type ||
          baseProperty.optional !== property.optional
        ) {
          changes.push({
            kind: 'interfaceModified',
            severity: 'high',
            line: headInterface.line,
            column: headInterface.column,
            detail: `Property type changed in interface: ${headInterface.name}.${property.name}`,
            astNode: 'PropertySignature',
          });
        }
      }

      // Check for method changes
      for (const method of headInterface.methods) {
        const baseMethod = baseInterface.methods.find((m) => m.name === method.name);
        if (!baseMethod) {
          changes.push({
            kind: 'interfaceModified',
            severity: 'high',
            line: headInterface.line,
            column: headInterface.column,
            detail: `Method added to interface: ${headInterface.name}.${method.name}`,
            astNode: 'MethodSignature',
          });
        }
      }
    }
  }

  return changes;
}
