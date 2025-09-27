import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type SpreadUsageInfo = {
  key: string;
  display: string;
  astNode: string;
  line: number;
  column: number;
};

function collectSpreadUsages(sourceFile: ts.SourceFile): SpreadUsageInfo[] {
  const spreads: SpreadUsageInfo[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((property) => {
        if (ts.isSpreadAssignment(property)) {
          const spreadText = normalizeWhitespace(property.expression.getText(sourceFile));
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(property.getStart());
          spreads.push({
            key: `object:${spreadText}`,
            display: `{...${spreadText}}`,
            astNode: 'SpreadAssignment',
            line: line + 1,
            column: character + 1,
          });
        }
      });
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element) => {
        if (ts.isSpreadElement(element)) {
          const spreadText = normalizeWhitespace(element.expression.getText(sourceFile));
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(element.getStart());
          spreads.push({
            key: `array:${spreadText}`,
            display: `...${spreadText}`,
            astNode: 'SpreadElement',
            line: line + 1,
            column: character + 1,
          });
        }
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return spreads;
}

export function analyzeSpreadOperators(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseSpreads = collectSpreadUsages(baseContext.sourceFile);
  const headSpreads = collectSpreadUsages(headContext.sourceFile);
  const baseBuckets = new Map<string, SpreadUsageInfo[]>();

  for (const spread of baseSpreads) {
    const bucket = baseBuckets.get(spread.key);
    if (bucket) {
      bucket.push(spread);
    } else {
      baseBuckets.set(spread.key, [spread]);
    }
  }

  for (const spread of headSpreads) {
    const bucket = baseBuckets.get(spread.key);
    if (bucket && bucket.length > 0) {
      bucket.shift();
      if (bucket.length === 0) {
        baseBuckets.delete(spread.key);
      }
      continue;
    }

    changes.push({
      kind: 'spreadOperatorAdded',
      severity: 'medium',
      line: spread.line,
      column: spread.column,
      detail: `Spread operator added: ${spread.display}`,
      astNode: spread.astNode,
    });
  }

  for (const bucket of baseBuckets.values()) {
    for (const spread of bucket) {
      changes.push({
        kind: 'spreadOperatorRemoved',
        severity: 'medium',
        line: spread.line,
        column: spread.column,
        detail: `Spread operator removed: ${spread.display}`,
        astNode: spread.astNode,
      });
    }
  }

  return changes;
}
