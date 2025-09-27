#!/usr/bin/env bun

import { describe, test, expect } from 'bun:test';
import { detectSemanticChanges } from '../../src/analyzers/index.js';

describe('Signature change detection sanity check', () => {
  test('detects useComplexState signature change', async () => {
    const baseCode = `
function useComplexState<T extends Record<string, unknown>>(
  initialState: any,
  deps: any[] = []
): [any, (updates: any) => void, boolean] {
  return [null as any, () => {}, false];
}
`;
    const modifiedCode = `
function useComplexState<T extends Record<string, unknown>>(
  initialState: any,
  deps: any[] = [],
  enableLogging = false
): [any, (updates: any) => void, boolean, () => void] {
  return [null as any, () => {}, false, () => {}];
}
`;

    const changes = await detectSemanticChanges({
      baseFilePath: '/tmp/base.ts',
      baseCode,
      modifiedFilePath: '/tmp/modified.ts',
      modifiedCode,
    });

    const kinds = new Set(changes.map((c) => c.kind));
    expect(kinds.has('functionSignatureChanged')).toBe(true);
  });
});
