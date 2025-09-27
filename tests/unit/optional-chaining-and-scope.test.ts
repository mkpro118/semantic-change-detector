#!/usr/bin/env bun

import { describe, test, expect } from 'bun:test';
import { analyzeFunctionCallChanges } from '../../src/analyzers/index.js';
import { assertHasChange, assertNoChange } from './_helpers.ts';

describe('Optional chaining and nearest-scope dependency resolution', () => {
  describe('Optional chaining call equivalence', () => {
    test('obj?.m(a) ≡ obj.m?.(a) (no change)', async () => {
      const baseCode = `
const obj = { m(a: number) { return a } };
const result = obj?.m(1);
`;
      const modifiedCode = `
const obj = { m(a: number) { return a } };
const result = obj.m?.(1);
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      expect(changes.length).toBe(0);
    });

    test('a.b.m(x) ≡ a?.b.m(x) (no change)', async () => {
      const baseCode = `
const a = { b: { m(x: number){ return x } } };
a.b.m(2);
`;
      const modifiedCode = `
const a = { b: { m(x: number){ return x } } };
a?.b.m(2);
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      expect(changes.length).toBe(0);
    });

    test('optional chaining with argument change is detected', async () => {
      const baseCode = `
const obj = { m(a: number, b?: number) { return a } };
obj?.m(1, 2);
`;
      const modifiedCode = `
const obj = { m(a: number, b?: number) { return a } };
obj?.m(1);
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged',
        'Argument count change under optional chaining should be detected',
      );
    });
  });

  describe('Nearest-scope dependency identifier resolution', () => {
    test('prefers nearest scope variable for hook deps (detects inner deps change)', async () => {
      const baseCode = `
declare function useEffect(cb: () => void, deps?: any[]): void;
const deps = [city];
function C(city: string, unit: string) {
  const deps = [city];
  useEffect(() => {}, deps);
}
`;
      const modifiedCode = `
declare function useEffect(cb: () => void, deps?: any[]): void;
const deps = [city];
function C(city: string, unit: string) {
  const deps = [city, unit];
  useEffect(() => {}, deps);
}
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/hook/base.ts',
        baseCode,
        modifiedFilePath: '/hook/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged' && /Hook dependency array changed/.test(c.detail),
        'Should detect inner deps change using nearest-scope resolution',
      );
    });

    test('ignores outer-scope deps change when inner deps used', async () => {
      const baseCode = `
declare function useEffect(cb: () => void, deps?: any[]): void;
const deps = [city];
function C(city: string, unit: string) {
  const deps = [city];
  useEffect(() => {}, deps);
}
`;
      const modifiedCode = `
declare function useEffect(cb: () => void, deps?: any[]): void;
const deps = [city, unit];
function C(city: string, unit: string) {
  const deps = [city];
  useEffect(() => {}, deps);
}
`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/hook/base.ts',
        baseCode,
        modifiedFilePath: '/hook/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'functionCallChanged' && /Hook dependency array changed/.test(c.detail),
        'Should not report change when only outer deps changed but inner deps used',
      );
    });
  });
});
