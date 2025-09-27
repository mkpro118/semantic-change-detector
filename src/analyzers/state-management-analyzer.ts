import type { SemanticChange, SemanticContext } from '../types/index.js';

function countStateHooks(
  hooks: SemanticContext['reactHooks'],
  targets: readonly string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const hook of hooks) {
    if (targets.includes(hook.type)) {
      counts.set(hook.type, (counts.get(hook.type) ?? 0) + 1);
    }
  }
  return counts;
}

export function analyzeStateManagement(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const stateHooks = ['useState', 'useReducer'] as const;
  const baseCounts = countStateHooks(baseContext.reactHooks, stateHooks);
  const headCounts = countStateHooks(headContext.reactHooks, stateHooks);
  const diffLabels: string[] = [];
  let changeLine = 1;
  let changeColumn = 1;

  for (const hook of stateHooks) {
    const baseCount = baseCounts.get(hook) ?? 0;
    const headCount = headCounts.get(hook) ?? 0;
    if (baseCount === headCount) continue;

    diffLabels.push(`${hook}: ${baseCount} -> ${headCount}`);

    if (headCount > baseCount) {
      const added = headContext.reactHooks.find((h) => h.type === hook);
      if (added) {
        changeLine = added.line;
        changeColumn = added.column;
      }
    } else {
      const removed = baseContext.reactHooks.find((h) => h.type === hook);
      if (removed) {
        changeLine = removed.line;
        changeColumn = removed.column;
      }
    }
  }

  if (diffLabels.length === 0) {
    return [];
  }

  const detail = `State management hooks changed: ${diffLabels.join(', ')}`;

  return [
    {
      kind: 'stateManagementChanged',
      severity: 'high',
      line: changeLine,
      column: changeColumn,
      detail,
      astNode: 'CallExpression',
    },
  ];
}
