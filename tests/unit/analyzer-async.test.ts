#!/usr/bin/env bun

import { describe, test } from 'bun:test';
import { detectSemanticChanges } from '../../src/analyzers/index.js';
import { assertHasChange } from './_helpers.ts';

describe('Async Analyzers', () => {
  describe('asyncAwaitAdded', () => {
    test('detects async/await addition', async () => {
      const baseCode = `
function fetchData() {
  return Promise.resolve([1, 2, 3]);
}
`;
      const modifiedCode = `
async function fetchData() {
  return await Promise.resolve([1, 2, 3]);
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'asyncAwaitAdded',
        'Should detect async/await addition',
      );
    });
  });

  describe('asyncAwaitRemoved', () => {
    test('detects async/await removal', async () => {
      const baseCode = `
async function fetchData() {
  return await Promise.resolve([1, 2, 3]);
}
`;
      const modifiedCode = `
function fetchData() {
  return Promise.resolve([1, 2, 3]);
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'asyncAwaitRemoved',
        'Should detect async/await removal',
      );
    });
  });

  describe('promiseAdded', () => {
    test('detects promise addition', async () => {
      const baseCode = `
function getValue() {
  return 1;
}
`;
      const modifiedCode = `
function getValue() {
  return Promise.resolve(1);
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'promiseAdded', 'Should detect promise addition');
    });
  });

  describe('promiseRemoved', () => {
    test('detects promise removal', async () => {
      const baseCode = `
function getValue() {
  return Promise.resolve(1);
}
`;
      const modifiedCode = `
function getValue() {
  return 1;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'promiseRemoved', 'Should detect promise removal');
    });
  });
});
