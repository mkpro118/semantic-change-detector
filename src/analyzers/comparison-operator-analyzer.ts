import type { SemanticChange, SemanticContext } from '../types/index.js';
import ts from 'typescript';

type ComparisonInfo = {
  operator: string;
  left: string;
  right: string;
  line: number;
  column: number;
};

const COMPARISON_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

function collectComparisonOperators(sourceFile: ts.SourceFile): Map<string, ComparisonInfo> {
  const operators = new Map<string, ComparisonInfo>();

  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && COMPARISON_OPERATORS.has(node.operatorToken.kind)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.operatorToken.getStart(sourceFile),
      );
      const key = `${line}:${character}`;
      operators.set(key, {
        operator: node.operatorToken.getText(sourceFile),
        left: node.left.getText(sourceFile).trim(),
        right: node.right.getText(sourceFile).trim(),
        line: line + 1,
        column: character + 1,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return operators;
}

export function analyzeComparisonOperators(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseOperators = collectComparisonOperators(baseContext.sourceFile);
  const headOperators = collectComparisonOperators(headContext.sourceFile);

  for (const [location, headInfo] of headOperators.entries()) {
    const baseInfo = baseOperators.get(location);
    if (!baseInfo) continue;
    if (baseInfo.operator === headInfo.operator) continue;
    if (baseInfo.left !== headInfo.left || baseInfo.right !== headInfo.right) continue;

    changes.push({
      kind: 'comparisonOperatorChanged',
      severity: 'medium',
      line: headInfo.line,
      column: headInfo.column,
      detail: `Comparison operator changed from ${baseInfo.operator} to ${headInfo.operator} between ${headInfo.left} and ${headInfo.right}`,
      astNode: 'BinaryExpression',
    });
  }

  return changes;
}
