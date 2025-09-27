import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type LoopInfo = {
  normalizedText: string;
  kind: string;
  line: number;
  column: number;
  astNode: string;
};

function isIterationStatement(node: ts.Node): node is ts.IterationStatement {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function getLoopMetadata(node: ts.IterationStatement): { kind: string; astNode: string } {
  if (ts.isForOfStatement(node)) {
    return { kind: 'for...of', astNode: 'ForOfStatement' };
  }
  if (ts.isForInStatement(node)) {
    return { kind: 'for...in', astNode: 'ForInStatement' };
  }
  if (ts.isForStatement(node)) {
    return { kind: 'for', astNode: 'ForStatement' };
  }
  if (ts.isWhileStatement(node)) {
    return { kind: 'while', astNode: 'WhileStatement' };
  }
  if (ts.isDoStatement(node)) {
    return { kind: 'do...while', astNode: 'DoStatement' };
  }

  return { kind: 'loop', astNode: 'IterationStatement' };
}

function collectLoops(sourceFile: ts.SourceFile): Map<string, LoopInfo> {
  const loops = new Map<string, LoopInfo>();

  const visit = (node: ts.Node) => {
    if (isIterationStatement(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const key = `${line}:${character}`;
      const { kind, astNode } = getLoopMetadata(node);
      loops.set(key, {
        normalizedText: normalizeWhitespace(node.getText(sourceFile)),
        kind,
        line: line + 1,
        column: character + 1,
        astNode,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return loops;
}

export function analyzeLoops(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseLoops = collectLoops(baseContext.sourceFile);
  const headLoops = collectLoops(headContext.sourceFile);

  for (const [key, headLoop] of headLoops.entries()) {
    const baseLoop = baseLoops.get(key);
    if (!baseLoop) {
      changes.push({
        kind: 'loopAdded',
        severity: 'medium',
        line: headLoop.line,
        column: headLoop.column,
        detail: `Loop added: ${headLoop.kind}`,
        astNode: headLoop.astNode,
      });
      continue;
    }

    if (baseLoop.normalizedText !== headLoop.normalizedText) {
      changes.push({
        kind: 'loopModified',
        severity: 'medium',
        line: headLoop.line,
        column: headLoop.column,
        detail: `Loop modified: ${headLoop.kind}`,
        astNode: headLoop.astNode,
      });
    }

    baseLoops.delete(key);
  }

  for (const baseLoop of baseLoops.values()) {
    changes.push({
      kind: 'loopRemoved',
      severity: 'medium',
      line: baseLoop.line,
      column: baseLoop.column,
      detail: `Loop removed: ${baseLoop.kind}`,
      astNode: baseLoop.astNode,
    });
  }

  return changes;
}
