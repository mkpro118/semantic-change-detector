import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type DestructuringInfo = {
  key: string;
  pattern: string;
  initializer: string;
  line: number;
  column: number;
};

function collectDestructuringDeclarations(sourceFile: ts.SourceFile): DestructuringInfo[] {
  const declarations: DestructuringInfo[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name)) &&
      node.initializer
    ) {
      const patternText = node.name.getText(sourceFile).trim();
      const initializerText = node.initializer.getText(sourceFile).trim();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

      declarations.push({
        key: `${node.name.kind}:${normalizeWhitespace(patternText)}::${normalizeWhitespace(initializerText)}`,
        pattern: patternText,
        initializer: initializerText,
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return declarations;
}

export function analyzeDestructuring(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseDestructuring = collectDestructuringDeclarations(baseContext.sourceFile);
  const headDestructuring = collectDestructuringDeclarations(headContext.sourceFile);
  const baseBuckets = new Map<string, DestructuringInfo[]>();

  for (const info of baseDestructuring) {
    const bucket = baseBuckets.get(info.key);
    if (bucket) {
      bucket.push(info);
    } else {
      baseBuckets.set(info.key, [info]);
    }
  }

  for (const headInfo of headDestructuring) {
    const bucket = baseBuckets.get(headInfo.key);
    if (bucket && bucket.length > 0) {
      bucket.shift();
      continue;
    }

    changes.push({
      kind: 'destructuringAdded',
      severity: 'medium',
      line: headInfo.line,
      column: headInfo.column,
      detail: `Destructuring added: ${headInfo.pattern} from ${headInfo.initializer}`,
      astNode: 'VariableDeclaration',
    });
  }

  for (const bucket of baseBuckets.values()) {
    for (const baseInfo of bucket) {
      changes.push({
        kind: 'destructuringRemoved',
        severity: 'medium',
        line: baseInfo.line,
        column: baseInfo.column,
        detail: `Destructuring removed: ${baseInfo.pattern} from ${baseInfo.initializer}`,
        astNode: 'VariableDeclaration',
      });
    }
  }

  return changes;
}
