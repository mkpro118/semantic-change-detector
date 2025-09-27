import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type ThrowInfo = {
  expression: string;
  line: number;
  column: number;
};

function collectThrowStatements(sourceFile: ts.SourceFile): Map<string, ThrowInfo> {
  const map = new Map<string, ThrowInfo>();

  const visit = (node: ts.Node) => {
    if (ts.isThrowStatement(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const key = `${line}:${character}`;
      const expressionText = node.expression
        ? normalizeWhitespace(node.expression.getText(sourceFile))
        : '';
      map.set(key, {
        expression: expressionText,
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return map;
}

export function analyzeThrowStatements(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseThrows = collectThrowStatements(baseContext.sourceFile);
  const headThrows = collectThrowStatements(headContext.sourceFile);

  for (const [location, headInfo] of headThrows.entries()) {
    if (!baseThrows.has(location)) {
      changes.push({
        kind: 'throwAdded',
        severity: 'high',
        line: headInfo.line,
        column: headInfo.column,
        detail: headInfo.expression
          ? `Throw added: ${headInfo.expression}`
          : 'Throw statement added',
        astNode: 'ThrowStatement',
      });
    }
  }

  for (const [location, baseInfo] of baseThrows.entries()) {
    if (!headThrows.has(location)) {
      changes.push({
        kind: 'throwRemoved',
        severity: 'high',
        line: baseInfo.line,
        column: baseInfo.column,
        detail: baseInfo.expression
          ? `Throw removed: ${baseInfo.expression}`
          : 'Throw statement removed',
        astNode: 'ThrowStatement',
      });
    }
  }

  return changes;
}
