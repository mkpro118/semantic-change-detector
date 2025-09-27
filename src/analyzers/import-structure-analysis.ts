/**
 * Module: Import Structure Analysis
 *
 * Responsibility
 * - Detect import additions/removals, specifier changes, and
 *   side-effect import reordering.
 *
 * Expected Output
 * - `LocatedSemanticChange[]` with 'importAdded',
 *   'importRemoved', 'importStructureChanged'.
 */
import type { AnalyzeFileParams, LocatedSemanticChange } from './types';
import { createChange } from './change-factory.js';
import type { ParsedCode } from './parser.js';

export function analyzeImportStructureChangesCore(
  base: ParsedCode,
  modified: ParsedCode,
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const out: LocatedSemanticChange[] = [];
  const baseMap = new Map(base.imports.map((i) => [i.module, i] as const));
  const modMap = new Map(modified.imports.map((i) => [i.module, i] as const));

  for (const [module, b] of baseMap) {
    const m = modMap.get(module);
    if (!m) {
      if (b.isTypeOnly) continue;
      out.push(
        createChange(
          'importRemoved',
          'medium',
          `Import removed: ${b.module}`,
          `Removed import '${b.module}'`,
          params.modifiedFilePath,
          b.line,
          b.column,
          b.line,
          b.column + b.module.length,
          'ImportDeclaration',
        ),
      );
      continue;
    }
    out.push(...compareSpecifiers(b, m, params));
  }

  for (const [module, m] of modMap) {
    if (baseMap.has(module)) continue;
    if (m.isTypeOnly) continue;
    out.push(
      createChange(
        'importAdded',
        'low',
        `Import added: ${m.module}`,
        `Added import '${m.module}'`,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.line,
        m.column + m.module.length,
        'ImportDeclaration',
      ),
    );
  }

  out.push(...detectSideEffectReorder(base.imports, modified.imports, params));

  return out;
}

function compareSpecifiers(
  b: ParsedCode['imports'][number],
  m: ParsedCode['imports'][number],
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const out: LocatedSemanticChange[] = [];
  const bSet = new Set(b.specifiers.map((s) => s.alias || s.name));
  const mSet = new Set(m.specifiers.map((s) => s.alias || s.name));
  for (const s of bSet) {
    if (mSet.has(s)) continue;
    out.push(
      createChange(
        'importStructureChanged',
        'medium',
        `Import specifier '${s}' removed from ${b.module}`,
        `Specifier '${s}' removed`,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.line,
        m.column + m.module.length,
        'ImportDeclaration',
      ),
    );
  }
  for (const s of mSet) {
    if (bSet.has(s)) continue;
    out.push(
      createChange(
        'importStructureChanged',
        'low',
        `Import specifier '${s}' added to ${m.module}`,
        `Specifier '${s}' added`,
        params.modifiedFilePath,
        m.line,
        m.column,
        m.line,
        m.column + m.module.length,
        'ImportDeclaration',
      ),
    );
  }
  return out;
}

function detectSideEffectReorder(
  base: ParsedCode['imports'],
  mod: ParsedCode['imports'],
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const out: LocatedSemanticChange[] = [];
  const seBase = base.filter((i) => i.specifiers.length === 0).map((i) => i.module);
  const seMod = mod.filter((i) => i.specifiers.length === 0).map((i) => i.module);
  const sameSet =
    seBase.length === seMod.length &&
    seBase.every((m) => seMod.includes(m)) &&
    seMod.every((m) => seBase.includes(m));
  const sameOrder = sameSet && seBase.every((m, i) => seMod[i] === m);
  if (!sameSet || sameOrder) return out;
  const first = mod.find((i) => i.specifiers.length === 0);
  if (!first) return out;
  out.push(
    createChange(
      'importStructureChanged',
      'medium',
      'Side-effect import order changed',
      `Order changed from [${seBase.join(', ')}] to [${seMod.join(', ')}]`,
      params.modifiedFilePath,
      first.line,
      first.column,
      first.line,
      first.column + first.module.length,
      'ImportDeclaration',
    ),
  );
  return out;
}
