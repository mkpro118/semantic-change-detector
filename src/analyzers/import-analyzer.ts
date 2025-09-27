import type { SemanticChange, SemanticContext, AnalyzerConfig } from '../types/index.js';
import { minimatch } from 'minimatch';

/**
 * Analyzes changes in import statements between two versions
 * Import changes are generally low-severity as they rarely affect runtime behavior
 */
export function analyzeImports(
  baseContext: SemanticContext,
  headContext: SemanticContext,
  config: AnalyzerConfig,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const sideEffectModules = config.sideEffectModules || [];

  // Find new imports by comparing module names
  for (const headImport of headContext.imports) {
    const baseImport = baseContext.imports.find((i) => i.module === headImport.module);
    if (!baseImport) {
      const isSideEffectModule = sideEffectModules.some((pattern) =>
        minimatch(headImport.module, pattern),
      );
      if (isSideEffectModule) {
        changes.push({
          kind: 'sideEffectImportAdded',
          severity: 'high',
          line: headImport.line,
          column: headImport.column,
          detail: `Side-effect import added: ${headImport.module}`,
          astNode: 'ImportDeclaration',
        });
      } else {
        changes.push({
          kind: 'importAdded',
          severity: 'low',
          line: headImport.line,
          column: headImport.column,
          detail: `Import added: ${headImport.module}`,
          astNode: 'ImportDeclaration',
        });
      }
    } else {
      // Check for changes in import structure (new specifiers added)
      const newSpecifiers = headImport.specifiers.filter((s) => !baseImport.specifiers.includes(s));
      if (newSpecifiers.length > 0) {
        changes.push({
          kind: 'importStructureChanged',
          severity: 'low',
          line: headImport.line,
          column: headImport.column,
          detail: `Import specifiers added: ${newSpecifiers.join(', ')}`,
          astNode: 'ImportDeclaration',
        });
      }
    }
  }

  // Find removed imports
  for (const baseImport of baseContext.imports) {
    const headImport = headContext.imports.find((i) => i.module === baseImport.module);
    if (!headImport) {
      changes.push({
        kind: 'importRemoved',
        severity: 'medium',
        line: baseImport.line,
        column: baseImport.column,
        detail: `Import removed: ${baseImport.module}`,
        astNode: 'ImportDeclaration',
      });
    }
  }

  return changes;
}
