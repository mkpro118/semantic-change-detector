#!/usr/bin/env bun

import { describe, test } from 'bun:test';
import { detectSemanticChanges } from '../../src/analyzers/index.js';
import { assertHasChange } from './_helpers.ts';

describe('Control Flow Analyzers', () => {
  describe('conditionalAdded', () => {
    test('detects conditional addition', async () => {
      const baseCode = `
function process(a: number) {
  return a * 2;
}
`;
      const modifiedCode = `
function process(a: number) {
  if (a > 0) {
    return a * 2;
  }
  return a;
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
        (c) => c.kind === 'conditionalAdded',
        'Should detect conditional addition',
      );
    });
  });

  describe('conditionalModified', () => {
    test('detects conditional modification', async () => {
      const baseCode = `
function process(a: number, b: boolean) {
  if (a > 0) {
    return a * 2;
  }
  return a;
}
`;
      const modifiedCode = `
function process(a: number, b: boolean) {
  if (a > 0 && b) {
    return a * 2;
  }
  return a;
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
        (c) => c.kind === 'conditionalModified',
        'Should detect conditional modification',
      );
    });
  });

  describe('conditionalRemoved', () => {
    test('detects conditional removal', async () => {
      const baseCode = `
function process(a: number) {
  if (a > 0) {
    return a * 2;
  }
  return a;
}
`;
      const modifiedCode = `
function process(a: number) {
  return a * 2;
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
        (c) => c.kind === 'conditionalRemoved',
        'Should detect conditional removal',
      );
    });
  });

  describe('loopAdded', () => {
    test('detects loop addition', async () => {
      const baseCode = `
function process(items: number[]) {
  return items.length;
}
`;
      const modifiedCode = `
function process(items: number[]) {
  for (const item of items) {
    console.log(item);
  }
  return items.length;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'loopAdded', 'Should detect loop addition');
    });
  });

  describe('loopModified', () => {
    test('detects loop modification', async () => {
      const baseCode = `
function process(items: number[]) {
  for (let i = 0; i < items.length; i++) {
    console.log(items[i]);
  }
}
`;
      const modifiedCode = `
function process(items: number[]) {
  for (let i = 0; i < items.length - 1; i++) {
    console.log(items[i]);
  }
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'loopModified', 'Should detect loop modification');
    });
  });

  describe('loopRemoved', () => {
    test('detects loop removal', async () => {
      const baseCode = `
function process(items: number[]) {
  for (const item of items) {
    console.log(item);
  }
  return items.length;
}
`;
      const modifiedCode = `
function process(items: number[]) {
  return items.length;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'loopRemoved', 'Should detect loop removal');
    });
  });

  describe('ternaryAdded', () => {
    test('detects ternary addition', async () => {
      const baseCode = `
function getValue(a: boolean) {
  if (a) {
    return 1;
  } else {
    return 2;
  }
}
`;
      const modifiedCode = `
function getValue(a: boolean) {
  return a ? 1 : 2;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'ternaryAdded', 'Should detect ternary addition');
    });
  });

  describe('ternaryRemoved', () => {
    test('detects ternary removal', async () => {
      const baseCode = `
function getValue(a: boolean) {
  return a ? 1 : 2;
}
`;
      const modifiedCode = `
function getValue(a: boolean) {
  if (a) {
    return 1;
  } else {
    return 2;
  }
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'ternaryRemoved', 'Should detect ternary removal');
    });
  });

  describe('throwAdded', () => {
    test('detects throw addition', async () => {
      const baseCode = `
function validate(value: number) {
  if (value < 0) {
    return false;
  }
  return true;
}
`;
      const modifiedCode = `
function validate(value: number) {
  if (value < 0) {
    throw new Error('Invalid value');
  }
  return true;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'throwAdded', 'Should detect throw addition');
    });
  });

  describe('throwRemoved', () => {
    test('detects throw removal', async () => {
      const baseCode = `
function validate(value: number) {
  if (value < 0) {
    throw new Error('Invalid value');
  }
  return true;
}
`;
      const modifiedCode = `
function validate(value: number) {
  if (value < 0) {
    return false;
  }
  return true;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'throwRemoved', 'Should detect throw removal');
    });
  });

  describe('tryCatchAdded', () => {
    test('detects try/catch addition', async () => {
      const baseCode = `
function risky() {
  JSON.parse('{a:1}');
}
`;
      const modifiedCode = `
function risky() {
  try {
    JSON.parse('{a:1}');
  } catch (e) {
    console.error(e);
  }
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
        (c) => c.kind === 'tryCatchAdded',
        'Should detect try/catch addition',
      );
    });
  });

  describe('tryCatchModified', () => {
    test('detects try/catch modification', async () => {
      const baseCode = `
function risky() {
  try {
    JSON.parse('{a:1}');
  } catch (e) {
    console.error(e);
  }
}
`;
      const modifiedCode = `
function risky() {
  try {
    JSON.parse('{a:1}');
  } catch (e) {
    // Do nothing
  }
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
        (c) => c.kind === 'tryCatchModified',
        'Should detect try/catch modification',
      );
    });
  });
});
