import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type TryCatchInfo = {
  tryText: string;
  catchText: string;
  finallyText: string;
  line: number;
  column: number;
};

function collectTryCatchStatements(sourceFile: ts.SourceFile): Map<string, TryCatchInfo> {
  const map = new Map<string, TryCatchInfo>();

  const visit = (node: ts.Node) => {
    if (ts.isTryStatement(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const key = `${line}:${character}`;
      const tryText = normalizeWhitespace(node.tryBlock.getText(sourceFile));
      const catchText = node.catchClause
        ? normalizeWhitespace(node.catchClause.block.getText(sourceFile))
        : '';
      const finallyText = node.finallyBlock
        ? normalizeWhitespace(node.finallyBlock.getText(sourceFile))
        : '';

      map.set(key, {
        tryText,
        catchText,
        finallyText,
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return map;
}

export function analyzeTryCatch(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseTryCatch = collectTryCatchStatements(baseContext.sourceFile);
  const headTryCatch = collectTryCatchStatements(headContext.sourceFile);

  for (const [location, headInfo] of headTryCatch.entries()) {
    const baseInfo = baseTryCatch.get(location);
    if (!baseInfo) {
      changes.push({
        kind: 'tryCatchAdded',
        severity: 'medium',
        line: headInfo.line,
        column: headInfo.column,
        detail: 'try/catch block added',
        astNode: 'TryStatement',
      });
      continue;
    }

    if (
      baseInfo.tryText !== headInfo.tryText ||
      baseInfo.catchText !== headInfo.catchText ||
      baseInfo.finallyText !== headInfo.finallyText
    ) {
      changes.push({
        kind: 'tryCatchModified',
        severity: 'medium',
        line: headInfo.line,
        column: headInfo.column,
        detail: 'try/catch block modified',
        astNode: 'TryStatement',
      });
    }

    baseTryCatch.delete(location);
  }

  return changes;
}
