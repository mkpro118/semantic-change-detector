import type { SemanticChange, SemanticContext } from '../types/index.js';
import { normalizeWhitespace } from '../utils/ast-utils.js';
import ts from 'typescript';

const ARRAY_MUTATION_METHODS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
]);

type ArrayMutationInfo = {
  key: string;
  display: string;
  line: number;
  column: number;
};

function collectArrayMutations(sourceFile: ts.SourceFile): ArrayMutationInfo[] {
  const mutations: ArrayMutationInfo[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      if (ARRAY_MUTATION_METHODS.has(methodName)) {
        const targetText = node.expression.expression.getText(sourceFile).trim();
        const key = `${targetText}.${methodName}`;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        mutations.push({
          key,
          display: `${targetText}.${methodName}()`,
          line: line + 1,
          column: character + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return mutations;
}

export function analyzeArrayMutations(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseMutations = collectArrayMutations(baseContext.sourceFile);
  const headMutations = collectArrayMutations(headContext.sourceFile);
  const baseCounts = new Map<string, number>();
  for (const mutation of baseMutations) {
    baseCounts.set(mutation.key, (baseCounts.get(mutation.key) ?? 0) + 1);
  }

  for (const mutation of headMutations) {
    const baseCount = baseCounts.get(mutation.key);
    if (baseCount && baseCount > 0) {
      baseCounts.set(mutation.key, baseCount - 1);
      continue;
    }

    changes.push({
      kind: 'arrayMutation',
      severity: 'medium',
      line: mutation.line,
      column: mutation.column,
      detail: `Array mutation added via ${mutation.display}`,
      astNode: 'CallExpression',
    });
  }

  return changes;
}

type ObjectMutationInfo = {
  key: string;
  display: string;
  line: number;
  column: number;
};

const PROPERTY_MUTATION_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
]);

function collectObjectMutations(sourceFile: ts.SourceFile): ObjectMutationInfo[] {
  const mutations: ObjectMutationInfo[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      PROPERTY_MUTATION_OPERATORS.has(node.operatorToken.kind) &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const leftText = normalizeWhitespace(node.left.getText(sourceFile));
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

      mutations.push({
        key: leftText,
        display: leftText,
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return mutations;
}

export function analyzeObjectMutations(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseMutations = collectObjectMutations(baseContext.sourceFile);
  const headMutations = collectObjectMutations(headContext.sourceFile);
  const baseBuckets = new Map<string, ObjectMutationInfo[]>();

  for (const mutation of baseMutations) {
    const bucket = baseBuckets.get(mutation.key);
    if (bucket) {
      bucket.push(mutation);
    } else {
      baseBuckets.set(mutation.key, [mutation]);
    }
  }

  for (const mutation of headMutations) {
    const bucket = baseBuckets.get(mutation.key);
    if (bucket && bucket.length > 0) {
      bucket.shift();
      if (bucket.length === 0) {
        baseBuckets.delete(mutation.key);
      }
      continue;
    }

    changes.push({
      kind: 'objectMutation',
      severity: 'medium',
      line: mutation.line,
      column: mutation.column,
      detail: `Object property mutated: ${mutation.display}`,
      astNode: 'BinaryExpression',
    });
  }

  return changes;
}
