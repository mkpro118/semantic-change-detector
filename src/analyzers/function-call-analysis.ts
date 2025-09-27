/**
 * Module: Function Call Analysis
 *
 * Responsibility
 * - Compare function and constructor call sites between two
 *   versions of a file and detect meaningful behavioral changes
 *   (e.g., argument count/order, hook deps, call kind).
 *
 * Expected Output
 * - Returns `LocatedSemanticChange[]` with changes such as:
 *   - functionCallAdded / functionCallRemoved
 *   - functionCallChanged (args, order, template, constructor)
 */
import ts from 'typescript';
import type { AnalyzeFileParams, LocatedSemanticChange } from './types';
import { createChange } from './change-factory.js';
import { isReactHook, normalizeWhitespace } from '../utils/ast-utils.js';
import type { SemanticChange, SemanticContext } from '../types/index.js';

type CallArg = { type: string; text: string };

type ParsedCall = {
  node: ts.Node;
  functionName: string;
  argumentCount: number;
  arguments: Array<CallArg>;
  isNew?: boolean;
  isTaggedTemplate?: boolean;
  templateText?: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
};

type ParsedFunc = {
  name: string;
  line: number;
  column: number;
};

type ParsedCodeLite = {
  sourceFile: ts.SourceFile;
  functions: ParsedFunc[];
  calls: ParsedCall[];
};

const HOOKS = new Set(['useEffect', 'useCallback', 'useMemo']);

export function analyzeFunctionCallChangesCore(
  baseParsed: ParsedCodeLite,
  modifiedParsed: ParsedCodeLite,
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const start = performance.now();
  const MAX_MS = 2000;
  const changes: LocatedSemanticChange[] = [];

  const baseCalls = [...baseParsed.calls];
  const modCalls = [...modifiedParsed.calls];

  const matchedMod = new Set<number>();
  const handledBase = new Set<number>();

  const baseByName = groupCallsByName(baseCalls);
  const modByName = groupCallsByName(modCalls);

  baseCalls.forEach((b, bIdx) => {
    if (performance.now() - start > MAX_MS) return;

    const bGroup = baseByName.get(b.functionName) ?? [];
    const mGroup = modByName.get(b.functionName) ?? [];

    if (bGroup.length === 1 && mGroup.length === 1) {
      const m = mGroup[0]!;
      const mIdx = modCalls.indexOf(m);
      matchedMod.add(mIdx);
      handledBase.add(bIdx);
      analyzePairedCall(b, m, modifiedParsed, params, changes);
      return;
    }
  });

  // Optional chaining equivalence pairing: obj?.m(a) ≡ obj.m?.(a)
  baseCalls.forEach((b, bIdx) => {
    if (handledBase.has(bIdx)) return;
    const bNorm = normalizeCallee(b.functionName);
    const mIdx = modCalls.findIndex(
      (m, i) => !matchedMod.has(i) && normalizeCallee(m.functionName) === bNorm,
    );
    if (mIdx >= 0) {
      const m = modCalls[mIdx]!;
      matchedMod.add(mIdx);
      handledBase.add(bIdx);
      analyzePairedCall(b, m, modifiedParsed, params, changes);
    }
  });

  // Callee root rename-only heuristic: treat alias rename as no-op
  baseCalls.forEach((b, bIdx) => {
    if (handledBase.has(bIdx)) return;
    const bSuf = calleeSuffixPath(b.functionName);
    const bArgs = b.arguments.map((x) => x.text.trim());
    const mIdx = modCalls.findIndex((m, i) => {
      if (matchedMod.has(i)) return false;
      const ms = calleeSuffixPath(m.functionName);
      if (ms !== bSuf) return false;
      const z = m.arguments.map((x) => x.text.trim());
      return sameStringArray(bArgs, z);
    });
    if (mIdx >= 0) {
      const m = modCalls[mIdx]!;
      matchedMod.add(mIdx);
      handledBase.add(bIdx);
      analyzePairedCall(b, m, modifiedParsed, params, changes);
    }
  });

  // Removed calls: unmatched base calls
  baseCalls.forEach((b, i) => {
    if (handledBase.has(i)) return;
    changes.push(
      createChange(
        'functionCallRemoved',
        'medium',
        `Function call '${b.functionName}' was removed`,
        wrap(`Removed call: ${b.functionName}(` + `${b.arguments.map((a) => a.text).join(', ')})`),
        params.modifiedFilePath,
        b.line,
        b.column,
        b.endLine,
        b.endColumn,
        'CallExpression',
      ),
    );
  });

  // Added calls: unmatched modified calls
  modCalls.forEach((m, idx) => {
    if (matchedMod.has(idx)) return;
    changes.push(
      createChange(
        'functionCallAdded',
        'medium',
        `Function call '${m.functionName}' was added`,
        wrap(`New call: ${m.functionName}(` + `${m.arguments.map((a) => a.text).join(', ')})`),
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'CallExpression',
      ),
    );
  });

  return changes;
}

function analyzePairedCall(
  b: ParsedCall,
  m: ParsedCall,
  modParsed: ParsedCodeLite,
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const anchor = getAnchorFor(m.functionName, modParsed, {
    line: m.line,
    column: m.column,
  });
  reportKindChange(b, m, anchor, params, out);
  // Use correct source file for each side when extracting deps.
  reportHookDepsChange(b, m, b.node.getSourceFile(), m.node.getSourceFile(), anchor, params, out);
  reportTemplateChange(b, m, anchor, params, out);
  reportArgOrderChange(b, m, anchor, params, out);
  reportArgCountChange(b, m, anchor, params, out);
}

function reportKindChange(
  b: ParsedCall,
  m: ParsedCall,
  anchor: { line: number; column: number },
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const bNew = Boolean(b.isNew);
  const mNew = Boolean(m.isNew);
  if (bNew === mNew) return;
  out.push(
    createChange(
      'functionCallChanged',
      'high',
      `Constructor vs function call changed for '${b.functionName}'`,
      wrap(
        `Call kind changed: ${bNew ? 'new ' : ''}${b.functionName} -> ` +
          `${mNew ? 'new ' : ''}${b.functionName}.`,
      ),
      params.modifiedFilePath,
      anchor.line,
      anchor.column,
      m.endLine,
      m.endColumn,
      'CallExpression',
    ),
  );
}

function reportHookDepsChange(
  b: ParsedCall,
  m: ParsedCall,
  bSf: ts.SourceFile,
  mSf: ts.SourceFile,
  anchor: { line: number; column: number },
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const simple = trailingName(b.functionName);
  if (!HOOKS.has(simple)) return;
  const before = extractHookDepsFrom(b.node as ts.CallExpression, bSf);
  const after = extractHookDepsFrom(m.node as ts.CallExpression, mSf);
  if (sameStringArray(before, after)) return;
  out.push(
    createChange(
      'functionCallChanged',
      'high',
      `Hook dependency array changed for '${simple}'`,
      wrap(
        `Before deps: [${before.join(', ')}]
` + `After deps: [${after.join(', ')}]`,
      ),
      params.modifiedFilePath,
      anchor.line,
      anchor.column,
      m.endLine,
      m.endColumn,
      'CallExpression',
    ),
  );
}

function reportTemplateChange(
  b: ParsedCall,
  m: ParsedCall,
  anchor: { line: number; column: number },
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const bTpl = b.templateText ?? '';
  const mTpl = m.templateText ?? '';
  if (!(b.isTaggedTemplate || m.isTaggedTemplate)) return;
  if (bTpl === mTpl) return;
  out.push(
    createChange(
      'functionCallChanged',
      'medium',
      `Tagged template invocation changed for '${b.functionName}'`,
      'Template literal contents changed.',
      params.modifiedFilePath,
      anchor.line,
      anchor.column,
      m.endLine,
      m.endColumn,
      'CallExpression',
    ),
  );
}

function reportArgOrderChange(
  b: ParsedCall,
  m: ParsedCall,
  anchor: { line: number; column: number },
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  if (b.argumentCount !== m.argumentCount) return;
  const before = b.arguments.map((a) => a.text.trim());
  const after = m.arguments.map((a) => a.text.trim());
  const sameOrder = before.every((t, i) => t === after[i]);
  if (sameOrder || !sameMultiset(before, after)) return;
  out.push(
    createChange(
      'functionCallChanged',
      'low',
      `Function call '${b.functionName}' argument order changed`,
      wrap(
        `Before: ${b.functionName}(${before.join(', ')})
` + `After: ${b.functionName}(${after.join(', ')})`,
      ),
      params.modifiedFilePath,
      anchor.line,
      anchor.column,
      m.endLine,
      m.endColumn,
      'CallExpression',
    ),
  );
}

function reportArgCountChange(
  b: ParsedCall,
  m: ParsedCall,
  anchor: { line: number; column: number },
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  if (b.argumentCount === m.argumentCount) return;
  // Ignore trailing undefined removal as a runtime no-op
  if (b.argumentCount > m.argumentCount) {
    const removed = b.argumentCount - m.argumentCount;
    const tail = b.arguments.slice(-removed);
    const allUndefined = tail.every((t) => /^(?:undefined|void\s*0)$/u.test(t.text.trim()));
    if (allUndefined) return;
  }
  const before = b.arguments.map((a) => a.text).join(', ');
  const after = m.arguments.map((a) => a.text).join(', ');
  const removed = b.argumentCount > m.argumentCount;
  const sev = removed ? 'high' : 'medium';
  out.push(
    createChange(
      'functionCallChanged',
      sev,
      wrap(
        `Function call '${b.functionName}' argument count ` +
          `changed (${b.argumentCount} -> ${m.argumentCount})`,
      ),
      wrap(
        `Before: ${b.functionName}(${before})
` + `After: ${b.functionName}(${after})`,
      ),
      params.modifiedFilePath,
      anchor.line,
      anchor.column,
      m.endLine,
      m.endColumn,
      'CallExpression',
    ),
  );
}

function groupCallsByName(calls: ParsedCall[]): Map<string, ParsedCall[]> {
  const map = new Map<string, ParsedCall[]>();
  for (const c of calls) {
    if (!map.has(c.functionName)) map.set(c.functionName, []);
    map.get(c.functionName)!.push(c);
  }
  return map;
}

function trailingName(fn: string): string {
  const dot = fn.lastIndexOf('.');
  if (dot >= 0) return fn.slice(dot + 1);
  const m = fn.match(/["']([^"']+)["']$/u);
  return m?.[1] ?? fn;
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map<string, number>();
  for (const x of a) map.set(x, (map.get(x) ?? 0) + 1);
  for (const y of b) {
    const c = map.get(y);
    if (!c) return false;
    map.set(y, c - 1);
    if (map.get(y) === 0) map.delete(y);
  }
  return map.size === 0;
}

function getAnchorFor(
  fnName: string,
  parsed: ParsedCodeLite,
  fallback: { line: number; column: number },
): { line: number; column: number } {
  const decl = parsed.functions.find((f) => f.name === fnName);
  return decl ? { line: decl.line, column: decl.column } : fallback;
}

function extractHookDepsFrom(node: ts.CallExpression, sf: ts.SourceFile): string[] {
  const args = node.arguments ?? ([] as readonly ts.Expression[]);
  if (args.length < 2) return [];
  return extractDependencyArray(args[1]!, sf);
}

function extractDependencyArray(expr: ts.Expression, sf: ts.SourceFile): string[] {
  const deps: string[] = [];

  const fromExpr = (e: ts.Expression): void => {
    if (ts.isArrayLiteralExpression(e)) {
      e.elements.forEach((el) => {
        if (ts.isSpreadElement(el)) {
          const spread = el.expression;
          if (ts.isIdentifier(spread)) {
            deps.push(...resolveIdentifierDeps(spread.text, sf, e.getStart()));
          } else {
            deps.push('...' + spread.getText(sf));
          }
        } else {
          deps.push(el.getText(sf).trim());
        }
      });
    } else if (ts.isIdentifier(e)) {
      deps.push(...resolveIdentifierDeps(e.text, sf, e.getStart()));
    } else {
      deps.push(e.getText(sf).trim());
    }
  };

  fromExpr(expr);
  return deps;
}

function resolveIdentifierDeps(name: string, sf: ts.SourceFile, contextPos: number): string[] {
  const vars: ts.VariableDeclaration[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
      vars.push(n);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  const getScopeNode = resolveIdentifierDeps_getScopeNode.bind(null, sf);

  const getScopeForPos = (pos: number): ts.Node => {
    let found: ts.Node = sf;
    const walk = (n: ts.Node) => {
      if (pos >= n.getStart(sf) && pos <= n.getEnd()) {
        found = n;
        ts.forEachChild(n, walk);
      }
    };
    walk(sf);
    return getScopeNode(found);
  };

  const scope = getScopeForPos(contextPos);
  let pick: ts.VariableDeclaration | undefined;
  let best = -1;
  for (const d of vars) {
    const s = getScopeNode(d);
    const dStart = d.getStart(sf);
    const sameScope = s === scope || (s.getStart(sf) <= contextPos && s.getEnd() >= contextPos);
    if (dStart <= contextPos && sameScope && dStart > best) {
      best = dStart;
      pick = d;
    }
  }

  if (pick?.initializer) {
    let init: ts.Expression = pick.initializer;
    while (
      ts.isAsExpression(init) ||
      ts.isParenthesizedExpression(init) ||
      isSatisfiesExpressionCompat(init)
    ) {
      init = getInnerExpression(init);
    }
    if (ts.isArrayLiteralExpression(init)) {
      return init.elements.map((el) => el.getText(sf).trim());
    }
  }
  return [name];
}

function resolveIdentifierDeps_getScopeNode(sf: ts.SourceFile, n: ts.Node): ts.Node {
  let cur: ts.Node | undefined = n;
  while (cur) {
    if (ts.isBlock(cur) || ts.isSourceFile(cur) || ts.isFunctionLike(cur)) return cur;
    cur = cur.parent;
  }
  return sf;
}

function isSatisfiesExpressionCompat(node: ts.Node): node is ts.SatisfiesExpression {
  const maybe = (ts as { isSatisfiesExpression?: (n: ts.Node) => boolean }).isSatisfiesExpression;
  return typeof maybe === 'function' ? maybe(node) : false;
}

function getInnerExpression(expr: ts.Expression): ts.Expression {
  if (ts.isAsExpression(expr)) return expr.expression;
  if (ts.isParenthesizedExpression(expr)) return expr.expression;
  if (isSatisfiesExpressionCompat(expr)) return expr.expression;
  return expr;
}

function wrap(text: string): string {
  // Split long strings to keep line length reasonable when emitted.
  return text
    .split(/\n/u)
    .map((line) => line.replace(/(.{1,76})(\s+|$)/g, '$1\n').trimEnd())
    .join('\n')
    .trim();
}

function normalizeCallee(name: string): string {
  let s = name.replace(/\?\./g, '.');
  s = s.replace(/["']([^"']+)["']/g, '.$1');
  s = s.replace(/\.$/, '');
  return s;
}

function calleeSuffixPath(name: string): string {
  const norm = normalizeCallee(name);
  const segs = norm.split('.');
  return segs.length > 1 ? segs.slice(1).join('.') : norm;
}

type FunctionCallInfo = {
  callee: string;
  args: string[];
  line: number;
  column: number;
  isReactHook: boolean;
};

function collectFunctionCalls(sourceFile: ts.SourceFile): Map<string, FunctionCallInfo> {
  const calls = new Map<string, FunctionCallInfo>();

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const callee = node.expression.getText(sourceFile).trim();
      const args = node.arguments.map((argument) =>
        normalizeWhitespace(argument.getText(sourceFile)),
      );
      const isHookCall = ts.isIdentifier(node.expression) && isReactHook(node.expression.text);
      const key = `${line}:${character}`;

      calls.set(key, {
        callee,
        args,
        line: line + 1,
        column: character + 1,
        isReactHook: isHookCall,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return calls;
}

function areCallArgumentsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function formatArgumentList(args: string[]): string {
  if (args.length === 0) return 'empty';
  return args.join(', ');
}

export function analyzeFunctionCalls(
  baseContext: SemanticContext,
  headContext: SemanticContext,
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const baseCalls = collectFunctionCalls(baseContext.sourceFile);
  const headCalls = collectFunctionCalls(headContext.sourceFile);

  for (const [key, headCall] of headCalls.entries()) {
    if (headCall.isReactHook) continue;
    const baseCall = baseCalls.get(key);
    if (!baseCall || baseCall.isReactHook) continue;
    if (baseCall.callee !== headCall.callee) continue;

    if (!areCallArgumentsEqual(baseCall.args, headCall.args)) {
      const baseArgsText = formatArgumentList(baseCall.args);
      const headArgsText = formatArgumentList(headCall.args);

      changes.push({
        kind: 'functionCallModified',
        severity: 'medium',
        line: headCall.line,
        column: headCall.column,
        detail: `Call to ${headCall.callee} arguments changed: [${baseArgsText}] -> [${headArgsText}]`,
        astNode: 'CallExpression',
      });
    }
  }

  return changes;
}
