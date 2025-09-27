import type { SemanticChange, SemanticContext } from '../types/index.js';

/**
 * Analyzes changes in export statements between two versions
 * Export changes are high-severity as they affect the public API
 */
export function analyzeExports(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Find new exports
  for (const headExport of headContext.exports) {
    const baseExport = baseContext.exports.find((e) => e.name === headExport.name);
    if (!baseExport) {
      changes.push({
        kind: 'exportAdded',
        severity: 'medium',
        line: headExport.line,
        column: headExport.column,
        detail: `Export added: ${headExport.name} (${headExport.type})`,
        astNode: 'ExportDeclaration',
      });
      continue;
    }

    if (baseExport.type !== headExport.type || baseExport.isDefault !== headExport.isDefault) {
      changes.push({
        kind: 'exportSignatureChanged',
        severity: 'high',
        line: headExport.line,
        column: headExport.column,
        detail: `Export signature changed: ${headExport.name}`,
        astNode: 'ExportDeclaration',
      });
      continue;
    }

    if (headExport.type === 'variable' || headExport.type === 'const') {
      const baseVariable = baseContext.variables.find((v) => v.name === headExport.name);
      const headVariable = headContext.variables.find((v) => v.name === headExport.name);

      if (baseVariable && headVariable && baseVariable.type !== headVariable.type) {
        changes.push({
          kind: 'exportSignatureChanged',
          severity: 'medium',
          line: headExport.line,
          column: headExport.column,
          detail: `Export signature changed: ${headExport.name} (${baseVariable.type} -> ${headVariable.type})`,
          astNode: 'ExportDeclaration',
        });
      }
    }
  }

  // Find removed exports
  for (const baseExport of baseContext.exports) {
    const headExport = headContext.exports.find((e) => e.name === baseExport.name);
    if (!headExport) {
      changes.push({
        kind: 'exportRemoved',
        severity: 'high',
        line: baseExport.line,
        column: baseExport.column,
        detail: `Export removed: ${baseExport.name}`,
        astNode: 'ExportDeclaration',
      });
    }
  }

  return changes;
}
