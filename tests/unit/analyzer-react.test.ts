#!/usr/bin/env bun

import { describe, test } from 'bun:test';
import { detectSemanticChanges } from '../../src/analyzers/index.js';
import { assertHasChange } from './_helpers.ts';

describe('React Analyzers', () => {
  describe('componentStructureChanged', () => {
    test('detects component structure change', async () => {
      const baseCode = `
import React from 'react';

function MyComponent() {
  return (
    <div>
      <h1>Title</h1>
      <p>Paragraph</p>
    </div>
  );
}
`;
      const modifiedCode = `
import React from 'react';

function MyComponent() {
  return (
    <section>
      <h1>Title</h1>
      <p>Paragraph</p>
    </section>
  );
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'componentStructureChanged',
        'Should detect component structure change',
      );
    });
  });

  describe('effectAdded', () => {
    test('detects effect addition', async () => {
      const baseCode = `
import React from 'react';

function MyComponent() {
  return <div>Hello</div>;
}
`;
      const modifiedCode = `
import React, { useEffect } from 'react';

function MyComponent() {
  useEffect(() => {
    console.log('Mounted');
  }, []);
  return <div>Hello</div>;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'effectAdded', 'Should detect effect addition');
    });
  });

  describe('effectRemoved', () => {
    test('detects effect removal', async () => {
      const baseCode = `
import React, { useEffect } from 'react';

function MyComponent() {
  useEffect(() => {
    console.log('Mounted');
  }, []);
  return <div>Hello</div>;
}
`;
      const modifiedCode = `
import React from 'react';

function MyComponent() {
  return <div>Hello</div>;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'effectRemoved', 'Should detect effect removal');
    });
  });

  describe('functionCallModified', () => {
    test('detects function call modification', async () => {
      const baseCode = `
function myFunc(a: number) {}
myFunc(1);
`;
      const modifiedCode = `
function myFunc(a: number) {}
myFunc(2);
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallModified',
        'Should detect function call modification',
      );
    });
  });

  describe('hookRemoved', () => {
    test('detects hook removal', async () => {
      const baseCode = `
import React, { useState } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
`;
      const modifiedCode = `
import React from 'react';

function MyComponent() {
  return <div>Hello</div>;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(changes, (c) => c.kind === 'hookRemoved', 'Should detect hook removal');
    });
  });

  describe('jsxElementRemoved', () => {
    test('detects jsx element removal', async () => {
      const baseCode = `
import React from 'react';

function MyComponent() {
  return (
    <div>
      <h1>Title</h1>
      <p>Paragraph</p>
    </div>
  );
}
`;
      const modifiedCode = `
import React from 'react';

function MyComponent() {
  return (
    <div>
      <h1>Title</h1>
    </div>
  );
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'jsxElementRemoved',
        'Should detect jsx element removal',
      );
    });
  });

  describe('jsxPropsChanged', () => {
    test('detects jsx props change', async () => {
      const baseCode = `
import React from 'react';

function MyComponent() {
  return <div className="red">Hello</div>;
}
`;
      const modifiedCode = `
import React from 'react';

function MyComponent() {
  return <div className="blue">Hello</div>;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'jsxPropsChanged',
        'Should detect jsx props change',
      );
    });
  });

  describe('stateManagementChanged', () => {
    test('detects state management change', async () => {
      const baseCode = `
import React, { useState } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
`;
      const modifiedCode = `
import React, { useReducer } from 'react';

const reducer = (state, action) => state + 1;

function MyComponent() {
  const [count, dispatch] = useReducer(reducer, 0);
  return <button onClick={() => dispatch()}>{count}</button>;
}
`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.tsx',
        baseCode,
        modifiedFilePath: '/test/modified.tsx',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'stateManagementChanged',
        'Should detect state management change',
      );
    });
  });
});
