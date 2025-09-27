/**
 * Module: Type Definition Analysis
 *
 * Responsibility
 * - Detect changes in type aliases and interfaces: additions,
 *   removals, property changes, optionality flips, and deep
 *   structural changes via a lightweight fingerprint.
 *
 * Expected Output
 * - `LocatedSemanticChange[]` with 'typeDefinitionChanged'.
 */
import ts from 'typescript';
import type { AnalyzeFileParams, LocatedSemanticChange } from './types';
import { createChange } from './change-factory.js';
import type { ParsedCode, ParsedType } from './parser.js';
import { normalizeTypeDefinition } from './parser.js';
import { levenshtein } from '../utils/ast-utils.js';

const fingerprintCache = new Map<string, string>();

export function analyzeTypeDefinitionChangesCore(
  base: ParsedCode,
  modified: ParsedCode,
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const changes: LocatedSemanticChange[] = [];
  const baseMap = new Map(base.types.map((t) => [t.name, t] as const));
  const modMap = new Map(modified.types.map((t) => [t.name, t] as const));

  for (const [name, b] of baseMap) {
    const m = modMap.get(name);
    if (!m) {
      changes.push(
        createChange(
          'typeDefinitionChanged',
          'medium',
          `Type '${name}' was removed`,
          `Removed type '${name}'`,
          params.modifiedFilePath,
          b.line,
          b.column,
          b.endLine,
          b.endColumn,
          'TypeAliasDeclaration',
        ),
      );
      continue;
    }
    compareType(name, b, m, base, modified, params, changes);
  }

  for (const [name, m] of modMap) {
    if (baseMap.has(name)) continue;
    changes.push(
      createChange(
        'typeDefinitionChanged',
        'medium',
        `Type '${name}' was added`,
        `Added type '${name}'`,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'TypeAliasDeclaration',
      ),
    );
  }

  // Simple API migration heuristic
  const removed = [...baseMap.values()].filter((t) => !modMap.has(t.name));
  const added = [...modMap.values()].filter((t) => !baseMap.has(t.name));
  if (removed.length === 1 && added.length === 1) {
    const r = removed[0]!;
    const a = added[0]!;
    if (isTypeLike(r.node) && isTypeLike(a.node)) {
      const bodyR = r.node.getText(r.node.getSourceFile());
      const bodyA = a.node.getText(a.node.getSourceFile());
      const similarity = 1 - levenshtein(bodyR, bodyA) / Math.max(bodyR.length, bodyA.length);

      if (similarity > 0.7) {
        changes.push(
          createChange(
            'typeDefinitionChanged',
            'medium',
            `Type '${r.name}' was likely renamed to '${a.name}'`,
            'Detected possible rename',
            params.modifiedFilePath,
            a.line,
            a.column,
            a.endLine,
            a.endColumn,
            'TypeAliasDeclaration',
          ),
        );
      } else {
        changes.push(
          createChange(
            'typeDefinitionChanged',
            'high',
            `API type/interface changed from '${r.name}' to '${a.name}'`,
            'Detected possible API migration',
            params.modifiedFilePath,
            a.line,
            a.column,
            a.endLine,
            a.endColumn,
            'TypeAliasDeclaration',
          ),
        );
      }
    }
  }

  return changes;
}

function compareType(
  name: string,
  b: ParsedType,
  m: ParsedType,
  base: ParsedCode,
  mod: ParsedCode,
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  if (b.definition === m.definition) return;
  if (
    ts.isTypeAliasDeclaration(b.node) &&
    ts.isTypeAliasDeclaration(m.node) &&
    ts.isIntersectionTypeNode(b.node.type) &&
    ts.isIntersectionTypeNode(m.node.type)
  ) {
    const bl = b.node.type.types.map((t) => normalizeTypeDefinition(t.getText(base.sourceFile)));
    const ml = m.node.type.types.map((t) => normalizeTypeDefinition(t.getText(mod.sourceFile)));
    const bSet = new Set(bl);
    const mSet = new Set(ml);
    const same = bl.length === ml.length && [...bSet].every((x) => mSet.has(x));
    if (!same) {
      out.push(
        createChange(
          'typeDefinitionChanged',
          'medium',
          `Intersection members changed in '${name}'`,
          `Members: [${bl.join('&')}] -> [${ml.join('&')}]`,
          params.modifiedFilePath,
          m.line,
          m.column,
          m.endLine,
          m.endColumn,
          'TypeAliasDeclaration',
        ),
      );
    }
  }
  compareProperties(name, b, m, params, out);
  compareDeepStructure(name, b, m, base, mod, params, out);
}

function compareProperties(
  name: string,
  b: ParsedType,
  m: ParsedType,
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const bp = new Map(b.properties.map((p) => [p.name, p] as const));
  const mp = new Map(m.properties.map((p) => [p.name, p] as const));
  for (const [key, prop] of bp) {
    const tgt = mp.get(key);
    if (!tgt) {
      out.push(
        createChange(
          'typeDefinitionChanged',
          'medium',
          `Property '${key}' removed from type '${name}'`,
          `Removed property '${key}'`,
          params.modifiedFilePath,
          m.line,
          m.column,
          m.endLine,
          m.endColumn,
          'PropertySignature',
        ),
      );
      continue;
    }
    if (prop.type !== tgt.type) {
      out.push(
        createChange(
          'typeDefinitionChanged',
          'medium',
          `Property '${key}' type changed in '${name}'`,
          `From '${prop.type}' to '${tgt.type}'`,
          params.modifiedFilePath,
          m.line,
          m.column,
          m.endLine,
          m.endColumn,
          'PropertySignature',
        ),
      );
    } else if (prop.optional !== tgt.optional) {
      const sev = tgt.optional ? 'low' : 'medium';
      const act = tgt.optional ? 'made optional' : 'made required';
      out.push(
        createChange(
          'typeDefinitionChanged',
          sev,
          `Property '${key}' ${act} in '${name}'`,
          `Property '${key}' ${act}`,
          params.modifiedFilePath,
          m.line,
          m.column,
          m.endLine,
          m.endColumn,
          'PropertySignature',
        ),
      );
    }
  }
  for (const [key] of mp) {
    if (bp.has(key)) continue;
    out.push(
      createChange(
        'typeDefinitionChanged',
        'medium',
        `Property '${key}' added to type '${name}'`,
        `Added property '${key}'`,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.endLine,
        m.endColumn,
        'PropertySignature',
      ),
    );
  }
}

function compareDeepStructure(
  name: string,
  b: ParsedType,
  m: ParsedType,
  base: ParsedCode,
  mod: ParsedCode,
  params: AnalyzeFileParams,
  out: LocatedSemanticChange[],
): void {
  const bfp = fingerprintTypeNode(b.node, base.sourceFile, name);
  const mfp = fingerprintTypeNode(m.node, mod.sourceFile, name);
  if (bfp === mfp) return;
  const isRecursive = bfp.includes('SELF') || mfp.includes('SELF');
  out.push(
    createChange(
      'typeDefinitionChanged',
      isRecursive ? 'high' : 'medium',
      `Type structure changed in '${name}'`,
      'Deep structural fingerprint changed',
      params.modifiedFilePath,
      m.line,
      m.column,
      m.endLine,
      m.endColumn,
      'TypeAliasDeclaration',
    ),
  );
}

function fingerprintTypeNode(
  node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
  sf: ts.SourceFile,
  self?: string,
): string {
  const key = `${self ?? 't'}:${node.pos}:${node.end}`;
  const hit = fingerprintCache.get(key);
  if (hit) return hit;
  const tl = ts.isInterfaceDeclaration(node)
    ? ts.factory.createTypeLiteralNode(node.members as readonly ts.TypeElement[])
    : node.type;
  const res = fpNode(tl, sf, self, 0);
  fingerprintCache.set(key, res);
  return res;
}

function fpNode(
  x: ts.TypeNode,
  sf: ts.SourceFile,
  self: string | undefined,
  depth: number,
): string {
  if (depth > 200) return 'DEPTH_LIMIT';
  if (ts.isTypeReferenceNode(x)) {
    const name = x.typeName.getText(sf);
    const args = x.typeArguments?.map((a) => fpNode(a, sf, self, depth + 1)) ?? [];
    if (name === 'Array' && args.length === 1) return `ARR<${args[0]!}>`;
    const ref = self && name === self ? 'SELF' : `REF:${name}`;
    return `${ref}${args.length ? `<${args.join(',')}>` : ''}`;
  }
  if (ts.isArrayTypeNode(x)) return `ARR<${fpNode(x.elementType, sf, self, depth + 1)}>`;
  if (ts.isUnionTypeNode(x))
    return `UNION<${x.types
      .map((t) => fpNode(t, sf, self, depth + 1))
      .sort()
      .join('|')}>`;
  if (ts.isIntersectionTypeNode(x))
    return `INTER<${x.types
      .map((t) => fpNode(t, sf, self, depth + 1))
      .sort()
      .join('&')}>`;
  if (ts.isTemplateLiteralTypeNode(x)) {
    const parts = x.templateSpans.map((sp) => fpNode(sp.type, sf, self, depth + 1)).join('|');
    return `TPL<${x.head.text}|${parts}>`;
  }
  if (ts.isMappedTypeNode(x)) {
    const inner = x.type ? fpNode(x.type, sf, self, depth + 1) : 'any';
    return `MAP<${inner}>`;
  }
  if (ts.isTypeLiteralNode(x)) {
    const entries = x.members
      .map((m) =>
        ts.isPropertySignature(m) && m.name && m.type
          ? `${m.name.getText(sf)}:${fpNode(m.type, sf, self, depth + 1)}`
          : 'member',
      )
      .sort();
    return `TL{${entries.join(',')}}`;
  }
  return normalizeTypeDefinition(x.getText(sf));
}

function isTypeLike(n: ts.Node): boolean {
  return ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n);
}
