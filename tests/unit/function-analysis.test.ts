#!/usr/bin/env bun

import { test, expect, describe } from 'bun:test';
import * as ts from 'typescript';
import {
  analyzeSemanticChanges,
  createSemanticContext,
  type AnalyzerConfig,
} from '../../src/index.js';

const config: AnalyzerConfig = {
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['node_modules/**'],
  sideEffectCallees: ['console.*', 'fetch'],
  testGlobs: ['**/*.test.*'],
  bypassLabels: [],
};

describe('Function analysis taxonomy', () => {
  test('emits functionAdded for new function', () => {
    const baseCode = ``;
    const headCode = `function foo(){}\n`;
    const baseSf = ts.createSourceFile('mod.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('mod.ts', headCode, ts.ScriptTarget.Latest, true);
    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);
    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'functionAdded', severity: 'medium' }),
    );
  });

  test('emits functionRemoved for removed function', () => {
    const baseCode = `function foo(){}\n`;
    const headCode = ``;
    const baseSf = ts.createSourceFile('mod.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('mod.ts', headCode, ts.ScriptTarget.Latest, true);
    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);
    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'functionRemoved', severity: 'high' }),
    );
  });

  test('emits functionComplexityChanged for large complexity delta', () => {
    const baseCode = `function foo(){ if(a){return 1;} else {return 2;} }\n`;
    const headCode = `function foo(){ if(a && b && c && d && e && f && g){return 1;} return 0; }\n`;
    const baseSf = ts.createSourceFile('mod.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('mod.ts', headCode, ts.ScriptTarget.Latest, true);
    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);
    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    expect(changes.some((c) => c.kind === 'functionComplexityChanged')).toBe(true);
  });
});
