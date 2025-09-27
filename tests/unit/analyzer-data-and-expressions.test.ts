#!/usr/bin/env bun

import { describe, test } from 'bun:test';
import { detectSemanticChanges } from '../../src/analyzers/index.js';
import { assertHasChange } from './_helpers.ts';

describe('Data and Expressions Analyzers', () => {
  describe('arrayMutation', () => {
    test('detects array mutation', async () => {
      const baseCode = `
const arr = [1, 2, 3];
`;
      const modifiedCode = `
const arr = [1, 2, 3];
arr.push(4);
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'arrayMutation', 'Should detect array mutation');
    });
  });

  describe('comparisonOperatorChanged', () => {
    test('detects comparison operator change', async () => {
      const baseCode = `
function isEqual(a: any, b: any) {
  return a == b;
}
`;
      const modifiedCode = `
function isEqual(a: any, b: any) {
  return a === b;
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
        (c) => c.kind === 'comparisonOperatorChanged',
        'Should detect comparison operator change',
      );
    });
  });

  describe('destructuringAdded', () => {
    test('detects destructuring addition', async () => {
      const baseCode = `
function process(data: { a: number, b: string }) {
  const a = data.a;
  const b = data.b;
  return a + b.length;
}
`;
      const modifiedCode = `
function process(data: { a: number, b: string }) {
  const { a, b } = data;
  return a + b.length;
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
        (c) => c.kind === 'destructuringAdded',
        'Should detect destructuring addition',
      );
    });
  });

  describe('destructuringRemoved', () => {
    test('detects destructuring removal', async () => {
      const baseCode = `
function process(data: { a: number, b: string }) {
  const { a, b } = data;
  return a + b.length;
}
`;
      const modifiedCode = `
function process(data: { a: number, b: string }) {
  const a = data.a;
  const b = data.b;
  return a + b.length;
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
        (c) => c.kind === 'destructuringRemoved',
        'Should detect destructuring removal',
      );
    });
  });

  describe('logicalOperatorChanged', () => {
    test('detects logical operator change', async () => {
      const baseCode = `
function check(a: boolean, b: boolean) {
  return a && b;
}
`;
      const modifiedCode = `
function check(a: boolean, b: boolean) {
  return a || b;
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
        (c) => c.kind === 'logicalOperatorChanged',
        'Should detect logical operator change',
      );
    });
  });

  describe('objectMutation', () => {
    test('detects object mutation', async () => {
      const baseCode = `
const obj = { a: 1 };
`;
      const modifiedCode = `
const obj = { a: 1 };
obj.a = 2;
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'objectMutation', 'Should detect object mutation');
    });
  });

  describe('spreadOperatorAdded', () => {
    test('detects spread operator addition', async () => {
      const baseCode = `
const obj1 = { a: 1, b: 2 };
const obj2 = { a: obj1.a, b: obj1.b, c: 3 };
`;
      const modifiedCode = `
const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3 };
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'spreadOperatorAdded',
        'Should detect spread operator addition',
      );
    });
  });

  describe('spreadOperatorRemoved', () => {
    test('detects spread operator removal', async () => {
      const baseCode = `
const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3 };
`;
      const modifiedCode = `
const obj1 = { a: 1, b: 2 };
const obj2 = { a: obj1.a, b: obj1.b, c: 3 };
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'spreadOperatorRemoved',
        'Should detect spread operator removal',
      );
    });
  });

  describe('variableAssignmentChanged', () => {
    test('detects variable assignment change', async () => {
      const baseCode = `
let a = 1;
a = 2;
`;
      const modifiedCode = `
let a = 1;
a = 3;
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'variableAssignmentChanged',
        'Should detect variable assignment change',
      );
    });
  });
});
