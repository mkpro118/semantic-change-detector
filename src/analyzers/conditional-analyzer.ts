import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

type ConditionalInfo = {
  fingerprint: string;
  normalizedCondition: string;
  conditionText: string;
  scope: string;
  line: number;
  column: number;
};

function getEnclosingScopeName(node: ts.Node): string {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isFunctionLike(current)) {
      if (current.name && ts.isIdentifier(current.name)) {
        return current.name.text;
      }

      if (
        current.parent &&
        ts.isVariableDeclaration(current.parent) &&
        ts.isIdentifier(current.parent.name)
      ) {
        return current.parent.name.text;
      }

      if (ts.isMethodDeclaration(current) && current.name) {
        return current.name.getText();
      }
    }

    if (ts.isClassDeclaration(current) && current.name) {
      return current.name.text;
    }

    if (ts.isClassExpression(current) && current.name) {
      return current.name.text;
    }

    current = current.parent;
  }

  return 'global scope';
}

function collectConditionals(sourceFile: ts.SourceFile): ConditionalInfo[] {
  const conditionals: ConditionalInfo[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node)) {
      const conditionText = node.expression.getText(sourceFile).trim();
      const thenText = node.thenStatement.getText(sourceFile).trim();
      const elseText = node.elseStatement ? node.elseStatement.getText(sourceFile).trim() : '';
      const scope = getEnclosingScopeName(node);
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

      conditionals.push({
        fingerprint: `${scope}::${normalizeWhitespace(thenText)}::${normalizeWhitespace(elseText)}`,
        normalizedCondition: normalizeWhitespace(conditionText),
        conditionText,
        scope,
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return conditionals;
}

export function analyzeConditionals(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseConditionals = collectConditionals(baseContext.sourceFile);
  const headConditionals = collectConditionals(headContext.sourceFile);
  const baseBuckets = new Map<string, ConditionalInfo[]>();

  for (const info of baseConditionals) {
    const bucket = baseBuckets.get(info.fingerprint);
    if (bucket) {
      bucket.push(info);
    } else {
      baseBuckets.set(info.fingerprint, [info]);
    }
  }

  for (const headInfo of headConditionals) {
    const bucket = baseBuckets.get(headInfo.fingerprint);
    if (bucket && bucket.length > 0) {
      const baseInfo = bucket.shift()!;
      if (baseInfo.normalizedCondition !== headInfo.normalizedCondition) {
        changes.push({
          kind: 'conditionalModified',
          severity: 'high',
          line: headInfo.line,
          column: headInfo.column,
          detail: `Conditional modified in ${headInfo.scope}: ${baseInfo.conditionText} -> ${headInfo.conditionText}`,
          astNode: 'IfStatement',
        });
      }
      continue;
    }

    changes.push({
      kind: 'conditionalAdded',
      severity: 'high',
      line: headInfo.line,
      column: headInfo.column,
      detail: `Conditional added in ${headInfo.scope}: ${headInfo.conditionText}`,
      astNode: 'IfStatement',
    });
  }

  for (const bucket of baseBuckets.values()) {
    for (const baseInfo of bucket) {
      changes.push({
        kind: 'conditionalRemoved',
        severity: 'high',
        line: baseInfo.line,
        column: baseInfo.column,
        detail: `Conditional removed from ${baseInfo.scope}: ${baseInfo.conditionText}`,
        astNode: 'IfStatement',
      });
    }
  }

  return changes;
}
