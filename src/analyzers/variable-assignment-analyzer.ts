import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type VariableAssignmentInfo = {
  assignee: string;
  value: string;
  line: number;
  column: number;
};

function collectVariableAssignments(
  sourceFile: ts.SourceFile,
): Map<string, VariableAssignmentInfo> {
  const map = new Map<string, VariableAssignmentInfo>();

  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const key = `${line}:${character}`;
      map.set(key, {
        assignee: node.left.text,
        value: normalizeWhitespace(node.right.getText(sourceFile)),
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return map;
}

export function analyzeVariableAssignments(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseAssignments = collectVariableAssignments(baseContext.sourceFile);
  const headAssignments = collectVariableAssignments(headContext.sourceFile);

  for (const [location, headInfo] of headAssignments.entries()) {
    const baseInfo = baseAssignments.get(location);
    if (!baseInfo) continue;
    if (baseInfo.assignee !== headInfo.assignee) continue;
    if (baseInfo.value === headInfo.value) continue;

    changes.push({
      kind: 'variableAssignmentChanged',
      severity: 'medium',
      line: headInfo.line,
      column: headInfo.column,
      detail: `Assignment updated for ${headInfo.assignee}: ${baseInfo.value} -> ${headInfo.value}`,
      astNode: 'BinaryExpression',
    });
  }

  return changes;
}
