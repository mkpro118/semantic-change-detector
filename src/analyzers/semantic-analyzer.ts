import type { SemanticChange, SemanticContext, DiffHunk, AnalyzerConfig } from '../types/index.js';
import { analyzeJSX } from './jsx-analyzer.js';
import { isAlphaConversion, normalizeWhitespace } from '../utils/ast-utils.js';

/**
 * Analyzes semantic changes between two versions of a TypeScript/React file
 *
 * @param baseContext - Semantic context from the base version
 * @param headContext - Semantic context from the head version
 * @param diffHunks - Git diff hunks (currently unused but kept for future enhancement)
 * @param baseContent - Raw content of base version
 * @param headContent - Raw content of head version
 * @param config - Analysis configuration
 * @returns Array of detected semantic changes
 */
export function analyzeSemanticChanges(
  baseContext: SemanticContext,
  headContext: SemanticContext,
  diffHunks: DiffHunk[],
  _baseContent: string,
  _headContent: string,
  _config: AnalyzerConfig,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Analyze different semantic aspects in parallel
  // Each analyzer function focuses on a specific language construct
  changes.push(...analyzeImports(baseContext, headContext));
  changes.push(...analyzeExports(baseContext, headContext));
  changes.push(...analyzeFunctions(baseContext, headContext));
  changes.push(...analyzeClasses(baseContext, headContext));
  changes.push(...analyzeInterfaces(baseContext, headContext));
  changes.push(...analyzeTypes(baseContext, headContext));
  changes.push(...analyzeVariables(baseContext, headContext));
  changes.push(...analyzeReactHooks(baseContext, headContext));
  changes.push(...analyzeSideEffects(baseContext, headContext));
  changes.push(...analyzeJSXChanges(baseContext, headContext));
  changes.push(...analyzeComplexity(baseContext, headContext));

  // Scope to diff hunks to reduce noise
  const scoped = scopeChangesToHunks(deduplicateChanges(changes), diffHunks);
  return scoped;
}

/**
 * Analyzes changes in import statements between two versions
 * Import changes are generally low-severity as they rarely affect runtime behavior
 */
function analyzeImports(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  // Find new imports by comparing module names
  for (const headImport of headContext.imports) {
    const baseImport = baseContext.imports.find((i) => i.module === headImport.module);
    if (!baseImport) {
      changes.push({
        kind: 'importAdded',
        severity: 'low',
        line: headImport.line,
        column: headImport.column,
        detail: `Import added: ${headImport.module}`,
        astNode: 'ImportDeclaration',
      });
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

/**
 * Analyzes changes in export statements between two versions
 * Export changes are high-severity as they affect the public API
 */
function analyzeExports(
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
    } else if (
      baseExport.type !== headExport.type ||
      baseExport.isDefault !== headExport.isDefault
    ) {
      changes.push({
        kind: 'exportSignatureChanged',
        severity: 'high',
        line: headExport.line,
        column: headExport.column,
        detail: `Export signature changed: ${headExport.name}`,
        astNode: 'ExportDeclaration',
      });
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

/**
 * Analyzes function declaration changes between two versions
 * Function signature changes are high-severity as they affect calling code
 */
function analyzeFunctions(
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
 * Analyzes class structure changes including inheritance, methods, and properties
 * Class changes are typically high-severity as they affect object-oriented contracts
 */
function analyzeClasses(
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

/**
 * Analyzes TypeScript interface changes including properties and methods
 * Interface changes affect type contracts and can break consuming code
 */
function analyzeInterfaces(
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

/**
 * Analyzes TypeScript type alias changes
 * Type changes can affect type checking and consuming code compilation
 */
function analyzeTypes(
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

/**
 * Analyzes variable declaration changes
 * Variable changes are typically low-severity unless they affect exported scope
 */
function analyzeVariables(
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

/**
 * Analyzes React hook usage and dependency changes
 * Hook dependency changes are high-severity as they can cause infinite re-renders
 */
function analyzeReactHooks(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const headHook of headContext.reactHooks) {
    const baseHook = baseContext.reactHooks.find((h) => h.name === headHook.name);
    if (!baseHook) {
      changes.push({
        kind: 'hookAdded',
        severity: 'medium',
        line: 1,
        column: 1,
        detail: `React hook added: ${headHook.name}`,
        astNode: 'CallExpression',
      });
    } else {
      // Check for dependency changes
      const baseDeps = baseHook.dependencies.sort();
      const headDeps = headHook.dependencies.sort();
      if (JSON.stringify(baseDeps) !== JSON.stringify(headDeps)) {
        changes.push({
          kind: 'hookDependencyChanged',
          severity: 'high',
          line: 1,
          column: 1,
          detail: `Hook dependencies changed: ${headHook.name}`,
          astNode: 'CallExpression',
          context: `${baseDeps.join(', ')} -> ${headDeps.join(', ')}`,
        });
      }
    }
  }

  return changes;
}

/**
 * Analyzes side effect function calls (console, fetch, API calls, etc.)
 * Side effect additions are high-severity as they change runtime behavior
 */
function analyzeSideEffects(
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

/**
 * Analyzes JSX markup and logic changes in React components
 * Focuses on conditional rendering, event handlers, and component references
 */
function analyzeJSXChanges(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  const baseJSX = analyzeJSX(baseContext.sourceFile);
  const headJSX = analyzeJSX(headContext.sourceFile);

  // Analyze JSX elements
  for (const headElement of headJSX.elements) {
    const baseElement = baseJSX.elements.find((e) => e.tagName === headElement.tagName);
    if (!baseElement) {
      changes.push({
        kind: headElement.isComponent ? 'componentReferenceChanged' : 'jsxElementAdded',
        severity: headElement.isComponent ? 'medium' : 'low',
        line: headElement.line,
        column: headElement.column,
        detail: `JSX element added: ${headElement.tagName}`,
        astNode: 'JsxElement',
      });
    }
  }

  // Analyze conditional rendering
  for (const conditional of headJSX.conditionalRendering) {
    const baseConditional = baseJSX.conditionalRendering.find(
      (c) => Math.abs(c.line - conditional.line) <= 1,
    );
    if (!baseConditional) {
      changes.push({
        kind: 'jsxLogicAdded',
        severity: 'medium',
        line: conditional.line,
        column: conditional.column,
        detail: `Conditional rendering added: ${conditional.type}`,
        astNode: 'ConditionalExpression',
      });
    }
  }

  // Analyze event handlers (only non-trivial ones)
  for (const handler of headJSX.eventHandlers) {
    // Treat inline handlers with at least minimal branching (>=2) as substantive
    if (!handler.isInline || handler.complexity >= 2) {
      const baseHandler = baseJSX.eventHandlers.find(
        (h) => h.event === handler.event && h.element === handler.element,
      );
      if (!baseHandler) {
        changes.push({
          kind: 'eventHandlerChanged',
          severity: handler.complexity > 3 ? 'high' : 'medium',
          line: handler.line,
          column: handler.column,
          detail: `Event handler added: ${handler.element}.${handler.event} (complexity: ${handler.complexity})`,
          astNode: 'JsxAttribute',
        });
      }
    }
  }

  return changes;
}

/**
 * Analyzes cyclomatic complexity changes across the entire file
 * Large complexity increases may indicate need for additional testing
 */
function analyzeComplexity(
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

/**
 * Removes duplicate changes that might be detected by multiple analyzers
 * Uses a composite key of change type, location, and detail for deduplication
 */
function deduplicateChanges(changes: SemanticChange[]): SemanticChange[] {
  const seen = new Set<string>();
  return changes.filter((change) => {
    const key = `${change.kind}-${change.line}-${change.column}-${change.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scopeChangesToHunks(changes: SemanticChange[], hunks: DiffHunk[]): SemanticChange[] {
  if (!hunks || hunks.length === 0) return changes;

  const isBaseLocated = (kind: string) => /Removed$/.test(kind);

  return changes.filter((change) => {
    // File-level signals: keep if there are any hunks
    if (change.astNode === 'SourceFile') return true;

    const ranges = hunks.map((h) => ({ base: h.baseRange, head: h.headRange }));
    if (isBaseLocated(change.kind)) {
      return ranges.some((r) => change.line >= r.base.start && change.line <= r.base.end);
    } else {
      return ranges.some((r) => change.line >= r.head.start && change.line <= r.head.end);
    }
  });
}
