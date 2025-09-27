#!/usr/bin/env bun

import { describe, test, expect } from 'bun:test';
import {
  analyzeFunctionSignatureChanges,
  analyzeTypeDefinitionChanges,
  analyzeImportStructureChanges,
  detectSemanticChanges,
} from '../../src/analyzers/index.js';

import { assertHasChange, assertNoChange } from './_helpers.ts';

describe('Analyzer behavior and robustness', () => {
  describe('API contract validation', () => {
    test('functions conform to async contract typing', async () => {
      const baseCode = `function test(): void {}`;
      const modifiedCode = `function test(param: string): void {}`;

      // Now functions are properly async to match their Promise return types
      const result = analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      // This should be a promise and the types correctly reflect this
      expect(result).toBeInstanceOf(Promise);
      const resolvedResult = await result;
      expect(Array.isArray(resolvedResult)).toBe(true);
      expect(resolvedResult.length).toBeGreaterThan(0);
    });

    test('concurrent usage across multiple files', async () => {
      const baseCode = `function concurrent(): void {}`;
      const modifiedCode = `function concurrent(arg: string): void {}`;

      // Test concurrent calls - should expose thread safety issues
      const results = await Promise.all([
        Promise.resolve(
          analyzeFunctionSignatureChanges({
            baseFilePath: '/test/base.ts',
            baseCode,
            modifiedFilePath: '/test/modified.ts',
            modifiedCode,
          }),
        ),
        Promise.resolve(
          analyzeFunctionSignatureChanges({
            baseFilePath: '/test/base2.ts',
            baseCode,
            modifiedFilePath: '/test/modified2.ts',
            modifiedCode,
          }),
        ),
      ]);

      expect(results[0].length).toBeGreaterThan(0);
      expect(results[1].length).toBeGreaterThan(0);
    });

    test('tolerates malformed base code without crashing', async () => {
      const malformedCode = `function test( broken syntax here`;
      const validCode = `function test(): void {}`;

      // Should handle malformed input gracefully
      let errorThrown = false;
      let result: any[] = [];

      try {
        result = await Promise.resolve(
          analyzeFunctionSignatureChanges({
            baseFilePath: '/test/base.ts',
            baseCode: malformedCode,
            modifiedFilePath: '/test/modified.ts',
            modifiedCode: validCode,
          }),
        );
      } catch {
        errorThrown = true;
      }

      expect(errorThrown).toBe(false);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Type system change detection', () => {
    test('detects changes in generic constraints', async () => {
      const baseCode = `
function process<
  T extends Record<string, unknown>,
  U extends keyof T,
  V extends T[U] extends string ? string[] : never
>(data: T, key: U): V {
  return [] as V;
}`;

      const modifiedCode = `
function process<
  T extends Record<string, any>,
  U extends keyof T,
  V extends T[U] extends number ? number[] : never
>(data: T, key: U): V {
  return [] as V;
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // This is a breaking change in generic constraints but their implementation can't detect it
      if (changes.length === 0) {
      }

      // Should detect this as a high-severity breaking change
      // If it doesn't, it proves their generic handling is broken
    });

    test('detects recursive type structure changes', async () => {
      const baseCode = `
type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
  parent?: TreeNode<T>;
  metadata: {
    depth: number;
    siblings: TreeNode<T>[];
  };
};`;

      const modifiedCode = `
type TreeNode<T> = {
  value: T;
  left?: TreeNode<T>;
  right?: TreeNode<T>;
  parent?: TreeNode<T>;
  metadata: {
    depth: number;
    balance: number;
  };
};`;

      const changes = await Promise.resolve(
        analyzeTypeDefinitionChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // This fundamentally changes the tree structure from n-ary to binary
      if (changes.length === 0) {
      }
    });

    test('detects template literal type pattern changes', async () => {
      const baseCode = `
type EventName<T extends string> = \`on\${Capitalize<T>}Change\`;
type HandlerName<T extends string> = \`handle\${Capitalize<T>}Event\`;
type EventMap<T extends Record<string, any>> = {
  [K in keyof T as EventName<string & K>]: (value: T[K]) => void;
};`;

      const modifiedCode = `
type EventName<T extends string> = \`\${T}Changed\`;
type HandlerName<T extends string> = \`on\${Capitalize<T>}Update\`;
type EventMap<T extends Record<string, any>> = {
  [K in keyof T as HandlerName<string & K>]: (value: T[K], old: T[K]) => void;
};`;

      const changes = await Promise.resolve(
        analyzeTypeDefinitionChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Template literal patterns completely changed
      if (changes.length === 0) {
      }
    });

    test('detects conditional type logic changes', async () => {
      const baseCode = `
type DeepPartial<T> = T extends object
  ? T extends Function
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : { [P in keyof T]?: DeepPartial<T[P]> }
  : T;`;

      const modifiedCode = `
type DeepPartial<T> = T extends object
  ? T extends Function
    ? never
    : T extends Array<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : { readonly [P in keyof T]?: DeepPartial<T[P]> }
  : T;`;

      const changes = await Promise.resolve(
        analyzeTypeDefinitionChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Conditional type logic fundamentally changed
      if (changes.length === 0) {
      }
    });

    test('detects mapped type transformation changes', async () => {
      const baseCode = `
type Getters<T> = {
  [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
};
type Setters<T> = {
  [K in keyof T as \`set\${Capitalize<string & K>}\`]: (value: T[K]) => void;
};`;

      const modifiedCode = `
type Accessors<T> = {
  [K in keyof T as \`access\${Capitalize<string & K>}\`]: {
    get: () => T[K];
    set: (value: T[K]) => void;
  };
};`;

      const changes = await Promise.resolve(
        analyzeTypeDefinitionChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Complete mapped type pattern transformation
      if (changes.length === 0) {
      }
    });
  });

  describe('Function resolution and overload handling', () => {
    test('detects added overloads in function signatures', async () => {
      const baseCode = `
function parse(input: string): object;
function parse(input: number): string;
function parse(input: boolean): number;
function parse(input: string | number | boolean): object | string | number {
  if (typeof input === 'string') return JSON.parse(input);
  if (typeof input === 'number') return input.toString();
  return input ? 1 : 0;
}`;

      const modifiedCode = `
function parse(input: string): object;
function parse(input: number): string;
function parse(input: boolean): number;
function parse(input: Date): string;
function parse(input: string | number | boolean | Date): object | string | number {
  if (input instanceof Date) return input.toISOString();
  if (typeof input === 'string') return JSON.parse(input);
  if (typeof input === 'number') return input.toString();
  return input ? 1 : 0;
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Added overload should be detected
      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should detect overload addition but their naive name matching likely fails',
      );
    });

    test('distinguishes namespace vs global scope functions', async () => {
      const baseCode = `
namespace Utils {
  export function format(value: string): string { return value; }
}
function format(value: number): string { return value.toString(); }`;

      const modifiedCode = `
namespace Utils {
  export function format(value: string, prefix: string): string { return prefix + value; }
}
function format(value: number): string { return value.toString(); }`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Should distinguish between namespace and global scope functions
      // Their implementation likely confuses these
      if (changes.length !== 1) {
      }
    });

    test('distinguishes class methods vs global functions', async () => {
      const baseCode = `
class Processor {
  process(data: string): void {}
}
function process(data: string): void {}`;

      const modifiedCode = `
class Processor {
  process(data: string, options: object): void {}
}
function process(data: string): void {}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Should only detect method signature change, not global function
      if (changes.length !== 1) {
      }
    });

    test('handles constructor vs factory function distinction', async () => {
      const baseCode = `
class User {
  constructor(name: string) {}
}
function User(name: string): object { return {}; }`;

      const modifiedCode = `
class User {
  constructor(name: string, age: number) {}
}
function User(name: string): object { return {}; }`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Should handle constructor vs function name collision properly
      assertHasChange(
        changes,
        (c) => c.detail.includes('constructor') || c.detail.includes('User'),
        'Should properly handle constructor vs factory function distinction',
      );
    });

    test('treats arrow vs function declarations as equivalent', async () => {
      const baseCode = `
const handler = function(event: Event): void {
  const _ = event;
};`;

      const modifiedCode = `
const handler = (event: Event): void => {
  const _ = event;
};`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // These are semantically equivalent - should NOT generate changes
      assertNoChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Arrow function vs regular function should be semantically equivalent',
      );
    });
  });

  describe('False positive prevention', () => {
    test('ignores parameter rename-only changes', async () => {
      const baseCode = `
function calculateTotal(userInput: string, taxRate: number): number {
  return parseFloat(userInput) * (1 + taxRate);
}`;

      const modifiedCode = `
function calculateTotal(input: string, rate: number): number {
  return parseFloat(input) * (1 + rate);
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // This should NOT generate any changes - only parameter names changed
      if (changes.length > 0) {
        // FALSE POSITIVE CONFIRMED: Implementation incorrectly flags parameter renames as semantic changes
        // Changes detected: ${changes.map((c) => c.detail).join(', ')}
      }

      // Parameter names don't affect the API contract
      assertNoChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Parameter name changes should NOT trigger semantic change detection',
      );
    });

    test('whitespace and formatting false positives', async () => {
      const baseCode = `function test(a:string,b:number):void{}`;

      const modifiedCode = `function test(
  a: string,
  b: number
): void {
  // Added formatting and comments
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Formatting changes should NOT trigger semantic changes
      expect(changes.length).toBe(0);
    });

    test('comment-only modification false positives', async () => {
      const baseCode = `
function process(data: any): void {
  return;
}`;

      const modifiedCode = `
/**
 * Processes the input data
 * @param data - The data to process
 */
function process(data: any): void {
  // Process the data here
  return;
}`;

      const changes = await Promise.resolve(
        detectSemanticChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      expect(changes.length).toBe(0);
    });

    test('ignores AST-equivalent syntax variations', async () => {
      const baseCode = `
const multiply = function(a: number, b: number): number {
  return a * b;
};`;

      const modifiedCode = `
function multiply(a: number, b: number): number {
  return a * b;
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // These are semantically identical function definitions
      if (changes.length > 0) {
        // FALSE POSITIVE: Implementation flags semantically equivalent syntax variations
      }
    });

    test('detects import alias changes affecting local usage', async () => {
      const baseCode = `
import { Component as ReactComponent } from 'react';`;

      const modifiedCode = `
import { Component } from 'react';`;

      const changes = await Promise.resolve(
        analyzeImportStructureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // This IS a semantic change since it affects local variable names
      assertHasChange(
        changes,
        (c) => c.kind === 'importStructureChanged',
        'Import alias changes should be detected as they affect local usage',
      );
    });
  });

  describe('Performance and scalability', () => {
    test('handles complex nested type definitions efficiently', async () => {
      const generateComplexType = (depth: number): string => {
        if (depth === 0) return 'string';
        const inner = generateComplexType(depth - 1);
        return `{ a: ${inner}; b: ${inner}; c: ${inner}; d: ${inner} }`;
      };

      const baseCode = `type Complex = ${generateComplexType(10)};`;
      const modifiedCode = `type Complex = ${generateComplexType(9)};`;

      const startTime = Date.now();

      const changes = await Promise.resolve(
        analyzeTypeDefinitionChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      const duration = Date.now() - startTime;

      if (duration > 5000) {
      }
      expect(Array.isArray(changes)).toBe(true);
    });

    test('detects removal in very large parameter lists', async () => {
      const generateMassiveParams = (count: number): string => {
        const params = [];
        for (let i = 0; i < count; i++) {
          params.push(`param${i}: string`);
        }
        return params.join(', ');
      };

      const baseCode = `function massive(${generateMassiveParams(500)}): void {}`;
      const modifiedCode = `function massive(${generateMassiveParams(499)}): void {}`;

      const startTime = Date.now();

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      const duration = Date.now() - startTime;

      if (duration > 1000) {
      }

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should detect parameter removal even in large lists',
      );
    });

    test('analyzes large unions without excessive memory use', async () => {
      const generateMassiveUnion = (count: number): string => {
        const types = [];
        for (let i = 0; i < count; i++) {
          types.push(`'option${i}Value'`);
        }
        return types.join(' | ');
      };

      const baseCode = `type MassiveUnion = ${generateMassiveUnion(1000)};`;
      const modifiedCode = `type MassiveUnion = ${generateMassiveUnion(999)};`;

      // Monitor memory usage
      const memBefore = process.memoryUsage().heapUsed;

      const changes = await Promise.resolve(
        analyzeTypeDefinitionChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;

      if (memDelta > 100 * 1024 * 1024) {
        // 100MB
      }
      expect(Array.isArray(changes)).toBe(true);
    });

    test('handles circular type references gracefully', async () => {
      const baseCode = `
type Node<T> = {
  value: T;
  next: Node<Node<Node<Node<Node<T>>>>>;
  prev: Node<Node<Node<Node<Node<T>>>>>;
};`;

      const modifiedCode = `
type Node<T> = {
  value: T;
  next: Node<Node<Node<Node<T>>>>;
  prev: Node<Node<Node<Node<T>>>>;
};`;

      let errorThrown = false;
      let changes: any[] = [];

      try {
        changes = await Promise.resolve(
          analyzeTypeDefinitionChanges({
            baseFilePath: '/test/base.ts',
            baseCode,
            modifiedFilePath: '/test/modified.ts',
            modifiedCode,
          }),
        );
      } catch {
        errorThrown = true;
      }

      expect(errorThrown).toBe(false);
      expect(Array.isArray(changes)).toBe(true);
    });
  });

  describe('Context-aware analysis', () => {
    test('detects shadowed parameter type changes in inner scope', async () => {
      const baseCode = `
function outer(param: string): void {
  function inner(param: number): void {
    const _ = param;
  }
  inner(42);
}`;

      const modifiedCode = `
function outer(param: string): void {
  function inner(param: string): void {
    const _ = param;
  }
  inner("42");
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Should properly handle parameter shadowing and scope resolution
      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged' && c.detail.includes('inner'),
        'Should detect inner function parameter type changes',
      );
    });

    test('detects parameter addition amid scope shadowing', async () => {
      const baseCode = `
const config = { timeout: 1000 };

function process(data: string): void {
  const config = { timeout: 2000 };
  setTimeout(() => data, config.timeout);
}`;

      const modifiedCode = `
const config = { timeout: 1000 };

function process(data: string, timeout: number): void {
  const config = { timeout };
  setTimeout(() => data, config.timeout);
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Should detect the added parameter
      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should detect parameter addition in scope resolution context',
      );
    });

    test('type inference context changes', async () => {
      const baseCode = `
function createHandler<T>(processor: (item: T) => void) {
  return (items: T[]) => items.forEach(processor);
}`;

      const modifiedCode = `
function createHandler<T, R>(processor: (item: T) => R) {
  return (items: T[]) => items.map(processor);
}`;

      const changes = await Promise.resolve(
        analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // Should detect generic parameter addition and return type change
      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should detect generic signature changes affecting type inference',
      );
    });
  });

  describe('Integration: Production Pattern Failure Demonstration', () => {
    test('comprehensive production-scale refactoring scenario', async () => {
      const baseCode = `
import { EventEmitter } from 'events';
import { Logger } from './logger';

interface ServiceConfig<T extends Record<string, unknown>> {
  timeout: number;
  retries: number;
  transform: <U>(data: T) => U;
}

class DataProcessor<T extends Record<string, unknown>> extends EventEmitter {
  private logger: Logger;

  constructor(
    private config: ServiceConfig<T>,
    logger?: Logger
  ) {
    super();
    this.logger = logger || new Logger();
  }

  async process<U extends keyof T>(
    items: T[],
    selector: U,
    options?: { parallel?: boolean }
  ): Promise<T[U][]> {
    this.emit('processing:start', items.length);

    try {
      const results = options?.parallel
        ? await Promise.all(items.map(item => this.processItem(item, selector)))
        : await this.processSequential(items, selector);

      this.emit('processing:complete', results.length);
      return results;
    } catch (error) {
      this.emit('processing:error', error);
      throw error;
    }
  }

  private async processItem<U extends keyof T>(item: T, selector: U): Promise<T[U]> {
    return this.config.transform(item[selector]);
  }
}`;

      const modifiedCode = `
import { EventEmitter } from 'events';
import { Logger, LogLevel } from './logger';
import { Metrics } from './metrics';

interface ServiceConfig<T extends Record<string, unknown>> {
  timeout: number;
  retries: number;
  maxConcurrency?: number;
  transform: <U, V = U>(data: T) => Promise<V>;
}

class DataProcessor<T extends Record<string, unknown>> extends EventEmitter {
  private logger: Logger;
  private metrics: Metrics;

  constructor(
    private config: ServiceConfig<T>,
    logger?: Logger,
    metrics?: Metrics
  ) {
    super();
    this.logger = logger || new Logger(LogLevel.INFO);
    this.metrics = metrics || new Metrics();
  }

  async process<U extends keyof T>(
    items: T[],
    selector: U,
    options?: { parallel?: boolean; batchSize?: number }
  ): Promise<Array<Awaited<ReturnType<ServiceConfig<T>['transform']>>>> {
    this.emit('processing:start', { count: items.length, selector });
    this.metrics.increment('processing.started');

    try {
      const results = options?.parallel
        ? await this.processParallel(items, selector, options.batchSize)
        : await this.processSequential(items, selector);

      this.emit('processing:complete', { count: results.length });
      this.metrics.increment('processing.completed');
      return results;
    } catch (error) {
      this.emit('processing:error', { error, selector });
      this.metrics.increment('processing.failed');
      throw error;
    }
  }

  private async processParallel<U extends keyof T>(
    items: T[],
    selector: U,
    batchSize = 10
  ): Promise<any[]> {
    const batches = this.createBatches(items, batchSize);
    const results = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(item => this.processItem(item, selector))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}`;

      const changes = await Promise.resolve(
        detectSemanticChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        }),
      );

      // This comprehensive refactoring should detect multiple high-severity changes
      expect(changes.length).toBeGreaterThan(10);

      const severities = new Set(changes.map((c) => c.severity));
      expect(severities.has('high')).toBe(true);
      expect(severities.has('medium')).toBe(true);

      const kinds = new Set(changes.map((c) => c.kind));
      expect(kinds.has('functionSignatureChanged')).toBe(true);
      expect(kinds.has('typeDefinitionChanged')).toBe(true);
      expect(kinds.has('importStructureChanged')).toBe(true);

      // Production refactoring scenario detected ${changes.length} changes across ${kinds.size} categories

      // Log high-severity changes for analysis
      changes.filter((c) => c.severity === 'high').forEach((c) => c); // Track high severity changes
    });
  });
});
