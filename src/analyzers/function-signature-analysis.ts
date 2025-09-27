/**
 * Module: Function Signature Analysis
 *
 * Responsibility
 * - Detect function signature changes, additions/removals,
 *   type-parameter changes, and destructured parameter key diffs.
 *
 * Expected Output
 * - `LocatedSemanticChange[]` with 'functionSignatureChanged',
 *   'functionAdded', and 'functionRemoved' as applicable.
 */
import ts from 'typescript';
import type { AnalyzeFileParams, LocatedSemanticChange } from './types';
import { createChange } from './change-factory.js';
import type { ParsedCode, ParsedFunction } from './parser.js';
import { levenshtein } from '../utils/ast-utils.js';

export function analyzeFunctionSignatureChangesCore(
  base: ParsedCode,
  modified: ParsedCode,
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const changes: LocatedSemanticChange[] = [];
  const baseMap = toFunctionMap(base.functions);
  const modMap = toFunctionMap(modified.functions);

  for (const [key, b] of baseMap) {
    const m = modMap.get(key);
    if (!m) {
      changes.push(
        createChange(
          'functionRemoved',
          'high',
          `Function '${b.name}' was removed`,
          b.signature,
          params.modifiedFilePath,
          b.line,
          b.column,
          b.endLine,
          b.endColumn,
          'FunctionDeclaration',
        ),
      );
      continue;
    }
    compareFunction(b, m, base, modified, params, changes);
  }

  for (const [key, m] of modMap) {
    if (baseMap.has(key)) continue;
    const ctx = m.containerName ? ` in ${m.contextType} '${m.containerName}'` : '';
    changes.push(
      createChange(
        'functionAdded',
        'medium',
        `Function '${m.name}' was added${ctx}`,
        m.signature,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'FunctionDeclaration',
      ),
    );
  }

  // Overloads changed
  changes.push(...compareOverloads(base.sourceFile, modified.sourceFile, baseMap, modMap, params));

  // Simple rename heuristic
  changes.push(...detectRename(baseMap, modMap, modified, params));

  return changes;
}

function toFunctionMap(funcs: ParsedFunction[]): Map<string, ParsedFunction> {
  const map = new Map<string, ParsedFunction>();
  for (const f of funcs) map.set(functionKey(f), f);
  return map;
}

function functionKey(f: ParsedFunction): string {
  const ctx = f.containerName ? `${f.contextType}:${f.containerName}` : f.contextType;
  const flags = `${f.isStatic ? 'S' : 'I'}:${f.visibility ?? 'pub'}`;
  return `${f.name}|${ctx}|${flags}`;
}

function compareFunction(
  b: ParsedFunction,
  m: ParsedFunction,
  base: ParsedCode,
  mod: ParsedCode,
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const sigEqual = signaturesEquivalent(b.node, m.node, base.sourceFile, mod.sourceFile);
  const genericsChanged = typeParamConstraintsChanged(
    b.node,
    m.node,
    base.sourceFile,
    mod.sourceFile,
  );

  if (!sigEqual || genericsChanged) {
    const message = genericsChanged
      ? `Generic constraints changed for '${b.name}'`
      : `Function signature changed: '${b.name}'`;
    out.push(
      createChange(
        'functionSignatureChanged',
        'high',
        message,
        `${b.signature} -> ${m.signature}`,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'FunctionDeclaration',
      ),
    );
  }
  compareDestructuredKeys(b, m, base, mod, params, out);
}

function signaturesEquivalent(
  b:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.ConstructorDeclaration,
  m:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.ConstructorDeclaration,
  bsf: ts.SourceFile,
  msf: ts.SourceFile,
): boolean {
  // Compare return type ignoring whitespace noise.
  const bRet = (b as ts.FunctionLikeDeclarationBase).type?.getText(bsf) ?? 'any';
  const mRet = (m as ts.FunctionLikeDeclarationBase).type?.getText(msf) ?? 'any';
  const retEqual = normalizeWhitespace(bRet) === normalizeWhitespace(mRet);
  if (!retEqual) return false;

  // Compare number of params and each param's shape (type, optional, rest).
  if (b.parameters.length !== m.parameters.length) return false;
  for (let i = 0; i < b.parameters.length; i++) {
    const bp = b.parameters[i]!;
    const mp = m.parameters[i]!;
    const bShape = paramShape(bp, bsf);
    const mShape = paramShape(mp, msf);
    if (
      bShape.type !== mShape.type ||
      bShape.optional !== mShape.optional ||
      bShape.rest !== mShape.rest
    ) {
      return false;
    }
  }
  return true;
}

function paramShape(
  p: ts.ParameterDeclaration,
  sf: ts.SourceFile,
): { type: string; optional: boolean; rest: boolean } {
  const type = normalizeWhitespace(p.type?.getText(sf) ?? 'any');
  const optional = Boolean(p.questionToken) || /\?\s*:/u.test(p.getText(sf));
  const rest = Boolean(p.dotDotDotToken);
  return { type, optional, rest };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function typeParamConstraintsChanged(
  b: ts.Node,
  m: ts.Node,
  bsf: ts.SourceFile,
  msf: ts.SourceFile,
): boolean {
  const bDecl = b as ts.SignatureDeclarationBase;
  const mDecl = m as ts.SignatureDeclarationBase;
  const bParams = bDecl.typeParameters ?? [];
  const mParams = mDecl.typeParameters ?? [];
  if (bParams.length !== mParams.length) return true; // shape changed
  for (let i = 0; i < bParams.length; i++) {
    const bc = bParams[i]!.constraint?.getText(bsf) ?? '';
    const mc = mParams[i]!.constraint?.getText(msf) ?? '';
    if (normalizeWhitespace(bc) !== normalizeWhitespace(mc)) return true;
    const bDef = bParams[i]!.default?.getText(bsf) ?? '';
    const mDef = mParams[i]!.default?.getText(msf) ?? '';
    if (normalizeWhitespace(bDef) !== normalizeWhitespace(mDef)) return true;
  }
  return false;
}

function compareDestructuredKeys(
  b: ParsedFunction,
  m: ParsedFunction,
  base: ParsedCode,
  mod: ParsedCode,
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const bp = b.node.parameters;
  const mp = m.node.parameters;
  const len = Math.min(bp.length, mp.length);
  for (let i = 0; i < len; i++) {
    const bn = bp[i]!;
    const mn = mp[i]!;
    if (!ts.isObjectBindingPattern(bn.name) && !ts.isObjectBindingPattern(mn.name)) continue;
    const bKeys = collectBindingKeys(bn.name, base.sourceFile);
    const mKeys = collectBindingKeys(mn.name, mod.sourceFile);
    for (const k of bKeys) {
      if (mKeys.has(k)) continue;
      out.push(
        createChange(
          'functionSignatureChanged',
          'high',
          `Destructured property '${k}' removed in '${b.name}'`,
          `Param ${i + 1}: key '${k}' removed`,
          params.modifiedFilePath,
          m.line,
          m.column,
          m.endLine,
          m.endColumn,
          'Parameter',
        ),
      );
    }
    for (const k of mKeys) {
      if (bKeys.has(k)) continue;
      out.push(
        createChange(
          'functionSignatureChanged',
          'medium',
          `Destructured property '${k}' added in '${b.name}'`,
          `Param ${i + 1}: key '${k}' added`,
          params.modifiedFilePath,
          m.line,
          m.column,
          m.endLine,
          m.endColumn,
          'Parameter',
        ),
      );
    }
  }
}

function collectBindingKeys(name: ts.BindingName, sf: ts.SourceFile, prefix = ''): Set<string> {
  const keys = new Set<string>();
  if (ts.isObjectBindingPattern(name)) {
    for (const el of name.elements) {
      const prop = el.propertyName?.getText(sf) || el.name.getText(sf);
      const next = prefix ? `${prefix}.${prop}` : prop;
      keys.add(next);
      if (ts.isBindingElement(el) && ts.isObjectBindingPattern(el.name)) {
        const nested = collectBindingKeys(el.name, sf, next);
        for (const k of nested) keys.add(k);
      }
    }
  }
  return keys;
}

function compareOverloads(
  bsf: ts.SourceFile,
  msf: ts.SourceFile,
  baseMap: Map<string, ParsedFunction>,
  modMap: Map<string, ParsedFunction>,
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const out: LocatedSemanticChange[] = [];
  const count = (sf: ts.SourceFile, name: string): number => {
    let c = 0;
    sf.forEachChild((n) => {
      if (ts.isFunctionDeclaration(n) && n.name?.text === name && !n.body) c++;
    });
    return c;
  };
  for (const [key, b] of baseMap) {
    const m = modMap.get(key);
    if (!m) continue;
    const cb = count(bsf, b.name);
    const cm = count(msf, m.name);
    if (cb === cm) continue;
    out.push(
      createChange(
        'functionSignatureChanged',
        'high',
        `Function overload signatures changed for '${b.name}'`,
        `Overload count changed: ${cb} -> ${cm}`,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'FunctionDeclaration',
      ),
    );
  }
  return out;
}

function detectRename(
  baseMap: Map<string, ParsedFunction>,
  modMap: Map<string, ParsedFunction>,
  modified: ParsedCode,
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const out: LocatedSemanticChange[] = [];
  const removed = [...baseMap.keys()].filter((k) => !modMap.has(k));
  const added = [...modMap.keys()].filter((k) => !baseMap.has(k));
  if (removed.length !== 1 || added.length !== 1) return out;
  const b = baseMap.get(removed[0]!)!;
  const m = modMap.get(added[0]!)!;

  const bodyB = b.node.body?.getText(b.node.getSourceFile()) ?? '';
  const bodyM = m.node.body?.getText(m.node.getSourceFile()) ?? '';
  const similarity =
    bodyB.length > 0 && bodyM.length > 0
      ? 1 - levenshtein(bodyB, bodyM) / Math.max(bodyB.length, bodyM.length)
      : 0;

  if (similarity > 0.7) {
    // Threshold for similarity
    out.push(
      createChange(
        'functionSignatureChanged',
        'medium',
        `Function '${b.name}' was likely renamed to '${m.name}'`,
        'Detected possible rename',
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'FunctionDeclaration',
      ),
    );
  } else if (b.parameters.length !== m.parameters.length) {
    out.push(
      createChange(
        'functionSignatureChanged',
        'high',
        `Function signature changed with rename from '${b.name}' to '${m.name}'`,
        'Likely rename with param shape change',
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'FunctionDeclaration',
      ),
    );
  }
  return out;
}
