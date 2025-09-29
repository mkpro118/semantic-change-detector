/**
 * Module: JSX Analyzer
 *
 * Responsibility
 * - Walk a TypeScript AST to extract JSX elements, event handlers,
 *   logical and conditional rendering patterns used inside React
 *   components.
 *
 * Expected Output
 * - Returns a `JSXAnalysisResult` containing:
 *   - elements: detected JSX tags and whether they are components
 *   - eventHandlers: handlers with basic complexity signals
 *   - logicalExpressions and conditionalRendering entries
 */
import ts from 'typescript';
import type { JSXAnalysisResult, SemanticChange, SemanticContext } from '../types/index.js';
import { calculateCyclomaticComplexity, normalizeWhitespace } from '../utils/ast-utils.js';

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
  let props: Array<{ name: string; type: 'literal' | 'expression' | 'spread'; value: string }> = [];
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
): Array<{ name: string; type: 'literal' | 'expression' | 'spread'; value: string }> {
  return attributes.properties.map((prop) => {
    if (ts.isJsxAttribute(prop) && prop.name) {
      const nameNode = prop.name;
      const name = ts.isIdentifier(nameNode) ? nameNode.text : nameNode.getText(sourceFile);
      let type: 'literal' | 'expression' | 'spread' = 'literal';
      let value = 'true';

      if (prop.initializer) {
        if (ts.isJsxExpression(prop.initializer)) {
          type = 'expression';
          const expression = prop.initializer.expression;
          value = expression ? normalizeWhitespace(expression.getText(sourceFile)) : 'undefined';

          // Check for event handlers
          if (isEventHandler(name)) {
            processEventHandler(prop, sourceFile, result);
          }
        } else if (
          ts.isStringLiteral(prop.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(prop.initializer)
        ) {
          type = 'literal';
          value = prop.initializer.getText(sourceFile);
        } else {
          value = normalizeWhitespace(prop.initializer.getText(sourceFile));
        }
      }

      return { name, type, value };
    }

    if (ts.isJsxSpreadAttribute(prop)) {
      return {
        name: '...',
        type: 'spread' as const,
        value: normalizeWhitespace(prop.expression.getText(sourceFile)),
      };
    }

    return { name: 'unknown', type: 'literal' as const, value: '' };
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

// New functions from semantic-analyzer.ts

type JsxPropEntry = {
  name: string;
  type: 'literal' | 'expression' | 'spread';
  value: string;
};

type JsxPropDiff = {
  changed: Array<{ label: string; from: string; to: string }>;
  added: Array<{ label: string; value: string }>;
  removed: Array<{ label: string; value: string }>;
};

function diffJsxProps(baseProps: JsxPropEntry[], headProps: JsxPropEntry[]): JsxPropDiff | null {
  const baseMap = new Map<string, JsxPropEntry[]>();

  for (const prop of baseProps) {
    const key = propKey(prop);
    const bucket = baseMap.get(key);
    if (bucket) {
      bucket.push(prop);
    } else {
      baseMap.set(key, [prop]);
    }
  }

  const diff: JsxPropDiff = { changed: [], added: [], removed: [] };

  for (const headProp of headProps) {
    const key = propKey(headProp);
    const bucket = baseMap.get(key);
    if (!bucket || bucket.length === 0) {
      diff.added.push({ label: propLabel(headProp), value: headProp.value });
      continue;
    }

    const baseProp = bucket.shift()!;
    if (bucket.length === 0) {
      baseMap.delete(key);
    }

    if (baseProp.type !== headProp.type || baseProp.value !== headProp.value) {
      diff.changed.push({
        label: propLabel(headProp),
        from: baseProp.value,
        to: headProp.value,
      });
    }
  }

  for (const bucket of baseMap.values()) {
    for (const baseProp of bucket) {
      diff.removed.push({ label: propLabel(baseProp), value: baseProp.value });
    }
  }

  if (diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
    return null;
  }

  return diff;
}

function formatJsxPropDiffDetail(tagName: string, diff: JsxPropDiff): string {
  const segments: string[] = [];

  if (diff.changed.length > 0) {
    const list = diff.changed.map((entry) => `${entry.label} (${entry.from} -> ${entry.to})`);
    segments.push(`changed ${list.join(', ')}`);
  }

  if (diff.added.length > 0) {
    const list = diff.added.map((entry) => `${entry.label}${entry.value ? `=${entry.value}` : ''}`);
    segments.push(`added ${list.join(', ')}`);
  }

  if (diff.removed.length > 0) {
    const list = diff.removed.map(
      (entry) => `${entry.label}${entry.value ? `=${entry.value}` : ''}`,
    );
    segments.push(`removed ${list.join(', ')}`);
  }

  const summary = segments.join('; ');
  return summary
    ? `JSX props changed on <${tagName}>: ${summary}`
    : `JSX props changed on <${tagName}>`;
}

function propKey(prop: JsxPropEntry): string {
  return prop.name === '...' ? 'spread' : prop.name;
}

function propLabel(prop: JsxPropEntry): string {
  return prop.name === '...' ? `{...${prop.value || 'unknown'}}` : prop.name;
}

function analyzeJSXChanges_registerBaseElement(
  baseJSX: JSXAnalysisResult,
  baseByLocation: Map<string, (typeof baseJSX.elements)[number]>,
  baseLocationKeysByTag: Map<string, string[]>,
  element: (typeof baseJSX.elements)[number],
): void {
  const key = `${element.line}:${element.column}`;
  baseByLocation.set(key, element);
  const existing = baseLocationKeysByTag.get(element.tagName);
  if (existing) {
    existing.push(key);
  } else {
    baseLocationKeysByTag.set(element.tagName, [key]);
  }
}

function analyzeJSXChanges_removeByLocation(
  baseByLocation: Map<string, JSXAnalysisResult['elements'][number]>,
  baseLocationKeysByTag: Map<string, string[]>,
  key: string,
): void {
  const element = baseByLocation.get(key);
  if (!element) return;
  baseByLocation.delete(key);
  const byTag = baseLocationKeysByTag.get(element.tagName);
  if (!byTag) return;
  const index = byTag.indexOf(key);
  if (index >= 0) {
    byTag.splice(index, 1);
    if (byTag.length === 0) {
      baseLocationKeysByTag.delete(element.tagName);
    }
  }
}

function analyzeJSXChanges_takeByTag(
  baseJSX: JSXAnalysisResult,
  baseLocationKeysByTag: Map<string, string[]>,
  baseByLocation: Map<string, (typeof baseJSX.elements)[number]>,
  tag: string,
): (typeof baseJSX.elements)[number] | undefined {
  const keys = baseLocationKeysByTag.get(tag);
  if (!keys || keys.length === 0) return undefined;
  const key = keys.shift()!;
  const element = baseByLocation.get(key);
  if (!element) {
    if (keys.length === 0) {
      baseLocationKeysByTag.delete(tag);
    }
    return undefined;
  }
  baseByLocation.delete(key);
  if (keys.length === 0) {
    baseLocationKeysByTag.delete(tag);
  } else {
    baseLocationKeysByTag.set(tag, keys);
  }
  return element;
}

/**
 * Analyzes JSX element changes between base and head contexts.
 */
function analyzeJSXElementChanges(
  baseJSX: JSXAnalysisResult,
  headJSX: JSXAnalysisResult,
  baseByLocation: Map<string, (typeof baseJSX.elements)[number]>,
  baseLocationKeysByTag: Map<string, string[]>,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  const removeByLocation = analyzeJSXChanges_removeByLocation.bind(
    null,
    baseByLocation,
    baseLocationKeysByTag,
  );

  const takeByTag = analyzeJSXChanges_takeByTag.bind(
    null,
    baseJSX,
    baseLocationKeysByTag,
    baseByLocation,
  );

  // Analyze JSX elements
  for (const headElement of headJSX.elements) {
    const locationKey = `${headElement.line}:${headElement.column}`;
    const baseAtLocation = baseByLocation.get(locationKey);

    if (baseAtLocation) {
      removeByLocation(locationKey);

      const tagChanged = baseAtLocation.tagName !== headElement.tagName;
      const componentFlagChanged = baseAtLocation.isComponent !== headElement.isComponent;
      const childrenChanged = baseAtLocation.hasChildren !== headElement.hasChildren;
      const propDiff = diffJsxProps(baseAtLocation.props, headElement.props);

      if (tagChanged || componentFlagChanged || childrenChanged) {
        changes.push({
          kind: 'componentStructureChanged',
          severity: 'medium',
          line: headElement.line,
          column: headElement.column,
          detail: `JSX structure changed: <${baseAtLocation.tagName}> -> <${headElement.tagName}>`,
          astNode: 'JsxElement',
        });
      }

      if (propDiff) {
        changes.push({
          kind: 'jsxPropsChanged',
          severity: 'medium',
          line: headElement.line,
          column: headElement.column,
          detail: formatJsxPropDiffDetail(headElement.tagName, propDiff),
          astNode: 'JsxAttribute',
        });
      }
      continue;
    }

    if (takeByTag(headElement.tagName)) {
      continue;
    }

    changes.push({
      kind: headElement.isComponent ? 'componentReferenceChanged' : 'jsxElementAdded',
      severity: headElement.isComponent ? 'medium' : 'low',
      line: headElement.line,
      column: headElement.column,
      detail: `JSX element added: ${headElement.tagName}`,
      astNode: 'JsxElement',
    });
  }

  // Check for removed elements
  for (const baseElement of baseByLocation.values()) {
    if (baseElement.isComponent) continue;

    changes.push({
      kind: 'jsxElementRemoved',
      severity: 'low',
      line: baseElement.line,
      column: baseElement.column,
      detail: `JSX element removed: ${baseElement.tagName}`,
      astNode: 'JsxElement',
    });
  }

  return changes;
}

/**
 * Analyzes conditional rendering changes.
 */
function analyzeConditionalRenderingChanges(
  baseJSX: JSXAnalysisResult,
  headJSX: JSXAnalysisResult,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const conditional of headJSX.conditionalRendering) {
    const baseConditional = baseJSX.conditionalRendering.find(
      (c) => Math.abs(c.line - conditional.line) <= 1,
    );
    if (!baseConditional) {
      changes.push({
        kind: 'jsxLogicAdded',
        severity: 'medium',
        line: conditional.line,
        column: conditional.column,
        detail: `Conditional rendering added: ${conditional.type}`,
        astNode: 'ConditionalExpression',
      });
    }
  }

  return changes;
}

/**
 * Analyzes event handler changes (only non-trivial ones).
 */
function analyzeEventHandlerChanges(
  baseJSX: JSXAnalysisResult,
  headJSX: JSXAnalysisResult,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  for (const handler of headJSX.eventHandlers) {
    // Treat inline handlers with at least minimal branching (>=2) as substantive
    if (!handler.isInline || handler.complexity >= 2) {
      const baseHandler = baseJSX.eventHandlers.find(
        (h) => h.event === handler.event && h.element === handler.element,
      );
      if (!baseHandler) {
        changes.push({
          kind: 'eventHandlerChanged',
          severity: handler.complexity > 3 ? 'high' : 'medium',
          line: handler.line,
          column: handler.column,
          detail: `Event handler added: ${handler.element}.${handler.event} (complexity: ${handler.complexity})`,
          astNode: 'JsxAttribute',
        });
      }
    }
  }

  return changes;
}

export function analyzeJSXChanges(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];

  const baseJSX = analyzeJSX(baseContext.sourceFile);
  const headJSX = analyzeJSX(headContext.sourceFile);

  // Set up tracking maps for element analysis
  const baseByLocation = new Map<string, (typeof baseJSX.elements)[number]>();
  const baseLocationKeysByTag = new Map<string, string[]>();

  const registerBaseElement = analyzeJSXChanges_registerBaseElement.bind(
    null,
    baseJSX,
    baseByLocation,
    baseLocationKeysByTag,
  );

  for (const element of baseJSX.elements) {
    registerBaseElement(element);
  }

  // Analyze different aspects of JSX changes
  changes.push(
    ...analyzeJSXElementChanges(baseJSX, headJSX, baseByLocation, baseLocationKeysByTag),
  );
  changes.push(...analyzeConditionalRenderingChanges(baseJSX, headJSX));
  changes.push(...analyzeEventHandlerChanges(baseJSX, headJSX));

  return changes;
}
