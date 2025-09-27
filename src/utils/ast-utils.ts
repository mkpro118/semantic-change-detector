import ts from 'typescript';
import { minimatch } from 'minimatch';

export function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return sourceFile.text.substring(node.pos, node.end).trim();
}

export function getNodeKind(node: ts.Node): string {
  return ts.SyntaxKind[node.kind];
}

export function findNodeByPosition(
  sourceFile: ts.SourceFile,
  line: number,
  column: number,
): ts.Node | undefined {
  const visit = findNodeByPosition_visit.bind(null, sourceFile, line, column);

  return visit(sourceFile);
}

function findNodeByPosition_visit(
  sourceFile: ts.SourceFile,
  line: number,
  column: number,
  node: ts.Node,
): ts.Node | undefined {
  const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(),
  );
  const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(
    node.getEnd(),
  );

  if (line >= startLine && line <= endLine) {
    if (line === startLine && column < startCol) return undefined;
    if (line === endLine && column > endCol) return undefined;

    // Check children first for more specific match
    for (const child of node.getChildren()) {
      const result = findNodeByPosition_visit(sourceFile, line, column, child);
      if (result) return result;
    }

    return node;
  }

  return undefined;
}

export function calculateCyclomaticComplexity(node: ts.Node): number {
  let complexity = 1; // Base complexity

  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.BinaryExpression:
        const binaryExpr = node as ts.BinaryExpression;
        if (
          binaryExpr.operatorToken?.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          binaryExpr.operatorToken?.kind === ts.SyntaxKind.BarBarToken
        ) {
          complexity++;
        } else if (node.kind !== ts.SyntaxKind.BinaryExpression) {
          complexity++;
        }
        break;
      case ts.SyntaxKind.CatchClause:
        complexity++;
        break;
    }

    ts.forEachChild(node, visit);
  }

  visit(node);
  return complexity;
}

export function isReactHook(name: string): boolean {
  return name.startsWith('use') && name.length > 3 && /^use[A-Z]/.test(name);
}

export function extractHookDependencies(node: ts.CallExpression): string[] {
  if (node.arguments.length < 2) return [];

  const depsArg = node.arguments[1] as ts.Expression | undefined;
  if (!depsArg || !ts.isArrayLiteralExpression(depsArg)) return [];

  return depsArg.elements.filter(ts.isIdentifier).map((id) => id.text);
}

export function isSideEffectCall(
  callExpression: ts.CallExpression,
  sideEffectCallees: string[],
): boolean {
  const expression = callExpression.expression;

  const getCallPath = isSideEffectCall_getCallPath.bind(null);

  const callPath = getCallPath(expression);
  if (!callPath) return false;

  // Support glob patterns like:
  // - console.*
  // - fetch
  // - *.api.*
  // - track*
  return sideEffectCallees.some((pattern) =>
    minimatch(callPath, pattern, { dot: true, nocase: false }),
  );
}

function isSideEffectCall_getCallPath(expr: ts.Expression): string {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const left = isSideEffectCall_getCallPath(expr.expression);
    return left ? `${left}.${expr.name.text}` : expr.name.text;
  }
  if (ts.isElementAccessExpression(expr)) {
    const left = isSideEffectCall_getCallPath(expr.expression);
    const arg = expr.argumentExpression;
    if (arg && ts.isStringLiteral(arg)) {
      return left ? `${left}.${arg.text}` : arg.text;
    }
    // Unknown dynamic key: fall back to left only to allow prefix matches like "analytics.*"
    return left;
  }
  return '';
}

export function getParameterSignature(parameter: ts.ParameterDeclaration): {
  name: string;
  type: string;
  optional: boolean;
} {
  const name = parameter.name.getText();
  const type = parameter.type ? parameter.type.getText() : 'any';
  const optional = !!parameter.questionToken;

  return { name, type, optional };
}

export function getFunctionSignature(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ArrowFunction,
): string {
  const name = node.name ? node.name.getText() : 'anonymous';
  const params = node.parameters
    .map((p) => {
      const paramName = p.name.getText();
      const paramType = p.type ? p.type.getText() : 'any';
      const optional = p.questionToken ? '?' : '';
      return `${paramName}${optional}: ${paramType}`;
    })
    .join(', ');

  const returnType = node.type ? node.type.getText() : 'any';
  const asyncModifier = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
    ? 'async '
    : '';

  return `${asyncModifier}${name}(${params}): ${returnType}`;
}

export function isAlphaConversion(oldName: string, newName: string, context: string): boolean {
  // Simple heuristic: if the context is similar but names are different, it might be alpha conversion
  const oldTokens = context.split(/\W+/).filter(Boolean);
  const newTokens = context.split(/\W+/).filter(Boolean);

  const oldCount = oldTokens.filter((token) => token === oldName).length;
  const newCount = newTokens.filter((token) => token === newName).length;

  // If the old name appears in old context and new name appears in new context
  // with similar frequency, it's likely alpha conversion
  return oldCount > 0 && newCount > 0 && Math.abs(oldCount - newCount) <= 1;
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function getVisibilityModifier(node: ts.ClassElement): 'public' | 'private' | 'protected' {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (mods) {
    for (const modifier of mods) {
      switch (modifier.kind) {
        case ts.SyntaxKind.PrivateKeyword:
          return 'private';
        case ts.SyntaxKind.ProtectedKeyword:
          return 'protected';
        case ts.SyntaxKind.PublicKeyword:
          return 'public';
      }
    }
  }
  return 'public'; // Default visibility
}

export function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 1; j <= an; j++) {
    if (!matrix[0]) matrix[0] = [];
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      if (!matrix[i]) matrix[i] = [];
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // deletion
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }
  return matrix[bn]![an]!;
}
