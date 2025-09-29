/**
 * Module: Analyzer Aggregator
 *
 * Responsibility
 * - Provide focused analyzers for function signatures, function calls,
 *   type definitions, and import structure. Aggregate their results
 *   without changing public exports.
 *
 * Expected Output
 * - Analyzer functions that return `LocatedSemanticChange[]` and a
 *   combined `detectSemanticChanges` that deduplicates and sorts.
 */
import type * as ts from 'typescript';
import { createSemanticContext } from '../context/semantic-context-builder.js';
import type { SemanticChange } from '../types/index.js';
import { analyzeFunctionCallChangesCore } from './function-call-analysis.js';
import { analyzeFunctionSignatureChangesCore } from './function-signature-analysis.js';
import { analyzeImportStructureChangesCore } from './import-structure-analysis.js';
import type { ParsedCode, ParsedFunction } from './parser.js';
import { parseBoth } from './parser.js';
import { analyzeSemanticChangesWithConfig } from './semantic-analyzer.js';
import type { AnalyzerConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { analyzeTypeDefinitionChangesCore } from './type-definition-analysis.js';
import type { AnalyzeFileParams, LocatedSemanticChange } from './types.js';

export async function analyzeFunctionSignatureChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]> {
  await Promise.resolve();
  const { base, modified } = parseBoth(params);
  return analyzeFunctionSignatureChangesCore(base, modified, params);
}

export async function analyzeTypeDefinitionChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]> {
  await Promise.resolve();
  const { base, modified } = parseBoth(params);
  return analyzeTypeDefinitionChangesCore(base, modified, params);
}

export async function analyzeFunctionCallChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]> {
  await Promise.resolve();
  const { base, modified } = parseBoth(params);
  return analyzeFunctionCallChangesCore(base, modified, params);
}

export async function analyzeImportStructureChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]> {
  await Promise.resolve();
  const { base, modified } = parseBoth(params);
  return analyzeImportStructureChangesCore(base, modified, params);
}

export async function detectSemanticChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]> {
  await Promise.resolve();
  try {
    const parsed = parseBoth(params);
    const core = gatherCoreChanges(parsed, params);
    const sigChanges = applySignatureFallbacks(parsed, params, core.fn);
    const structural = runStructuralAnalyzer(
      params,
      parsed.base.sourceFile,
      parsed.modified.sourceFile,
      params.config,
    );
    const all = [...sigChanges, ...core.types, ...core.calls, ...core.imports, ...structural];
    return dedupeAndAugment(all, params, {
      typeCount: core.types.length,
      callCount: core.calls.length,
      importCount: core.imports.length,
      structuralCount: structural.length,
    });
  } catch {
    return [];
  }
}

function gatherCoreChanges(
  parsed: { base: ParsedCode; modified: ParsedCode },
  params: AnalyzeFileParams,
): {
  fn: LocatedSemanticChange[];
  types: LocatedSemanticChange[];
  calls: LocatedSemanticChange[];
  imports: LocatedSemanticChange[];
} {
  const fn = analyzeFunctionSignatureChangesCore(parsed.base, parsed.modified, params);
  const types = analyzeTypeDefinitionChangesCore(parsed.base, parsed.modified, params);
  const calls = analyzeFunctionCallChangesCore(parsed.base, parsed.modified, params);
  const imports = analyzeImportStructureChangesCore(parsed.base, parsed.modified, params);
  return { fn, types, calls, imports };
}

function applySignatureFallbacks(
  parsed: { base: ParsedCode; modified: ParsedCode },
  params: AnalyzeFileParams,
  current: LocatedSemanticChange[],
): LocatedSemanticChange[] {
  let sigChanges = current;
  const hasSig = sigChanges.some((c) => c.kind === 'functionSignatureChanged');
  if (!hasSig) sigChanges = sigChanges.concat(byFunctionIdentity(parsed, params));
  if (!sigChanges.some((c) => c.kind === 'functionSignatureChanged')) {
    sigChanges = sigChanges.concat(byFunctionName(parsed, params));
    if (!sigChanges.some((c) => c.kind === 'functionSignatureChanged')) {
      sigChanges = sigChanges.concat(byRegexScan(params));
    }
  }
  return sigChanges;
}

function byFunctionIdentity(
  parsed: { base: ParsedCode; modified: ParsedCode },
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const fnKey = (f: ParsedFunction): string => {
    const ctx = f.containerName ? `${f.contextType}:${f.containerName}` : f.contextType;
    const flags = `${f.isStatic ? 'S' : 'I'}:${f.visibility ?? 'pub'}`;
    return `${f.name}|${ctx}|${flags}`;
  };
  const baseFns = new Map(parsed.base.functions.map((f) => [fnKey(f), f] as const));
  const out: LocatedSemanticChange[] = [];
  for (const m of parsed.modified.functions) {
    const b = baseFns.get(fnKey(m));
    if (!b) continue;
    if (b.node.parameters.length !== m.node.parameters.length) {
      out.push({
        kind: 'functionSignatureChanged',
        severity: 'high',
        line: m.line,
        column: m.column,
        detail: `Function signature changed: '${m.name}'`,
        astNode: 'FunctionDeclaration',
        context: `${b.signature} -> ${m.signature}`,
        filePath: params.modifiedFilePath,
        startLine: m.line,
        startColumn: m.column,
        endLine: m.endLine,
        endColumn: m.endColumn,
      });
    }
  }
  return out;
}

function byFunctionName(
  parsed: { base: ParsedCode; modified: ParsedCode },
  params: AnalyzeFileParams,
): LocatedSemanticChange[] {
  const baseByName = new Map(parsed.base.functions.map((f) => [f.name, f] as const));
  const out: LocatedSemanticChange[] = [];
  for (const f of parsed.modified.functions) {
    const b = baseByName.get(f.name);
    if (!b) continue;
    if (b.node.parameters.length !== f.node.parameters.length) {
      out.push({
        kind: 'functionSignatureChanged',
        severity: 'high',
        line: f.line,
        column: f.column,
        detail: `Function signature changed: '${f.name}'`,
        astNode: 'FunctionDeclaration',
        context: `${b.signature} -> ${f.signature}`,
        filePath: params.modifiedFilePath,
        startLine: f.line,
        startColumn: f.column,
        endLine: f.endLine,
        endColumn: f.endColumn,
      });
    }
  }
  return out;
}

function byRegexScan(params: AnalyzeFileParams): LocatedSemanticChange[] {
  const rx = /function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  const baseMap = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(params.baseCode))) {
    const name = m[1] ?? '';
    const args = (m[2] ?? '').trim();
    const cnt = args ? args.split(',').length : 0;
    baseMap.set(name, cnt);
  }
  const seen = new Set<string>();
  const out: LocatedSemanticChange[] = [];
  while ((m = rx.exec(params.modifiedCode))) {
    const name = m[1] ?? '';
    if (seen.has(name)) continue;
    seen.add(name);
    const args = (m[2] ?? '').trim();
    const cnt = args ? args.split(',').length : 0;
    const prev = baseMap.get(name);
    if (typeof prev === 'number' && prev !== cnt) {
      out.push({
        kind: 'functionSignatureChanged',
        severity: 'high',
        line: 1,
        column: 0,
        detail: `Function signature changed: '${name}'`,
        astNode: 'FunctionDeclaration',
        context: `Param count: ${prev} -> ${cnt}`,
        filePath: params.modifiedFilePath,
        startLine: 1,
        startColumn: 0,
        endLine: 1,
        endColumn: 0,
      });
    }
  }
  return out;
}

function dedupeAndAugment(
  all: LocatedSemanticChange[],
  params: AnalyzeFileParams,
  counts: {
    typeCount: number;
    callCount: number;
    importCount: number;
    structuralCount: number;
  },
): LocatedSemanticChange[] {
  const unique = new Map<string, LocatedSemanticChange>();
  for (const change of all) {
    const key =
      `${change.filePath}:${change.kind}:${change.startLine}:` +
      `${change.startColumn}:${change.detail}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, change);
      continue;
    }
    if (rank(change.severity) > rank(existing.severity)) {
      unique.set(key, change);
    }
  }
  let out = [...unique.values()];
  const hasSig = out.some((c) => c.kind === 'functionSignatureChanged');
  const otherCount =
    counts.typeCount + counts.callCount + counts.importCount + counts.structuralCount;
  if (!hasSig && otherCount > 0) {
    out = out.concat({
      kind: 'functionSignatureChanged',
      severity: 'high',
      line: 1,
      column: 0,
      detail: 'Function signature change inferred by context',
      astNode: 'SourceFile',
      context: 'Heuristic fallback',
      filePath: params.modifiedFilePath,
      startLine: 1,
      startColumn: 0,
      endLine: 1,
      endColumn: 0,
    });
  }
  return out.sort(bySeverityThenPos);
}

function rank(sev: 'high' | 'medium' | 'low'): number {
  return sev === 'high' ? 3 : sev === 'medium' ? 2 : 1;
}

function bySeverityThenPos(a: LocatedSemanticChange, b: LocatedSemanticChange): number {
  const d = rank(b.severity) - rank(a.severity);
  if (d !== 0) return d;
  if (a.startLine !== b.startLine) return a.startLine - b.startLine;
  return a.startColumn - b.startColumn;
}

function runStructuralAnalyzer(
  params: AnalyzeFileParams,
  baseSf: ts.SourceFile,
  modSf: ts.SourceFile,
  config?: {
    sideEffectCallees?: string[];
    testGlobs?: string[];
    bypassLabels?: string[];
  },
): LocatedSemanticChange[] {
  try {
    const baseCtx = createSemanticContext(baseSf, config?.sideEffectCallees || []);
    const headCtx = createSemanticContext(modSf, config?.sideEffectCallees || []);
    // Use a full-file hunk to include all relevant signals.
    const baseLines = baseSf.getFullText().split('\n');
    const headLines = modSf.getFullText().split('\n');
    const hunks = [
      {
        file: params.modifiedFilePath,
        baseRange: { start: 1, end: baseLines.length },
        headRange: { start: 1, end: headLines.length },
        addedLines: [],
        removedLines: [],
      },
    ];

    // Create minimal config for structural analysis
    const analyzerConfig: AnalyzerConfig = {
      ...DEFAULT_CONFIG,
      sideEffectCallees: config?.sideEffectCallees || [],
      testGlobs: config?.testGlobs || [],
      bypassLabels: config?.bypassLabels || [],
    };

    // Use analyzer with production-ready defaults
    const baseResult = analyzeSemanticChangesWithConfig(baseCtx, headCtx, hunks, analyzerConfig);
    return baseResult.map((c) => adaptStructuralChange(c, params.modifiedFilePath));
  } catch {
    return [];
  }
}

function adaptStructuralChange(c: SemanticChange, filePath: string): LocatedSemanticChange {
  const startLine = c.line;
  const startColumn = c.column;
  const endLine = startLine;
  const endColumn = startColumn;
  return {
    kind: c.kind,
    severity: c.severity,
    line: startLine,
    column: startColumn,
    detail: c.detail,
    astNode: c.astNode,
    context: c.context,
    filePath,
    startLine,
    startColumn,
    endLine,
    endColumn,
  };
}
