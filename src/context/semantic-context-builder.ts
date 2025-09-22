import * as ts from 'typescript';
import type { SemanticContext } from '../types/index.js';
import {
  calculateCyclomaticComplexity,
  isReactHook,
  extractHookDependencies,
  isSideEffectCall,
  getParameterSignature,
  getVisibilityModifier,
} from '../utils/ast-utils.js';

export function createSemanticContext(
  sourceFile: ts.SourceFile,
  sideEffectCallees: string[] = [],
): SemanticContext {
  const context: SemanticContext = {
    sourceFile,
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    interfaces: [],
    types: [],
    variables: [],
    reactHooks: [],
    jsxElements: [],
    complexity: 0,
    sideEffectCalls: [],
  };

  const visit = (node: ts.Node) => {
    processNode(node, context, sideEffectCallees);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  // Calculate overall complexity
  context.complexity = calculateCyclomaticComplexity(sourceFile);

  return context;
}

function processNode(node: ts.Node, context: SemanticContext, sideEffectCallees: string[]): void {
  switch (node.kind) {
    case ts.SyntaxKind.ImportDeclaration:
      processImport(node as ts.ImportDeclaration, context);
      break;
    case ts.SyntaxKind.ExportDeclaration:
    case ts.SyntaxKind.ExportAssignment:
      processExport(node, context);
      break;
    case ts.SyntaxKind.FunctionDeclaration:
      pushExportFromDeclaration(node, context);
      processFunction(node as ts.FunctionDeclaration, context);
      break;
    case ts.SyntaxKind.ClassDeclaration:
      pushExportFromDeclaration(node, context);
      processClass(node as ts.ClassDeclaration, context);
      break;
    case ts.SyntaxKind.InterfaceDeclaration:
      pushExportFromDeclaration(node, context);
      processInterface(node as ts.InterfaceDeclaration, context);
      break;
    case ts.SyntaxKind.TypeAliasDeclaration:
      pushExportFromDeclaration(node, context);
      processTypeAlias(node as ts.TypeAliasDeclaration, context);
      break;
    case ts.SyntaxKind.VariableStatement:
      pushExportFromDeclaration(node, context);
      processVariableStatement(node as ts.VariableStatement, context);
      break;
    case ts.SyntaxKind.CallExpression:
      processCallExpression(node as ts.CallExpression, context, sideEffectCallees);
      break;
    case ts.SyntaxKind.JsxElement:
    case ts.SyntaxKind.JsxSelfClosingElement:
      processJsxElement(node, context);
      break;
  }
}

function processImport(node: ts.ImportDeclaration, context: SemanticContext): void {
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return;

  const module = node.moduleSpecifier.text;
  const specifiers: string[] = [];
  let isDefault = false;
  let isNamespace = false;
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());

  if (node.importClause) {
    if (node.importClause.name) {
      specifiers.push(node.importClause.name.text);
      isDefault = true;
    }

    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        specifiers.push(node.importClause.namedBindings.name.text);
        isNamespace = true;
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((element) => {
          specifiers.push(element.name.text);
        });
      }
    }
  }

  context.imports.push({
    module,
    specifiers,
    isDefault,
    isNamespace,
    line: line + 1,
    column: character + 1,
  });
}

function processExport(node: ts.Node, context: SemanticContext): void {
  if (ts.isExportDeclaration(node)) {
    // Handle re-exports
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());
      node.exportClause.elements.forEach((element) => {
        context.exports.push({
          name: element.name.text,
          type: 'variable',
          isDefault: false,
          line: line + 1,
          column: character + 1,
        });
      });
    }
  } else if (ts.isExportAssignment(node)) {
    const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    context.exports.push({
      name: 'default',
      type: 'variable',
      isDefault: true,
      line: line + 1,
      column: character + 1,
    });
  }

  // Check for export modifiers on declarations
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (mods && mods.length > 0) {
    const hasExport = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

    if (hasExport) {
      let name = 'unknown';
      let type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' = 'variable';
      const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());

      if (ts.isFunctionDeclaration(node) && node.name) {
        name = node.name.text;
        type = 'function';
      } else if (ts.isClassDeclaration(node) && node.name) {
        name = node.name.text;
        type = 'class';
      } else if (ts.isInterfaceDeclaration(node)) {
        name = node.name.text;
        type = 'interface';
      } else if (ts.isTypeAliasDeclaration(node)) {
        name = node.name.text;
        type = 'type';
      }

      context.exports.push({ name, type, isDefault, line: line + 1, column: character + 1 });
    }
  }
}

function pushExportFromDeclaration(node: ts.Node, context: SemanticContext): void {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (!mods || !mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;

  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());
  let name = 'unknown';
  let type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' = 'variable';

  if (ts.isFunctionDeclaration(node) && node.name) {
    name = node.name.text;
    type = 'function';
    context.exports.push({
      name,
      type,
      isDefault: mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
      line: line + 1,
      column: character + 1,
    });
    return;
  }

  if (ts.isClassDeclaration(node) && node.name) {
    name = node.name.text;
    type = 'class';
    context.exports.push({
      name,
      type,
      isDefault: mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
      line: line + 1,
      column: character + 1,
    });
    return;
  }

  if (ts.isInterfaceDeclaration(node)) {
    name = node.name.text;
    type = 'interface';
    context.exports.push({ name, type, isDefault: false, line: line + 1, column: character + 1 });
    return;
  }

  if (ts.isTypeAliasDeclaration(node)) {
    name = node.name.text;
    type = 'type';
    context.exports.push({ name, type, isDefault: false, line: line + 1, column: character + 1 });
    return;
  }

  if (ts.isVariableStatement(node)) {
    const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    node.declarationList.declarations.forEach((decl) => {
      if (ts.isIdentifier(decl.name)) {
        const varName = decl.name.text;
        context.exports.push({
          name: varName,
          type: 'variable',
          isDefault,
          line: line + 1,
          column: character + 1,
        });
      }
    });
  }
}

function processFunction(node: ts.FunctionDeclaration, context: SemanticContext): void {
  if (!node.name) return;

  const name = node.name.text;
  const parameters = node.parameters.map(getParameterSignature);
  const returnType = node.type ? node.type.getText() : 'any';
  const isAsync = !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  const complexity = calculateCyclomaticComplexity(node);
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());

  context.functions.push({
    name,
    parameters,
    returnType,
    isAsync,
    complexity,
    line: line + 1,
    column: character + 1,
  });
}

function processClass(node: ts.ClassDeclaration, context: SemanticContext): void {
  if (!node.name) return;

  const name = node.name.text;
  const extends_ = node.heritageClauses
    ?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
    ?.types[0]?.expression?.getText();
  const impls =
    node.heritageClauses
      ?.find((h) => h.token === ts.SyntaxKind.ImplementsKeyword)
      ?.types.map((t) => t.expression.getText()) || [];

  const methods: SemanticContext['classes'][number]['methods'] = [];
  const properties: SemanticContext['classes'][number]['properties'] = [];
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());

  node.members.forEach((member) => {
    if (ts.isMethodDeclaration(member) && member.name) {
      const methodName = member.name.getText();
      const parameters = member.parameters.map(getParameterSignature);
      const returnType = member.type ? member.type.getText() : 'any';
      const isAsync = !!(
        ts.canHaveModifiers(member) &&
        ts.getModifiers(member)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
      );
      const isStatic = !!(
        ts.canHaveModifiers(member) &&
        ts.getModifiers(member)?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)
      );
      const visibility = getVisibilityModifier(member);

      methods.push({
        name: methodName,
        parameters,
        returnType,
        isAsync,
        isStatic,
        visibility,
      });
    } else if (ts.isPropertyDeclaration(member) && member.name) {
      const propertyName = member.name.getText();
      const type = member.type ? member.type.getText() : 'any';
      const isStatic = !!(
        ts.canHaveModifiers(member) &&
        ts.getModifiers(member)?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)
      );
      const visibility = getVisibilityModifier(member);

      properties.push({
        name: propertyName,
        type,
        isStatic,
        visibility,
      });
    }
  });

  context.classes.push({
    name,
    extends: extends_,
    implements: impls,
    line: line + 1,
    column: character + 1,
    methods,
    properties,
  });
}

function processInterface(node: ts.InterfaceDeclaration, context: SemanticContext): void {
  const name = node.name.text;
  const extends_ =
    node.heritageClauses
      ?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
      ?.types.map((t) => t.expression.getText()) || [];

  const properties: SemanticContext['interfaces'][number]['properties'] = [];
  const methods: SemanticContext['interfaces'][number]['methods'] = [];
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());

  node.members.forEach((member) => {
    if (ts.isPropertySignature(member) && member.name) {
      const propertyName = member.name.getText();
      const type = member.type ? member.type.getText() : 'any';
      const optional = !!member.questionToken;

      properties.push({ name: propertyName, type, optional });
    } else if (ts.isMethodSignature(member) && member.name) {
      const methodName = member.name.getText();
      const parameters = member.parameters.map(getParameterSignature);
      const returnType = member.type ? member.type.getText() : 'any';

      methods.push({ name: methodName, parameters, returnType });
    }
  });

  context.interfaces.push({
    name,
    extends: extends_,
    line: line + 1,
    column: character + 1,
    properties,
    methods,
  });
}

function processTypeAlias(node: ts.TypeAliasDeclaration, context: SemanticContext): void {
  const name = node.name.text;
  const definition = node.type.getText();
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());

  context.types.push({ name, definition, line: line + 1, column: character + 1 });
}

function processVariableStatement(node: ts.VariableStatement, context: SemanticContext): void {
  node.declarationList.declarations.forEach((declaration) => {
    if (ts.isIdentifier(declaration.name)) {
      const name = declaration.name.text;
      const type = declaration.type ? declaration.type.getText() : 'any';
      const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
      const hasInitializer = !!declaration.initializer;
      const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(
        declaration.getStart(),
      );

      context.variables.push({
        name,
        type,
        isConst,
        hasInitializer,
        line: line + 1,
        column: character + 1,
      });
    }
  });
}

function processCallExpression(
  node: ts.CallExpression,
  context: SemanticContext,
  sideEffectCallees: string[],
): void {
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());

  // Check for React hooks
  if (ts.isIdentifier(node.expression) && isReactHook(node.expression.text)) {
    const hookName = node.expression.text;
    const dependencies = extractHookDependencies(node);

    const builtinHooks = [
      'useState',
      'useEffect',
      'useCallback',
      'useMemo',
      'useContext',
      'useReducer',
    ] as const;
    let type:
      | 'useState'
      | 'useEffect'
      | 'useCallback'
      | 'useMemo'
      | 'useContext'
      | 'useReducer'
      | 'custom' = 'custom';
    if ((builtinHooks as readonly string[]).includes(hookName)) {
      type = hookName as (typeof builtinHooks)[number];
    }

    context.reactHooks.push({
      name: hookName,
      dependencies,
      type,
    });
  }

  // Check for side effect calls
  if (isSideEffectCall(node, sideEffectCallees)) {
    const name = node.expression.getText();
    const argumentCount = node.arguments.length;

    context.sideEffectCalls.push({
      name,
      line: line + 1,
      column: character + 1,
      arguments: argumentCount,
    });
  }
}

function processJsxElement(node: ts.Node, context: SemanticContext): void {
  let tagName = '';
  let props: Array<{ name: string; type: 'literal' | 'expression' | 'spread' }> = [];
  let hasChildren = false;
  let isComponent = false;

  if (ts.isJsxElement(node)) {
    if (ts.isIdentifier(node.openingElement.tagName)) {
      tagName = node.openingElement.tagName.text;
      isComponent = /^[A-Z]/.test(tagName);
    }
    hasChildren = node.children.length > 0;

    if (node.openingElement.attributes) {
      props = extractJsxProps(node.openingElement.attributes);
    }
  } else if (ts.isJsxSelfClosingElement(node)) {
    if (ts.isIdentifier(node.tagName)) {
      tagName = node.tagName.text;
      isComponent = /^[A-Z]/.test(tagName);
    }

    if (node.attributes) {
      props = extractJsxProps(node.attributes);
    }
  }

  if (tagName) {
    context.jsxElements.push({
      tagName,
      props,
      hasChildren,
      isComponent,
    });
  }
}

function extractJsxProps(
  attributes: ts.JsxAttributes,
): Array<{ name: string; type: 'literal' | 'expression' | 'spread' }> {
  return attributes.properties.map((prop) => {
    if (ts.isJsxAttribute(prop) && prop.name) {
      const nameNode = prop.name;
      const name = ts.isIdentifier(nameNode) ? nameNode.text : nameNode.getText();
      const type =
        prop.initializer && ts.isJsxExpression(prop.initializer) ? 'expression' : 'literal';
      return { name, type };
    } else if (ts.isJsxSpreadAttribute(prop)) {
      return { name: '...', type: 'spread' as const };
    }
    return { name: 'unknown', type: 'literal' as const };
  });
}
