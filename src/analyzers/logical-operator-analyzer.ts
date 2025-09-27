import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type LogicalOperatorInfo = {
  operator: string;
  left: string;
  right: string;
  line: number;
  column: number;
};

const LOGICAL_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function collectLogicalOperators(sourceFile: ts.SourceFile): Map<string, LogicalOperatorInfo> {
  const operators = new Map<string, LogicalOperatorInfo>();

  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.operatorToken.getStart(sourceFile),
      );
      const key = `${line}:${character}`;
      operators.set(key, {
        operator: node.operatorToken.getText(sourceFile),
        left: normalizeWhitespace(node.left.getText(sourceFile).trim()),
        right: normalizeWhitespace(node.right.getText(sourceFile).trim()),
        line: line + 1,
        column: character + 1,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return operators;
}

export function analyzeLogicalOperators(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseOperators = collectLogicalOperators(baseContext.sourceFile);
  const headOperators = collectLogicalOperators(headContext.sourceFile);

  for (const [location, headInfo] of headOperators.entries()) {
    const baseInfo = baseOperators.get(location);
    if (!baseInfo) continue;
    if (baseInfo.operator === headInfo.operator) continue;
    if (baseInfo.left !== headInfo.left || baseInfo.right !== headInfo.right) continue;

    changes.push({
      kind: 'logicalOperatorChanged',
      severity: 'medium',
      line: headInfo.line,
      column: headInfo.column,
      detail: `Logical operator changed from ${baseInfo.operator} to ${headInfo.operator} between ${headInfo.left} and ${headInfo.right}`,
      astNode: 'BinaryExpression',
    });
  }

  return changes;
}
