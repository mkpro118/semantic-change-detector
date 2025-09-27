#!/usr/bin/env bun

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { detectSemanticChanges } from '../../src/analyzers/index.js';

function readFixture(rel: string): string {
  const p = resolve(process.cwd(), 'tests/fixtures', rel);
  return readFileSync(p, 'utf8');
}

describe('Analyzer aggregation and consolidation', () => {
  test('includes JSX change signals from structural analysis', async () => {
    const baseCode = readFixture('jsx-changes-base.tsx');
    const modifiedCode = readFixture('jsx-changes-modified.tsx');

    const changes = await detectSemanticChanges({
      baseFilePath: '/jsx/base.tsx',
      baseCode,
      modifiedFilePath: '/jsx/modified.tsx',
      modifiedCode,
    });

    // Sanity: Should include at least one JSX change
    expect(
      changes.some(
        (c) =>
          c.kind === 'jsxElementAdded' ||
          c.kind === 'jsxLogicAdded' ||
          c.kind === 'eventHandlerChanged' ||
          c.kind === 'componentReferenceChanged',
      ),
    ).toBe(true);
  });
});
