import * as ts from 'typescript';
import type { JSXAnalysisResult } from '../types/index.js';
import { calculateCyclomaticComplexity } from '../utils/ast-utils.js';

/**
 * Analyzes JSX elements, event handlers, and conditional rendering patterns in React components
 *
 * @param sourceFile - TypeScript source file to analyze
 * @returns Analysis result containing JSX elements, event handlers, and logic patterns
 */
export function analyzeJSX(sourceFile: ts.SourceFile): JSXAnalysisResult {
  const result: JSXAnalysisResult = {
    elements: [],
    eventHandlers: [],
    logicalExpressions: [],
    conditionalRendering: [],
    componentReferences: [],
  };

  const visit = (node: ts.Node) => {
    processJSXNode(node, sourceFile, result);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return result;
}

/**
 * Processes individual AST nodes to extract JSX-related information
 * Handles different node types including elements, expressions, and conditional logic
 */
function processJSXNode(node: ts.Node, sourceFile: ts.SourceFile, result: JSXAnalysisResult): void {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  switch (node.kind) {
    case ts.SyntaxKind.JsxElement:
    case ts.SyntaxKind.JsxSelfClosingElement:
      processJSXElement(node, sourceFile, result);
      break;
    case ts.SyntaxKind.JsxExpression:
      processJSXExpression(node as ts.JsxExpression, sourceFile, result);
      break;
    case ts.SyntaxKind.ConditionalExpression:
      if (isInJSXContext(node)) {
        result.conditionalRendering.push({
          line: line + 1,
          column: character + 1,
          type: 'ternary',
        });
      }
      break;
    case ts.SyntaxKind.BinaryExpression:
      const binaryExpr = node as ts.BinaryExpression;
      if (isInJSXContext(node) && isLogicalOperator(binaryExpr.operatorToken.kind)) {
        result.logicalExpressions.push({
          line: line + 1,
          column: character + 1,
          operator: binaryExpr.operatorToken.getText(),
          complexity: calculateCyclomaticComplexity(node),
        });

        if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
          result.conditionalRendering.push({
            line: line + 1,
            column: character + 1,
            type: 'logical',
          });
        }
      }
      break;
  }
}

/**
 * Extracts information from JSX elements including tag names, props, and component detection
 * Distinguishes between HTML elements and React components based on capitalization
 */
function processJSXElement(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  result: JSXAnalysisResult,
): void {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  let tagName = '';
  let props: Array<{ name: string; type: 'literal' | 'expression' | 'spread' }> = [];
  let hasChildren = false;

  if (ts.isJsxElement(node)) {
    if (ts.isIdentifier(node.openingElement.tagName)) {
      tagName = node.openingElement.tagName.text;
    }
    hasChildren = node.children.length > 0;
    if (node.openingElement.attributes) {
      props = extractProps(node.openingElement.attributes, sourceFile, result);
    }
  } else if (ts.isJsxSelfClosingElement(node)) {
    if (ts.isIdentifier(node.tagName)) {
      tagName = node.tagName.text;
    }
    if (node.attributes) {
      props = extractProps(node.attributes, sourceFile, result);
    }
  }

  if (tagName) {
    const isComponent = /^[A-Z]/.test(tagName);

    result.elements.push({
      tagName,
      line: line + 1,
      column: character + 1,
      props,
      hasChildren,
      isComponent,
    });

    if (isComponent) {
      result.componentReferences.push(tagName);
    }
  }
}

/**
 * Extracts and categorizes JSX props into literals, expressions, or spread attributes
 * Also processes event handlers for complexity analysis
 */
function extractProps(
  attributes: ts.JsxAttributes,
  sourceFile: ts.SourceFile,
  result: JSXAnalysisResult,
): Array<{ name: string; type: 'literal' | 'expression' | 'spread' }> {
  return attributes.properties.map((prop) => {
    if (ts.isJsxAttribute(prop) && prop.name) {
      const nameNode = prop.name;
      const name = ts.isIdentifier(nameNode) ? nameNode.text : nameNode.getText(sourceFile);
      let type: 'literal' | 'expression' | 'spread' = 'literal';

      if (prop.initializer) {
        if (ts.isJsxExpression(prop.initializer)) {
          type = 'expression';

          // Check for event handlers
          if (isEventHandler(name)) {
            processEventHandler(prop, sourceFile, result);
          }
        } else if (ts.isStringLiteral(prop.initializer)) {
          type = 'literal';
        }
      }

      return { name, type };
    } else if (ts.isJsxSpreadAttribute(prop)) {
      return { name: '...', type: 'spread' as const };
    }
    return { name: 'unknown', type: 'literal' as const };
  });
}

/**
 * Analyzes event handler complexity and determines if they require testing
 * Filters out trivial inline handlers (empty arrow functions) to reduce noise
 */
function processEventHandler(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  result: JSXAnalysisResult,
): void {
  if (!attribute.initializer || !ts.isJsxExpression(attribute.initializer)) return;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(attribute.getStart());
  const eventName = attribute.name
    ? ts.isIdentifier(attribute.name)
      ? attribute.name.text
      : attribute.name.getText(sourceFile)
    : 'unknown';

  let isInline = false;
  let complexity = 1;

  if (attribute.initializer.expression) {
    const expr = attribute.initializer.expression;
    // Check if it's an inline arrow function or function expression
    if (ts.isArrowFunction(expr)) {
      isInline = true;
      complexity = calculateCyclomaticComplexity(expr);

      const body = expr.body;
      if (ts.isBlock(body)) {
        const stmts = body.statements;
        const hasIf = stmts.some((s) => ts.isIfStatement(s));
        if (hasIf || stmts.length >= 2) {
          complexity = Math.max(complexity, 2);
        }
      }
    } else if (ts.isFunctionExpression(expr)) {
      isInline = true;
      complexity = calculateCyclomaticComplexity(expr);
      const body = expr.body;
      if (ts.isBlock(body)) {
        const stmts = body.statements;
        const hasIf = stmts.some((s) => ts.isIfStatement(s));
        if (hasIf || stmts.length >= 2) {
          complexity = Math.max(complexity, 2);
        }
      }
    } else if (ts.isCallExpression(expr)) {
      // Check for patterns like () => handleClick()
      if (ts.isArrowFunction(expr.expression)) {
        isInline = true;
        complexity = calculateCyclomaticComplexity(expr);
      }
    }
  }

  // Only include event handlers with meaningful complexity or non-inline handlers
  if (!isInline || complexity >= 2) {
    result.eventHandlers.push({
      element: getElementName(attribute),
      event: eventName,
      line: line + 1,
      column: character + 1,
      isInline,
      complexity,
    });
  }
}

/**
 * Processes JSX expressions to detect conditional rendering and logical operators
 * Identifies patterns like {condition && <Component />} and {condition ? <A /> : <B />}
 */
function processJSXExpression(
  node: ts.JsxExpression,
  sourceFile: ts.SourceFile,
  result: JSXAnalysisResult,
): void {
  if (!node.expression) return;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  // Check for conditional rendering patterns
  if (ts.isConditionalExpression(node.expression)) {
    result.conditionalRendering.push({
      line: line + 1,
      column: character + 1,
      type: 'ternary',
    });
  } else if (ts.isBinaryExpression(node.expression)) {
    const binaryExpr = node.expression;
    if (isLogicalOperator(binaryExpr.operatorToken.kind)) {
      result.logicalExpressions.push({
        line: line + 1,
        column: character + 1,
        operator: binaryExpr.operatorToken.getText(),
        complexity: calculateCyclomaticComplexity(node.expression),
      });

      if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        result.conditionalRendering.push({
          line: line + 1,
          column: character + 1,
          type: 'conditional',
        });
      }
    }
  }
}

/**
 * Determines if a JSX prop name represents an event handler
 * Follows React convention of 'on' prefix followed by capitalized event name
 */
function isEventHandler(propName: string): boolean {
  return propName.startsWith('on') && propName.length > 2 && /^on[A-Z]/.test(propName);
}

/**
 * Checks if a syntax kind represents a logical operator used in conditional rendering
 * Covers &&, ||, and ?? operators commonly used in JSX expressions
 */
function isLogicalOperator(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.AmpersandAmpersandToken ||
    kind === ts.SyntaxKind.BarBarToken ||
    kind === ts.SyntaxKind.QuestionQuestionToken
  );
}

/**
 * Determines if a node is within JSX context by traversing up the AST
 * Used to distinguish JSX conditional rendering from regular JavaScript conditionals
 */
function isInJSXContext(node: ts.Node): boolean {
  let parent = node.parent;
  while (parent) {
    if (
      ts.isJsxElement(parent) ||
      ts.isJsxSelfClosingElement(parent) ||
      ts.isJsxExpression(parent)
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Finds the JSX element name that contains a given attribute
 * Used to associate event handlers with their containing elements
 */
function getElementName(attribute: ts.JsxAttribute): string {
  let parent: ts.Node | undefined = attribute.parent;
  while (parent) {
    if (ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent)) {
      const tagExpr = parent.tagName;
      return ts.isIdentifier(tagExpr) ? tagExpr.text : tagExpr.getText();
    }
    parent = parent.parent;
  }
  return 'unknown';
}
