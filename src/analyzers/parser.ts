/**
 * Module: Parser
 *
 * Responsibility
 * - Parse code into a compact structure for analyzers: functions,
 *   types, calls, and imports with positions and context.
 *
 * Expected Output
 * - `ParsedCode` and `ParsedPair`, plus helpers `parseCode` and
 *   `parseBoth` used by analyzer cores.
 */
import ts from 'typescript';

/**
 * The surrounding context for a function-like node. Used to
 * disambiguate where a function resides for comparison and reporting.
 */
type FuncContext = 'global' | 'class' | 'namespace' | 'interface' | 'nested';

/**
 * ParsedFunction represents a function-like declaration normalized for
 * analysis. It captures signature text, parameters (including
 * destructured keys), position, and the surrounding context (global,
 * class, namespace, interface, or nested).
 *
 * @library-export
 * @public
 */
export type ParsedFunction = {
  node:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.ConstructorDeclaration;
  name: string;
  signature: string;
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
    destructured?: Array<{ name: string; type: string; optional: boolean }>;
  }>;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  contextType: FuncContext;
  containerName?: string;
  isStatic?: boolean;
  visibility?: 'public' | 'private' | 'protected';
};

/**
 * ParsedType represents an interface or type alias. It includes a
 * normalized definition string suitable for structural comparison and a
 * list of properties discovered from type literals or interface bodies.
 *
 * @library-export
 * @public
 */
export type ParsedType = {
  node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration;
  name: string;
  definition: string;
  properties: Array<{ name: string; type: string; optional: boolean }>;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
};

/**
 * ParsedCall represents a call-like site (call, new, or tagged
 * template). It captures the textual callee, arguments, and span.
 */
type ParsedCall = {
  /** The AST node for the call/new/tagged template. */
  node: ts.Node;
  /** Textual identifier/path for the callee. */
  functionName: string;
  /** Number of arguments or template expressions. */
  argumentCount: number;
  /** Coarse argument value kinds and source text. */
  arguments: Array<{ type: string; text: string }>;
  /** True when constructed via `new`. */
  isNew?: boolean;
  /** True when a tagged template expression. */
  isTaggedTemplate?: boolean;
  /** Raw template content (without quotes). */
  templateText?: string;
  /** 1-indexed start line. */
  line: number;
  /** 0-indexed start column. */
  column: number;
  /** 1-indexed end line. */
  endLine: number;
  /** 0-indexed end column. */
  endColumn: number;
};

/**
 * ParsedImport captures the structure of an import declaration used by
 * the import analyzer, including specifiers and ordering.
 */
type ParsedImport = {
  /** The ImportDeclaration AST node. */
  node: ts.ImportDeclaration;
  /** Module specifier (string literal text). */
  module: string;
  /** Named/default/namespace specifiers with optional alias. */
  specifiers: Array<{ name: string; alias?: string }>;
  /** Whether a default import is present. */
  isDefault: boolean;
  /** Whether a namespace import is present. */
  isNamespace: boolean;
  /** True when import is type-only. */
  isTypeOnly: boolean;
  /** 1-indexed line number of the import. */
  line: number;
  /** 0-indexed column number of the import. */
  column: number;
  /** Stable ordering index for comparison. */
  order: number;
};

/**
 * ParsedCode is the compact parse output used by analyzers. It
 * contains all functions, types, calls, and imports present in the
 * source file with positions and basic metadata.
 *
 * @library-export
 * @public
 */
export type ParsedCode = {
  /** Parsed source file. */
  sourceFile: ts.SourceFile;
  /** All functions found in the file. */
  functions: ParsedFunction[];
  /** All type aliases and interfaces. */
  types: ParsedType[];
  /** All call/new/tagged template sites. */
  calls: ParsedCall[];
  /** All import declarations. */
  imports: ParsedImport[];
};

/**
 * ParsedPair contains the parsed representation of base and modified
 * files used by analyzer cores.
 */
type ParsedPair = {
  /** Parsed base version. */
  base: ParsedCode;
  /** Parsed modified version. */
  modified: ParsedCode;
};

/**
 * Frame represents the current context scope while traversing the AST
 * to collect functions, allowing us to record container metadata.
 */
type Frame = {
  /** Scope type (class, namespace, interface, nested). */
  type: 'class' | 'namespace' | 'interface' | 'nested';
  /** Scope name, when applicable. */
  name: string;
};

function buildParsedFunction(
  sf: ts.SourceFile,
  node:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.ConstructorDeclaration,
  name: string,
  ctx: Frame[],
  isStatic?: boolean,
  visibility?: 'public' | 'private' | 'protected',
): ParsedFunction {
  const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const end = sf.getLineAndCharacterOfPosition(node.getEnd());
  const frame = ctx[ctx.length - 1];
  const type: FuncContext = frame
    ? (frame.type as FuncContext)
    : ctx.length > 0
      ? 'nested'
      : 'global';
  const signature = getFunctionSignatureString(node, sf);
  const parameters = extractParametersWithDestructuring(node, sf);
  return {
    node,
    name,
    signature,
    parameters,
    line: pos.line + 1,
    column: pos.character,
    endLine: end.line + 1,
    endColumn: end.character,
    contextType: type,
    containerName: frame?.name,
    isStatic,
    visibility,
  };
}

export function parseBoth(params: {
  baseCode: string;
  baseFilePath: string;
  modifiedCode: string;
  modifiedFilePath: string;
}): ParsedPair {
  return {
    base: parseCode(params.baseCode, params.baseFilePath),
    modified: parseCode(params.modifiedCode, params.modifiedFilePath),
  };
}

function parseCode(code: string, filePath: string): ParsedCode {
  const kind =
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, kind);
  const functions = collectFunctions(sf);
  const types = collectTypes(sf);
  const calls = collectCalls(sf);
  const imports = collectImports(sf);
  return { sourceFile: sf, functions, types, calls, imports };
}

function collectFunctions(sf: ts.SourceFile): ParsedFunction[] {
  const out: ParsedFunction[] = [];
  const processFunctions = (n: ts.Node, stack: Frame[]): boolean => {
    if (ts.isFunctionDeclaration(n) && n.name) {
      out.push(buildParsedFunction(sf, n, n.name.text, stack));
      if (n.body) {
        const frame: Frame = { type: 'nested', name: n.name.text };
        ts.forEachChild(n.body, (c) => visit(c, [...stack, frame]));
      }
      return true;
    }
    if (ts.isMethodDeclaration(n) && n.name) {
      const name = n.name.getText(sf);
      const isStatic = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
      const visibility = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)
        ? 'private'
        : n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)
          ? 'protected'
          : 'public';
      out.push(buildParsedFunction(sf, n, name, stack, isStatic, visibility));
      return true;
    }
    if (ts.isConstructorDeclaration(n)) {
      const cls = stack.find((f) => f.type === 'class')?.name ?? 'constructor';
      out.push(buildParsedFunction(sf, n, `${cls}.constructor`, stack, false, 'public'));
      return true;
    }
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      let name = '<anonymous>';
      const p = n.parent;
      if (ts.isVariableDeclaration(p) && p.name) name = p.name.getText(sf);
      else if (ts.isPropertyAssignment(p) && p.name) name = p.name.getText(sf);
      out.push(buildParsedFunction(sf, n, name, stack));
      if (n.body) {
        const frame: Frame = { type: 'nested', name };
        ts.forEachChild(n.body, (c) => visit(c, [...stack, frame]));
      }
      return true;
    }
    return false;
  };
  const processContexts = (n: ts.Node, stack: Frame[]): boolean => {
    if (ts.isClassDeclaration(n) && n.name) {
      const frame: Frame = { type: 'class', name: n.name.text };
      n.members.forEach((m) => visit(m, [...stack, frame]));
      return true;
    }
    if (ts.isModuleDeclaration(n) && n.name) {
      const frame: Frame = { type: 'namespace', name: n.name.getText(sf) };
      ts.forEachChild(n, (c) => visit(c, [...stack, frame]));
      return true;
    }
    if (ts.isInterfaceDeclaration(n) && n.name) {
      const frame: Frame = { type: 'interface', name: n.name.text };
      ts.forEachChild(n, (c) => visit(c, [...stack, frame]));
      return true;
    }
    return false;
  };
  const visit = (n: ts.Node, stack: Frame[] = []): void => {
    if (processFunctions(n, stack)) return;
    if (processContexts(n, stack)) return;
    ts.forEachChild(n, (c) => visit(c, stack));
  };
  visit(sf);
  return out;
}

function collectTypes(sf: ts.SourceFile): ParsedType[] {
  const out: ParsedType[] = [];
  const push = (node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration): void => {
    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const end = sf.getLineAndCharacterOfPosition(node.getEnd());
    const name = node.name.getText(sf);
    const definition = normalizeTypeDefinition(node.getText(sf));
    const properties = extractTypeProperties(node, sf);
    out.push({
      node,
      name,
      definition,
      properties,
      line: pos.line + 1,
      column: pos.character,
      endLine: end.line + 1,
      endColumn: end.character,
    });
  };
  const visit = (n: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function collectCalls(sf: ts.SourceFile): ParsedCall[] {
  const out: ParsedCall[] = [];
  const push = (
    node: ts.Node,
    name: string,
    args: Array<{ type: string; text: string }> = [],
    argCount: number,
    flags?: { isNew?: boolean; isTaggedTemplate?: boolean; templateText?: string },
  ): void => {
    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const end = sf.getLineAndCharacterOfPosition(node.getEnd());
    out.push({
      node,
      functionName: name,
      argumentCount: argCount,
      arguments: args,
      isNew: flags?.isNew,
      isTaggedTemplate: flags?.isTaggedTemplate,
      templateText: flags?.templateText,
      line: pos.line + 1,
      column: pos.character,
      endLine: end.line + 1,
      endColumn: end.character,
    });
  };
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const fn = getFunctionCallName(n, sf);
      const argCount = n.arguments.length;
      const args = n.arguments.map((a) => ({
        type:
          a.kind === ts.SyntaxKind.StringLiteral
            ? 'string'
            : a.kind === ts.SyntaxKind.NumericLiteral
              ? 'number'
              : 'expression',
        text: a.getText(sf),
      }));
      push(n, fn, args, argCount);
    } else if (ts.isNewExpression(n)) {
      const fn = n.expression.getText(sf);
      const argCount = n.arguments?.length ?? 0;
      const args = (n.arguments ?? []).map((a) => ({
        type:
          a.kind === ts.SyntaxKind.StringLiteral
            ? 'string'
            : a.kind === ts.SyntaxKind.NumericLiteral
              ? 'number'
              : 'expression',
        text: a.getText(sf),
      }));
      push(n, fn, args, argCount, { isNew: true });
    } else if (ts.isTaggedTemplateExpression(n)) {
      const fn = n.tag.getText(sf);
      const t = n.template;
      let text = '';
      let count = 0;
      if (ts.isTemplateExpression(t)) {
        text += t.head.text;
        count += t.templateSpans.length;
        for (const span of t.templateSpans) {
          text += `\n${span.expression.getText(sf)}\n`;
          text += span.literal.text;
        }
      } else if (ts.isNoSubstitutionTemplateLiteral(t)) {
        text = t.text;
      }
      push(n, fn, [], count, { isTaggedTemplate: true, templateText: text });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function collectImports(sf: ts.SourceFile): ParsedImport[] {
  const out: ParsedImport[] = [];
  let order = 0;
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n)) {
      const module = (n.moduleSpecifier as ts.StringLiteral).text;
      const { specifiers, isDefault, isNamespace } = extractImportSpecifiers(n);
      const isTypeOnly =
        Boolean(n.importClause?.isTypeOnly) || n.getFullText(sf).trim().startsWith('import type');
      const pos = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      out.push({
        node: n,
        module,
        specifiers,
        isDefault,
        isNamespace,
        isTypeOnly,
        line: pos.line + 1,
        column: pos.character,
        order: order++,
      });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

export function getFunctionSignatureString(
  node:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.ConstructorDeclaration,
  sf: ts.SourceFile,
): string {
  if (ts.isConstructorDeclaration(node)) {
    const params = node.parameters.map((p) => p.getText(sf)).join(', ');
    return `constructor(${params})`;
  }
  const name = (node as ts.FunctionLikeDeclarationBase).name?.getText(sf) ?? '';
  const params = node.parameters.map((p) => p.getText(sf)).join(', ');
  const ret = (node as ts.FunctionLikeDeclarationBase).type?.getText(sf) ?? 'any';
  return `${name}(${params}): ${ret}`;
}

function extractParametersWithDestructuring(
  node:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.ConstructorDeclaration,
  sf: ts.SourceFile,
): Array<{
  name: string;
  type: string;
  optional: boolean;
  destructured?: Array<{ name: string; type: string; optional: boolean }>;
}> {
  return node.parameters.map((param) => {
    const name = param.name.getText(sf);
    const type = param.type?.getText(sf) ?? 'any';
    const optional = Boolean(param.questionToken) || /\?\s*:/u.test(param.getText(sf));
    let destructured: Array<{ name: string; type: string; optional: boolean }> | undefined;
    if (ts.isObjectBindingPattern(param.name)) {
      destructured = param.name.elements.map((el) => {
        const propName = el.propertyName?.getText(sf) || el.name.getText(sf);
        const propType = 'any';
        const propOptional = Boolean(el.dotDotDotToken);
        return { name: propName, type: propType, optional: propOptional };
      });
    }
    return { name, type, optional, destructured };
  });
}

function extractTypeProperties(
  node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
  sf: ts.SourceFile,
): Array<{ name: string; type: string; optional: boolean }> {
  const props: Array<{ name: string; type: string; optional: boolean }> = [];
  const visit = (n: ts.Node): void => {
    if (ts.isTypeLiteralNode(n)) {
      n.members.forEach((m) => {
        if (ts.isPropertySignature(m) && m.name) {
          const name = m.name.getText(sf);
          const type = m.type ? m.type.getText(sf) : 'any';
          const optional = Boolean(m.questionToken);
          props.push({ name, type, optional });
        }
      });
    } else if (ts.isInterfaceDeclaration(n)) {
      n.members.forEach((m) => {
        if (ts.isPropertySignature(m) && m.name) {
          const name = m.name.getText(sf);
          const type = m.type ? m.type.getText(sf) : 'any';
          const optional = Boolean(m.questionToken);
          props.push({ name, type, optional });
        }
      });
    }
    ts.forEachChild(n, visit);
  };
  if (ts.isTypeAliasDeclaration(node)) visit(node.type);
  else visit(node);
  return props;
}

export function normalizeTypeDefinition(def: string): string {
  const noBlock = def.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLine = noBlock.replace(/(^|[^:])\/\/.*$/gm, '$1');
  let s = noLine
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}():;,|&<>])\s*/g, '$1')
    .replace(/\s*=\s*/g, '=')
    .trim();
  s = applyTypeEquivalences(s);
  return s;
}

function applyTypeEquivalences(typeString: string): string {
  let s = typeString;
  s = s.replace(/Array<([^<>]+(?:<[^<>]*>)*)>/g, '$1[]');
  s = s.replace(/Array<([^<>]+(?:<[^<>]*>)*)\[\]>/g, '$1[][]');
  s = normalizeUtilityTypeCompositions(s);
  return s;
}

function normalizeUtilityTypeCompositions(typeString: string): string {
  return typeString.replace(
    /Partial<Pick<([^,<>]+(?:<[^<>]*>)*),([^<>]+(?:<[^<>]*>)*)>>/g,
    'Pick<Partial<$1>,$2>',
  );
}

function getFunctionCallName(node: ts.CallExpression, sf: ts.SourceFile): string {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.getText(sf);
  // Optional chaining is handled generically by getText
  if (ts.isElementAccessExpression(node.expression)) return node.expression.getText(sf);
  return node.expression.getText(sf);
}

function extractImportSpecifiers(node: ts.ImportDeclaration): {
  specifiers: Array<{ name: string; alias?: string }>;
  isDefault: boolean;
  isNamespace: boolean;
} {
  const specifiers: Array<{ name: string; alias?: string }> = [];
  let isDefault = false;
  let isNamespace = false;
  if (node.importClause) {
    if (node.importClause.name) {
      isDefault = true;
      specifiers.push({ name: node.importClause.name.text });
    }
    const nb = node.importClause.namedBindings;
    if (nb) {
      if (ts.isNamespaceImport(nb)) {
        isNamespace = true;
        specifiers.push({ name: nb.name.text });
      } else if (ts.isNamedImports(nb)) {
        nb.elements.forEach((el) => {
          const name = el.propertyName?.text || el.name.text;
          const alias = el.propertyName ? el.name.text : undefined;
          specifiers.push({ name, alias });
        });
      }
    }
  }
  return { specifiers, isDefault, isNamespace };
}
