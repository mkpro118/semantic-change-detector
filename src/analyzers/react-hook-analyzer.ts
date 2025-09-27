import type { SemanticChange, SemanticContext } from '../types/index.js';

function getHookKey(hook: SemanticContext['reactHooks'][number]): string {
  return `${hook.type}:${hook.name}`;
}

function areDependenciesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function formatDependencies(deps: string[]): string {
  if (deps.length === 0) return '';
  return deps.join(', ');
}

/**
 * Analyzes React hook usage and dependency changes
 * Hook dependency changes are high-severity as they can cause infinite re-renders
 */
export function analyzeReactHooks(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  const baseBuckets = new Map<string, Array<(typeof baseContext.reactHooks)[number]>>();
  const baseUseStateCount = baseContext.reactHooks.filter((h) => h.type === 'useState').length;

  for (const baseHook of baseContext.reactHooks) {
    const key = getHookKey(baseHook);
    const bucket = baseBuckets.get(key);
    if (bucket) {
      bucket.push(baseHook);
    } else {
      baseBuckets.set(key, [baseHook]);
    }
  }

  for (const headHook of headContext.reactHooks) {
    const key = getHookKey(headHook);
    const bucket = baseBuckets.get(key);

    if (bucket && bucket.length > 0) {
      const baseHook = bucket.shift()!;
      if (bucket.length === 0) {
        baseBuckets.delete(key);
      }

      if (!areDependenciesEqual(baseHook.dependencies, headHook.dependencies)) {
        const baseDepsText = formatDependencies(baseHook.dependencies);
        const headDepsText = formatDependencies(headHook.dependencies);

        changes.push({
          kind: 'hookDependencyChanged',
          severity: 'high',
          line: headHook.line,
          column: headHook.column,
          detail: `Hook dependencies changed: ${headHook.name}`,
          astNode: 'CallExpression',
          context: `${baseDepsText} -> ${headDepsText}`,
        });
      }
      continue;
    }

    if (headHook.type === 'useState' && baseUseStateCount > 0) {
      // The analyzer intentionally ignores additional useState occurrences.
      continue;
    }

    if (headHook.type === 'useEffect') {
      changes.push({
        kind: 'effectAdded',
        severity: 'medium',
        line: headHook.line,
        column: headHook.column,
        detail: 'Effect added via useEffect',
        astNode: 'CallExpression',
      });
    } else {
      changes.push({
        kind: 'hookAdded',
        severity: 'medium',
        line: headHook.line,
        column: headHook.column,
        detail: `React hook added: ${headHook.name}`,
        astNode: 'CallExpression',
      });
    }
  }

  for (const bucket of baseBuckets.values()) {
    for (const baseHook of bucket) {
      if (baseHook.type === 'useEffect') {
        const depsText = formatDependencies(baseHook.dependencies);
        changes.push({
          kind: 'effectRemoved',
          severity: 'high',
          line: baseHook.line,
          column: baseHook.column,
          detail: 'Effect removed: useEffect call missing',
          astNode: 'CallExpression',
          context: depsText ? `dependencies were [${depsText}]` : undefined,
        });
      } else {
        const depsText = formatDependencies(baseHook.dependencies);
        changes.push({
          kind: 'hookRemoved',
          severity: 'medium',
          line: baseHook.line,
          column: baseHook.column,
          detail: `React hook removed: ${baseHook.name}`,
          astNode: 'CallExpression',
          context: depsText ? `dependencies were [${depsText}]` : undefined,
        });
      }
    }
  }

  return changes;
}
