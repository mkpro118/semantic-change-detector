#!/usr/bin/env bun

import { describe, test } from 'bun:test';
import {
  analyzeTypeDefinitionChanges,
  analyzeFunctionCallChanges,
  analyzeImportStructureChanges,
  analyzeFunctionSignatureChanges,
} from '../../src/analyzers/index.js';

import { assertHasChange, assertNoChange, findLineOf } from './_helpers.ts';

describe('Calls, imports, and type equivalence', () => {
  describe('Function call behavior', () => {
    test('detects argument reordering (low severity)', async () => {
      const baseCode = `
function f(a: number, b: number) { return a + b }
const x = 1, y = 2;
f(x, y);
`;
      const modifiedCode = `
function f(a: number, b: number) { return a + b }
const x = 1, y = 2;
f(y, x);
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/reorder/base.ts',
        baseCode,
        modifiedFilePath: '/reorder/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged' && c.severity === 'low',
        'Argument reordering should be detected (low severity)',
      );
    });

    test('ignores callee identifier rename-only', async () => {
      const baseCode = `
const obj = { m(a: number) {} };
obj.m(1);
`;
      const modifiedCode = `
const instance = { m(a: number) {} };
instance.m(1);
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/rename/base.ts',
        baseCode,
        modifiedFilePath: '/rename/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind.startsWith('functionCall'),
        'Callee variable rename-only should not be flagged',
      );
    });

    test('moving a call does not imply add/remove', async () => {
      const baseCode =
        `
function g(v: number) { return v }
// region A
g(1);
// many lines separating
// region B
` +
        '\n'.repeat(50) +
        `
export const done = true;
`;
      const modifiedCode =
        `
function g(v: number) { return v }
// region A
// many lines separating
// region B
` +
        '\n'.repeat(50) +
        `
g(1);
export const done = true;
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/move/base.ts',
        baseCode,
        modifiedFilePath: '/move/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'functionCallAdded' || c.kind === 'functionCallRemoved',
        'Pure relocation should not create add/remove events',
      );
    });

    test('detects function call removal', async () => {
      const baseCode = `
function log(message: string) { console.log(message); }
log('hello');
`;
      const modifiedCode = `
function log(message: string) { console.log(message); }
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/remove/base.ts',
        baseCode,
        modifiedFilePath: '/remove/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallRemoved',
        'Function call removal should be detected',
      );
    });
  });

  describe('Import structure semantics', () => {
    test('flags reordering of side-effect-only imports', async () => {
      const baseCode = `
import './a.polyfill';
import './b.polyfill';
`;
      const modifiedCode = `
import './b.polyfill';
import './a.polyfill';
`;

      const changes = await analyzeImportStructureChanges({
        baseFilePath: '/imports/base.ts',
        baseCode,
        modifiedFilePath: '/imports/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'importStructureChanged',
        'Reordering side-effect imports should be flagged',
      );
    });

    test('ignores added type-only import', async () => {
      const baseCode = `
// no imports
export type X = { a: number };
`;
      const modifiedCode = `
import type { Something } from 'pkg';
export type X = { a: number };
`;

      const changes = await analyzeImportStructureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind.startsWith('import'),
        'Type-only import addition should be ignored',
      );
    });

    test('ignores removed type-only import', async () => {
      const baseCode = `
import type { Something } from 'pkg';
export type X = { a: number };
`;
      const modifiedCode = `
export type X = { a: number };
`;

      const changes = await analyzeImportStructureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind.startsWith('import'),
        'Type-only import removal should be ignored',
      );
    });
  });

  describe('Type equivalence normalization', () => {
    test('treats Array<T> and T[] as equivalent', async () => {
      const baseCode = `
type Items<T> = Array<T>;
`;
      const modifiedCode = `
type Items<T> = T[];
`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged',
        'Array<T> vs T[] should be treated as equivalent',
      );
    });

    test('treats Partial<Pick<T,K>> and Pick<Partial<T>,K> as equivalent', async () => {
      const baseCode = `
type PP<T, K extends keyof T> = Partial<Pick<T, K>>;
`;
      const modifiedCode = `
type PP<T, K extends keyof T> = Pick<Partial<T>, K>;
`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged',
        'Equivalent utility type compositions should be ignored',
      );
    });
  });

  describe('Hook dependency resolution', () => {
    test('detects deps changes from identifiers and spreads', async () => {
      const baseCode = `
import { useEffect } from 'react';
export function C({ city, unit }: { city: string; unit: string }) {
  const deps = [city];
  useEffect(() => { console.log(city); }, deps);
  return null;
}
`;
      const modifiedCode = `
import { useEffect } from 'react';
export function C({ city, unit }: { city: string; unit: string }) {
  const baseDeps = [city];
  const extra = [unit];
  const deps = [...baseDeps, ...extra];
  useEffect(() => { console.log(city, unit); }, deps);
  return null;
}
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged' && /Hook dependency array changed/i.test(c.detail),
        'Should detect hook dependency changes via identifiers/spreads',
      );
    });
  });

  describe('Signature scoping', () => {
    test('class method change does not pollute global function', async () => {
      const baseCode = `
class Processor { process(data: string): void {} }
function process(data: string): void {}
`;
      const modifiedCode = `
class Processor { process(data: string, options: object): void {} }
function process(data: string): void {}
`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/scope/base.ts',
        baseCode,
        modifiedFilePath: '/scope/modified.ts',
        modifiedCode,
      });

      const count = changes.filter((c) => c.kind === 'functionSignatureChanged').length;
      const methodLine = findLineOf(modifiedCode, 'class Processor { process(');
      const change = changes.find((c) => c.kind === 'functionSignatureChanged')!;
      if (count !== 1) throw new Error('Expected exactly one signature change');
      if (change.startLine !== methodLine) {
        throw new Error('Expected method change to anchor to class method line');
      }
    });
  });
});
