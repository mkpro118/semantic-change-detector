#!/usr/bin/env bun

import { describe, test, expect } from 'bun:test';
import * as ts from 'typescript';
import { createSemanticContext } from '../../src/context/semantic-context-builder.js';
import { analyzeSemanticChanges } from '../../src/analyzers/semantic-analyzer.js';

describe('Side effect pattern matching', () => {
  function analyze(codeBase: string, codeHead: string, patterns: string) {
    const base = ts.createSourceFile('a.ts', codeBase, ts.ScriptTarget.Latest, true);
    const head = ts.createSourceFile('a.ts', codeHead, ts.ScriptTarget.Latest, true);
    const baseCtx = createSemanticContext(
      base,
      patterns.split(',').map((s) => s.trim()),
    );
    const headCtx = createSemanticContext(
      head,
      patterns.split(',').map((s) => s.trim()),
    );
    return analyzeSemanticChanges(baseCtx, headCtx, [], codeBase, codeHead, {
      include: ['**/*.ts', '**/*.tsx'],
      exclude: [],
      sideEffectCallees: patterns.split(',').map((s) => s.trim()),
      testGlobs: [],
      bypassLabels: [],
    });
  }

  test('matches console.* and fetch', () => {
    const base = `function x(){}`;
    const head = `function x(){ console.log('x'); fetch('/'); }`;
    const changes = analyze(base, head, 'console.*,fetch');
    expect(
      changes.some((c) => c.kind === 'functionCallAdded' && c.detail.includes('console.log')),
    ).toBe(true);
    expect(changes.some((c) => c.kind === 'functionCallAdded' && c.detail.includes('fetch'))).toBe(
      true,
    );
  });

  test('matches *.api.* pattern', () => {
    const base = `function x(){}`;
    const head = `function x(){ user.api.save(); }`;
    const changes = analyze(base, head, '*.api.*');
    expect(
      changes.some((c) => c.kind === 'functionCallAdded' && c.detail.includes('user.api.save')),
    ).toBe(true);
  });

  test('matches analytics.* and track* patterns', () => {
    const base = `function x(){}`;
    const head = `function x(){ analytics.trackEvent('e'); trackUserActivity(); }`;
    const changes = analyze(base, head, 'analytics.*,track*');
    expect(
      changes.some(
        (c) => c.kind === 'functionCallAdded' && c.detail.includes('analytics.trackEvent'),
      ),
    ).toBe(true);
    expect(
      changes.some((c) => c.kind === 'functionCallAdded' && c.detail.includes('trackUserActivity')),
    ).toBe(true);
  });
});
