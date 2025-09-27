import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type TernaryInfo = {
  condition: string;
  whenTrue: string;
  whenFalse: string;
  line: number;
  column: number;
};

function collectTernaryExpressions(sourceFile: ts.SourceFile): Map<string, TernaryInfo> {
  const map = new Map<string, TernaryInfo>();

  const visit = (node: ts.Node) => {
    if (ts.isConditionalExpression(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const key = `${line}:${character}`;
      map.set(key, {
        condition: normalizeWhitespace(node.condition.getText(sourceFile)),
        whenTrue: normalizeWhitespace(node.whenTrue.getText(sourceFile)),
        whenFalse: normalizeWhitespace(node.whenFalse.getText(sourceFile)),
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return map;
}

export function analyzeTernaryExpressions(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseTernaries = collectTernaryExpressions(baseContext.sourceFile);
  const headTernaries = collectTernaryExpressions(headContext.sourceFile);

  for (const [location, headInfo] of headTernaries.entries()) {
    if (!baseTernaries.has(location)) {
      changes.push({
        kind: 'ternaryAdded',
        severity: 'medium',
        line: headInfo.line,
        column: headInfo.column,
        detail: `Ternary expression added: condition ${headInfo.condition}`,
        astNode: 'ConditionalExpression',
      });
    }
  }

  for (const [location, baseInfo] of baseTernaries.entries()) {
    if (!headTernaries.has(location)) {
      changes.push({
        kind: 'ternaryRemoved',
        severity: 'medium',
        line: baseInfo.line,
        column: baseInfo.column,
        detail: `Ternary expression removed: condition ${baseInfo.condition}`,
        astNode: 'ConditionalExpression',
      });
    }
  }

  return changes;
}
