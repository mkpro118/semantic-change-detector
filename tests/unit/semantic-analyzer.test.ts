#!/usr/bin/env bun

import { test, expect, describe } from 'bun:test';
import * as ts from 'typescript';
import {
  analyzeSemanticChanges,
  createSemanticContext,
  type AnalyzerConfig,
} from '../../src/index.js';

describe('Semantic Analysis Functions', () => {
  const config: AnalyzerConfig = {
    include: ['**/*.ts', '**/*.tsx'],
    exclude: ['node_modules/**'],
    sideEffectCallees: ['console.*', 'fetch'],
    testGlobs: ['**/*.test.*'],
    bypassLabels: [],
  };

  test('should detect function signature changes', () => {
    const baseCode = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const headCode = `
      function add(a: number, b: number, c: number): number {
        return a + b + c;
      }
    `;

    const baseSourceFile = ts.createSourceFile('test.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSourceFile = ts.createSourceFile('test.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
    const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(
      baseContext,
      headContext,
      [],
      baseCode,
      headCode,
      config,
    );

    expect(changes).toContainEqual(
      expect.objectContaining({
        kind: 'functionSignatureChanged',
        severity: 'high',
      }),
    );
  });

  test('should detect interface modifications', () => {
    const baseCode = `
      interface User {
        name: string;
        age: number;
      }
    `;

    const headCode = `
      interface User {
        name: string;
        age: number;
        email: string;
      }
    `;

    const baseSourceFile = ts.createSourceFile('test.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSourceFile = ts.createSourceFile('test.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
    const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(
      baseContext,
      headContext,
      [],
      baseCode,
      headCode,
      config,
    );

    expect(changes).toContainEqual(
      expect.objectContaining({
        kind: 'interfaceModified',
        severity: 'medium',
      }),
    );
  });

  test('should detect React hook additions', () => {
    const baseCode = `
      import React from 'react';

      function Component() {
        return <div>Hello</div>;
      }
    `;

    const headCode = `
      import React, { useState } from 'react';

      function Component() {
        const [count, setCount] = useState(0);
        return <div>Count: {count}</div>;
      }
    `;

    const baseSourceFile = ts.createSourceFile('test.tsx', baseCode, ts.ScriptTarget.Latest, true);
    const headSourceFile = ts.createSourceFile('test.tsx', headCode, ts.ScriptTarget.Latest, true);

    const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
    const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(
      baseContext,
      headContext,
      [],
      baseCode,
      headCode,
      config,
    );

    expect(changes).toContainEqual(
      expect.objectContaining({
        kind: 'hookAdded',
        severity: 'medium',
      }),
    );
  });

  test('should detect side effect calls', () => {
    const baseCode = `
      function processData() {
        return data.map(x => x * 2);
      }
    `;

    const headCode = `
      function processData() {
        console.log('Processing data');
        return data.map(x => x * 2);
      }
    `;

    const baseSourceFile = ts.createSourceFile('test.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSourceFile = ts.createSourceFile('test.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
    const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(
      baseContext,
      headContext,
      [],
      baseCode,
      headCode,
      config,
    );

    expect(changes).toContainEqual(
      expect.objectContaining({
        kind: 'functionCallAdded',
        severity: 'high',
      }),
    );
  });

  test('should detect export additions', () => {
    const baseCode = `
      function helper() {
        return 'helper';
      }
    `;

    const headCode = `
      export function helper() {
        return 'helper';
      }
    `;

    const baseSourceFile = ts.createSourceFile('test.ts', baseCode, ts.ScriptTarget.Latest, true);
    const headSourceFile = ts.createSourceFile('test.ts', headCode, ts.ScriptTarget.Latest, true);

    const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
    const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(
      baseContext,
      headContext,
      [],
      baseCode,
      headCode,
      config,
    );

    expect(changes).toContainEqual(
      expect.objectContaining({
        kind: 'exportAdded',
        severity: 'medium',
      }),
    );
  });

  test('should ignore trivial inline event handlers', () => {
    const baseCode = `
      import React from 'react';

      function Component() {
        return <button>Click me</button>;
      }
    `;

    const headCode = `
      import React from 'react';

      function Component() {
        return <button onClick={() => {}}>Click me</button>;
      }
    `;

    const baseSourceFile = ts.createSourceFile('test.tsx', baseCode, ts.ScriptTarget.Latest, true);
    const headSourceFile = ts.createSourceFile('test.tsx', headCode, ts.ScriptTarget.Latest, true);

    const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
    const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(
      baseContext,
      headContext,
      [],
      baseCode,
      headCode,
      config,
    );

    // Should not detect trivial event handlers
    expect(changes.filter((c) => c.kind === 'eventHandlerChanged')).toHaveLength(0);
  });

  test('should detect complex event handlers', () => {
    const baseCode = `
      import React from 'react';

      function Component() {
        return <button>Click me</button>;
      }
    `;

    const headCode = `
      import React from 'react';

      function Component() {
        return <button onClick={() => {
          // clicked
          if (condition) {
            doSomething();
          }
        }}>Click me</button>;
      }
    `;

    const baseSourceFile = ts.createSourceFile('test.tsx', baseCode, ts.ScriptTarget.Latest, true);
    const headSourceFile = ts.createSourceFile('test.tsx', headCode, ts.ScriptTarget.Latest, true);

    const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
    const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

    const changes = analyzeSemanticChanges(
      baseContext,
      headContext,
      [],
      baseCode,
      headCode,
      config,
    );

    // Should detect complex event handlers
    expect(changes).toContainEqual(
      expect.objectContaining({
        kind: 'eventHandlerChanged',
        severity: expect.stringMatching(/medium|high/),
      }),
    );
  });

  test('createSemanticContext should extract function information', () => {
    const code = `
      function calculateSum(a: number, b: number): number {
        return a + b;
      }

      const multiply = (x: number, y: number) => x * y;
    `;

    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
    const context = createSemanticContext(sourceFile, []);

    expect(context.functions).toHaveLength(1); // Only function declarations
    expect(context.functions[0]).toEqual(
      expect.objectContaining({
        name: 'calculateSum',
        returnType: 'number',
        isAsync: false,
      }),
    );
  });

  test('createSemanticContext should extract interface information', () => {
    const code = `
      interface UserProfile {
        id: string;
        name: string;
        email?: string;
        isActive: boolean;
      }
    `;

    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
    const context = createSemanticContext(sourceFile, []);

    expect(context.interfaces).toHaveLength(1);
    expect(context.interfaces[0]).toEqual(
      expect.objectContaining({
        name: 'UserProfile',
        properties: expect.arrayContaining([
          expect.objectContaining({ name: 'id', type: 'string', optional: false }),
          expect.objectContaining({ name: 'email', optional: true }),
        ]),
      }),
    );
  });

  test('createSemanticContext should detect React hooks', () => {
    const code = `
      import React, { useState, useEffect } from 'react';

      function Component() {
        const [count, setCount] = useState(0);

        useEffect(() => {
          document.title = 'Count: ' + count;
        }, [count]);

        return <div>{count}</div>;
      }
    `;

    const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
    const context = createSemanticContext(sourceFile, []);

    expect(context.reactHooks).toHaveLength(2);
    expect(context.reactHooks).toContainEqual(
      expect.objectContaining({
        name: 'useState',
        type: 'useState',
      }),
    );
    expect(context.reactHooks).toContainEqual(
      expect.objectContaining({
        name: 'useEffect',
        type: 'useEffect',
        dependencies: ['count'],
      }),
    );
  });
});
