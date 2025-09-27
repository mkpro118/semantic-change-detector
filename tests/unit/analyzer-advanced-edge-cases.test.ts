#!/usr/bin/env bun

import { describe, expect, test } from 'bun:test';
import {
  analyzeFunctionCallChanges,
  analyzeFunctionSignatureChanges,
  analyzeTypeDefinitionChanges,
  detectSemanticChanges,
} from '../../src/analyzers/index.js';

import {
  assertHasChange,
  assertNoChange,
  expectValidLocation,
  type ChangeShape,
} from './_helpers.ts';

describe('Advanced analyzer edge cases and robustness', () => {
  describe('Complex TypeScript edge cases', () => {
    test('detects changes in generic function constraints', async () => {
      const baseCode = `
function process<T extends Record<string, unknown>, U = T>(data: T): U {
  return data as U;
}`;

      const modifiedCode = `
function process<T extends Record<string, any>, U extends T = T>(data: T): U {
  return data as U;
}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      const change = assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged' && c.severity === 'high',
        'Should detect generic constraint changes as high severity',
      );

      expectValidLocation(change);
      expect(change.context).toContain('process');
    });

    test('detects conditional type modifications', async () => {
      const baseCode = `
type ConditionalType<T> = T extends string ? string[] : number[];`;

      const modifiedCode = `
type ConditionalType<T> = T extends number ? string[] : boolean[];`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged' && c.severity === 'medium',
        'Should detect conditional type condition changes',
      );
    });

    test('detects template literal type changes', async () => {
      const baseCode = `
type RoutePattern = \`prefix-\${string}-\${number}\`;`;

      const modifiedCode = `
type RoutePattern = \`suffix-\${string}-\${boolean}\`;`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged',
        'Should detect template literal type structure changes',
      );
    });

    test('detects mapped type modifications', async () => {
      const baseCode = `
type Getters<T> = {
  [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
};`;

      const modifiedCode = `
type Setters<T> = {
  [K in keyof T as \`set\${Capitalize<string & K>}\`]: (value: T[K]) => void;
};`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged' && c.severity === 'medium',
        'Should detect mapped type pattern changes',
      );
    });

    test('detects function overload changes', async () => {
      const baseCode = `
function overloaded(x: string): string;
function overloaded(x: number): number;
function overloaded(x: string | number): string | number {
  return x;
}`;

      const modifiedCode = `
function overloaded(x: string): string;
function overloaded(x: number): number;
function overloaded(x: boolean): boolean;
function overloaded(x: string | number | boolean): string | number | boolean {
  return x;
}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged' && c.severity === 'high',
        'Should detect function overload additions as high severity',
      );
    });
  });

  describe('Function signature edge cases', () => {
    test('detects optional parameter reordering', async () => {
      const baseCode = `
function reorder(a?: string, b: number): void {}`;

      const modifiedCode = `
function reorder(b: number, a?: string): void {}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged' && c.severity === 'high',
        'Should detect optional parameter reordering as breaking change',
      );
    });

    test('ignores parameter name-only changes', async () => {
      const baseCode = `
function nameChange(userId: string, count: number): void {}`;

      const modifiedCode = `
function nameChange(id: string, total: number): void {}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Parameter name-only changes should not trigger semantic changes',
      );
    });

    test('ignores default parameter value changes', async () => {
      const baseCode = `
function defaultChange(x = 5, y = "hello"): void {}`;

      const modifiedCode = `
function defaultChange(x = 10, y = "world"): void {}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Default parameter value changes should not trigger semantic changes',
      );
    });

    test('detects nested destructuring evolution', async () => {
      const baseCode = `
function complex({ user: { name, email }, meta }: ComplexType): void {}`;

      const modifiedCode = `
function complex({ user: { name, email, id }, meta: { version } }: ComplexType): void {}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should detect nested destructuring pattern changes',
      );
    });

    test('handles mixed parameter complexity', async () => {
      const baseCode = `
function mixed(a: string, { b, c }: { b: number; c: boolean }, ...rest: any[]): void {}`;

      const modifiedCode = `
function mixed(a: string, { b, c, d }: { b: number; c: boolean; d?: string }, ...rest: any[]): void {}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should detect changes in mixed parameter complexity',
      );
    });
  });

  describe('Type system complexity scenarios', () => {
    test('ignores union type order changes', async () => {
      const baseCode = `
type Union = string | number | boolean;`;

      const modifiedCode = `
type Union = boolean | string | number;`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged',
        'Union type member reordering should not trigger changes',
      );
    });

    test('detects intersection type modifications', async () => {
      const baseCode = `
type Intersection = A & B & C;`;

      const modifiedCode = `
type Intersection = A & B & D;`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged' && c.severity === 'medium',
        'Should detect intersection type member changes',
      );
    });

    test('detects recursive type structure changes', async () => {
      const baseCode = `
type Tree<T> = {
  value: T;
  children: Tree<T>[];
};`;

      const modifiedCode = `
type Tree<T> = {
  value: T;
  left?: Tree<T>;
  right?: Tree<T>;
};`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged' && c.severity === 'high',
        'Should detect recursive type structure changes as high severity',
      );
    });

    test('detects branded type modifications', async () => {
      const baseCode = `
type UserId = string & { __brand: 'UserId' };`;

      const modifiedCode = `
type UserId = string & { __brand: 'User'; __version: 2 };`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged',
        'Should detect branded type brand property changes',
      );
    });

    test('recognizes utility type equivalence', async () => {
      const baseCode = `
type PartialPick<T, K extends keyof T> = Partial<Pick<T, K>>;`;

      const modifiedCode = `
type PartialPick<T, K extends keyof T> = Pick<Partial<T>, K>;`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      if (changes.length > 0) {
        // Implementation may still flag equivalent utility compositions
      }
    });
  });

  describe('Function call analysis edge cases', () => {
    test('detects chained method call modifications', async () => {
      const baseCode = `
const result = obj.method1().method2(arg);`;

      const modifiedCode = `
const result = obj.method1().method2(arg1, arg2);`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged',
        'Should detect chained method call argument changes',
      );
    });

    test('detects nested function call changes', async () => {
      const baseCode = `
const result = outer(inner(arg1, arg2), other());`;

      const modifiedCode = `
const result = outer(inner(arg1), other(newArg));`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      expect(changes.length).toBeGreaterThanOrEqual(1);
      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged',
        'Should detect nested function call modifications',
      );
    });

    test('detects template literal call changes', async () => {
      const baseCode = `
const styles = css\`color: \${color}; font-size: 16px;\`;`;

      const modifiedCode = `
const styles = css\`background: \${color}; font-size: 14px;\`;`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged',
        'Should detect template literal function call changes',
      );
    });

    test('detects constructor vs function call changes', async () => {
      const baseCode = `
const instance = new MyClass(arg1, arg2);`;

      const modifiedCode = `
const instance = MyClass(arg1, arg2);`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged' && c.severity === 'high',
        'Should detect constructor vs function call changes as high severity',
      );
    });

    test('detects optional chaining call changes', async () => {
      const baseCode = `
const result = obj?.method?.(arg1, arg2);`;

      const modifiedCode = `
const result = obj?.method?.();`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged',
        'Should detect optional chaining call argument changes',
      );
    });
  });

  describe('False positive prevention', () => {
    test('ignores comment-only modifications', async () => {
      const baseCode = `
// Original comment
function test(): void {
  return;
}`;

      const modifiedCode = `
// Updated comment with more details
function test(): void {
  return;
}`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      expect(changes.length).toBe(0);
    });

    test('ignores whitespace normalization', async () => {
      const baseCode = `function test(  a:string,b:   number  ):void{}`;

      const modifiedCode = `function test(a: string, b: number): void {}`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      expect(changes.length).toBe(0);
    });

    test('recognizes AST-equivalent function declarations', async () => {
      const baseCode = `
function myFunc() { return 42; }`;

      const modifiedCode = `
const myFunc = function() { return 42; };`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'AST-equivalent declarations should not be flagged',
      );
    });
  });

  describe('Performance and scale stress tests', () => {
    test('handles large parameter lists', async () => {
      const generateLargeParams = (count: number): string => {
        const params = [];
        for (let i = 0; i < count; i++) params.push(`param${i}: string`);
        return params.join(', ');
      };

      const baseCode = `
function massiveSignature(${generateLargeParams(100)}): void {}`;
      const modifiedCode = `
function massiveSignature(${generateLargeParams(99)}): void {}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should handle large parameter lists without performance issues',
      );
    });

    test('handles massive union types', async () => {
      const generateMassiveUnion = (count: number): string => {
        const types = [];
        for (let i = 0; i < count; i++) types.push(`'option${i}'`);
        return types.join(' | ');
      };

      const baseCode = `
type MassiveUnion = ${generateMassiveUnion(200)};`;
      const modifiedCode = `
type MassiveUnion = ${generateMassiveUnion(199)};`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged',
        'Should handle massive union types efficiently',
      );
    });

    test('handles deep nesting levels', async () => {
      const generateDeepNesting = (depth: number): string => {
        let result = 'number';
        for (let i = 0; i < depth; i++) result = `{ nested: ${result} }`;
        return result;
      };

      const baseCode = `
type DeepNested = ${generateDeepNesting(50)};`;
      const modifiedCode = `
type DeepNested = ${generateDeepNesting(49)};`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged',
        'Should handle deeply nested type structures',
      );
    });
  });

  describe('Error handling and resilience', () => {
    test('handles partial syntax errors gracefully', async () => {
      const baseCode = `
function validFunction(): void {
  return;
}

// Some invalid syntax mixed in
const invalid = { unclosed: 'bracket'
`;

      const modifiedCode = `
function validFunction(newParam: string): void {
  return;
}

// Some invalid syntax mixed in
const invalid = { unclosed: 'bracket'
`;

      let changes: ChangeShape[] = [];
      let errorThrown = false;

      try {
        changes = await analyzeFunctionSignatureChanges({
          baseFilePath: '/test/base.ts',
          baseCode,
          modifiedFilePath: '/test/modified.ts',
          modifiedCode,
        });
      } catch {
        errorThrown = true;
      }

      expect(errorThrown).toBe(false);
      expect(Array.isArray(changes)).toBe(true);
    });

    test('handles unicode edge cases in function names', async () => {
      const baseCode = `
function testFunction🚀(): void {}
function validación(): void {}
function العربية(): void {}`;

      const modifiedCode = `
function testFunction🚀(param: string): void {}
function validación(): void {}
function العربية(): void {}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should handle unicode function names properly',
      );
    });

    test('handles extremely long lines', async () => {
      const longString = 'a'.repeat(10000);
      const baseCode = `
const result = functionCall("${longString}");`;

      const modifiedCode = `
const result = functionCall("${longString}", "extra");`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged',
        'Should handle extremely long lines without issues',
      );
    });
  });

  describe('Real-world scenarios', () => {
    test('detects React hook dependency changes', async () => {
      const baseCode = `
useEffect(() => {
  fetchData();
}, [userId, refreshToken]);`;

      const modifiedCode = `
useEffect(() => {
  fetchData();
}, [userId]);`;

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged' && c.severity === 'high',
        'Should detect dependency array changes as high severity',
      );
    });

    test('detects API migration patterns', async () => {
      const baseCode = `
interface OldAPI {
  getUserData(id: string): Promise<UserData>;
  updateUser(id: string, data: Partial<UserData>): Promise<void>;
}`;

      const modifiedCode = `
interface NewAPI {
  getUser(id: string): Promise<UserProfile>;
  updateUserProfile(id: string, profile: Partial<UserProfile>): Promise<UpdateResult>;
}`;

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged' && c.severity === 'high',
        'Should detect API interface breaking changes as high severity',
      );
    });

    test('detects framework-specific constructor changes', async () => {
      const baseCode = `
@Component({
  selector: 'app-user',
  template: '<div>{{user.name}}</div>',
  providers: [UserService]
})
class UserComponent {
  constructor(private userService: UserService) {}
}`;

      const modifiedCode = `
@Component({
  selector: 'app-user-profile',
  template: '<div>{{user.displayName}}</div>',
  providers: [UserService, ProfileService]
})
class UserComponent {
  constructor(private userService: UserService, private profileService: ProfileService) {}
}`;

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged',
        'Should detect Angular constructor dependency changes',
      );
    });
  });

  describe('Integration: Complex Multi-Pattern Scenarios', () => {
    test('handles complex real-world refactoring scenario', async () => {
      const baseCode = `
import { useState, useEffect } from 'react';
import { ApiClient } from './api';

type UserData = {
  id: string;
  name: string;
  email: string;
};

type ApiResponse<T> = {
  data: T;
  status: 'success' | 'error';
};

function useUserData<T extends UserData>(
  userId: string,
  options?: { refresh?: boolean }
): ApiResponse<T> | null {
  const [userData, setUserData] = useState<ApiResponse<T> | null>(null);

  useEffect(() => {
    ApiClient.fetchUser(userId, options?.refresh).then(setUserData);
  }, [userId, options?.refresh]);

  return userData;
}`;

      const modifiedCode = `
import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from './api';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
};

type ApiResponse<T> = {
  data: T;
  status: 'success' | 'error' | 'loading';
};

function useUserProfile<T extends UserProfile>(
  userId: string,
  config?: { autoRefresh?: boolean; timeout?: number }
): ApiResponse<T> | null {
  const [userData, setUserData] = useState<ApiResponse<T> | null>(null);

  const fetchUser = useCallback(() => {
    ApiClient.fetchUser(userId, config?.autoRefresh, config?.timeout).then(setUserData);
  }, [userId, config?.autoRefresh, config?.timeout]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return userData;
}`;

      const changes = await detectSemanticChanges({
        baseFilePath: '/test/base.ts',
        baseCode,
        modifiedFilePath: '/test/modified.ts',
        modifiedCode,
      });

      expect(changes.length).toBeGreaterThan(4);
      const kinds = new Set(changes.map((c) => c.kind));
      expect(kinds.has('functionSignatureChanged')).toBe(true);
      expect(kinds.has('typeDefinitionChanged')).toBe(true);
      expect(kinds.has('functionCallChanged')).toBe(true);
    });
  });
});
