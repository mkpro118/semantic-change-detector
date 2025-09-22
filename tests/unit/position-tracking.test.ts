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

describe('Position tracking for semantic changes', () => {
  test('exportAdded reports accurate line/column for export declarations', () => {
    const baseCode = `function foo() { return 1; }\n`;
    const headCode = `function foo() { return 1; }\nexport { foo };\n`;

    const baseSf = ts.createSourceFile('mod.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('mod.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    const added = changes.find((c) => c.kind === 'exportAdded');
    expect(added).toBeDefined();
    expect(added?.line).toBe(2);
    expect(added?.column).toBe(1);
  });

  test('importAdded uses import declaration position', () => {
    const baseCode = ``;
    const headCode = `import { readFile } from 'fs';\n`;

    const baseSf = ts.createSourceFile('imp.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('imp.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    const added = changes.find((c) => c.kind === 'importAdded');
    expect(added).toBeDefined();
    expect(added?.line).toBe(1);
    expect(added?.column).toBe(1);
  });

  test('typeDefinitionChanged (add) uses type alias position', () => {
    const baseCode = ``;
    const headCode = `// header\n\ntype ID = string;\n`;

    const baseSf = ts.createSourceFile('types.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('types.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    const added = changes.find((c) => c.kind === 'typeDefinitionChanged');
    expect(added).toBeDefined();
    expect(added?.line).toBe(3);
  });

  test('variableDeclarationChanged (add) uses variable position', () => {
    const baseCode = '';
    const headCode = `\nconst foo: number = 1;\n`;

    const baseSf = ts.createSourceFile('vars.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('vars.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    const added = changes.find((c) => c.kind === 'variableDeclarationChanged');
    expect(added).toBeDefined();
    expect(added?.line).toBe(2);
  });
  test('functionSignatureChanged uses function declaration position', () => {
    const baseCode = `\n\nfunction add(a: number, b: number) { return a + b; }\n`;
    const headCode = `\n\nfunction add(a: number, b: number, c: number) { return a + b + c; }\n`;

    const baseSf = ts.createSourceFile('calc.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('calc.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    const sig = changes.find((c) => c.kind === 'functionSignatureChanged');
    expect(sig).toBeDefined();
    expect(sig?.line).toBe(3); // third line
  });

  test('classStructureChanged for class added uses class position', () => {
    const baseCode = `const x = 1;\n`;
    const headCode = `const x = 1;\nclass A {}\n`;

    const baseSf = ts.createSourceFile('cls.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSf = ts.createSourceFile('cls.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseCtx = createSemanticContext(baseSf, config.sideEffectCallees);
    const headCtx = createSemanticContext(headSf, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(baseCtx, headCtx, [], baseCode, headCode, config);
    const added = changes.find(
      (c) => c.kind === 'classStructureChanged' && c.detail.includes('Class added'),
    );
    expect(added).toBeDefined();
    expect(added?.line).toBe(2);
  });
});
