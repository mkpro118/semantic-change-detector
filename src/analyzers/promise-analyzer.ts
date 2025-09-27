import type { SemanticChange, SemanticContext } from '../types/index.js';
import ts from 'typescript';

type PromiseReturnInfo = {
  returnsPromise: boolean;
  line: number;
  column: number;
};

function isPromiseLikeExpression(
  expression: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
): boolean {
  if (!expression) return false;

  if (ts.isCallExpression(expression)) {
    const callee = expression.expression;
    if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'Promise'
    ) {
      return true;
    }
  }

  if (ts.isNewExpression(expression)) {
    if (ts.isIdentifier(expression.expression) && expression.expression.text === 'Promise') {
      return true;
    }
  }

  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'Promise'
  ) {
    return true;
  }

  const text = expression.getText(sourceFile);
  return /Promise\s*\./.test(text) || /^Promise$/.test(text.trim());
}

function collectPromiseReturns(sourceFile: ts.SourceFile): Map<string, PromiseReturnInfo> {
  const map = new Map<string, PromiseReturnInfo>();

  const visit = (node: ts.Node) => {
    if (ts.isReturnStatement(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const returnsPromise = isPromiseLikeExpression(node.expression, sourceFile);
      const key = `${line}:${character}`;
      map.set(key, {
        returnsPromise,
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return map;
}

export function analyzePromiseUsage(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseReturns = collectPromiseReturns(baseContext.sourceFile);
  const headReturns = collectPromiseReturns(headContext.sourceFile);

  for (const [location, headInfo] of headReturns.entries()) {
    const baseInfo = baseReturns.get(location);
    if (headInfo.returnsPromise && (!baseInfo || !baseInfo.returnsPromise)) {
      changes.push({
        kind: 'promiseAdded',
        severity: 'medium',
        line: headInfo.line,
        column: headInfo.column,
        detail: 'Return value now resolves a Promise',
        astNode: 'ReturnStatement',
      });
    }
  }

  for (const [location, baseInfo] of baseReturns.entries()) {
    const headInfo = headReturns.get(location);
    if (baseInfo.returnsPromise && (!headInfo || !headInfo.returnsPromise)) {
      changes.push({
        kind: 'promiseRemoved',
        severity: 'medium',
        line: baseInfo.line,
        column: baseInfo.column,
        detail: 'Promise return removed',
        astNode: 'ReturnStatement',
      });
    }
  }

  return changes;
}
