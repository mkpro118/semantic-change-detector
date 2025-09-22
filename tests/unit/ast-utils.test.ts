import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';
import {
  calculateCyclomaticComplexity,
  extractHookDependencies,
  findNodeByPosition,
  getFunctionSignature,
  getNodeKind,
  getNodeText,
  getParameterSignature,
  getVisibilityModifier,
  isAlphaConversion,
  isReactHook,
  isSideEffectCall,
  normalizeWhitespace,
} from '../../src/utils/ast-utils.js';

function createSourceFile(content: string): ts.SourceFile {
  return ts.createSourceFile('test.ts', content, ts.ScriptTarget.Latest, true);
}

describe('AST Utils', () => {
  describe('getNodeText', () => {
    test('extracts text from node', () => {
      const sourceFile = createSourceFile('function test() { return 42; }');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const text = getNodeText(functionNode, sourceFile);
      expect(text).toBe('function test() { return 42; }');
    });

    test('trims whitespace from extracted text', () => {
      const sourceFile = createSourceFile('  function test() {}  ');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const text = getNodeText(functionNode, sourceFile);
      expect(text).toBe('function test() {}');
    });
  });

  describe('getNodeKind', () => {
    test('returns correct kind for function declaration', () => {
      const sourceFile = createSourceFile('function test() {}');
      const functionNode = sourceFile.statements[0];
      expect(getNodeKind(functionNode)).toBe('FunctionDeclaration');
    });

    test('returns correct kind for variable statement', () => {
      const sourceFile = createSourceFile('const x = 42;');
      const variableNode = sourceFile.statements[0];
      expect(getNodeKind(variableNode)).toBe('FirstStatement');
    });
  });

  describe('findNodeByPosition', () => {
    test('finds function node by position', () => {
      const sourceFile = createSourceFile('function test() { return 42; }');
      const node = findNodeByPosition(sourceFile, 0, 5); // Position inside 'function' keyword
      expect(node).toBeDefined();
      // Should find the most specific node at that position
    });

    test('finds more specific child node', () => {
      const sourceFile = createSourceFile('function test() { return 42; }');
      // Position inside the function body
      const node = findNodeByPosition(sourceFile, 0, 20);
      expect(node).toBeDefined();
      // Should find a more specific node inside the function
    });

    test('returns undefined for invalid position', () => {
      const sourceFile = createSourceFile('function test() {}');
      const node = findNodeByPosition(sourceFile, 10, 10); // Way out of bounds
      expect(node).toBeUndefined();
    });

    test('handles edge case where column is before start', () => {
      const sourceFile = createSourceFile('function test() {}');
      const node = findNodeByPosition(sourceFile, 0, -1);
      expect(node).toBeUndefined();
    });

    test('handles edge case where column is after end', () => {
      const sourceFile = createSourceFile('function test() {}');
      const node = findNodeByPosition(sourceFile, 0, 1000);
      expect(node).toBeUndefined();
    });
  });

  describe('calculateCyclomaticComplexity', () => {
    test('calculates base complexity for simple function', () => {
      const sourceFile = createSourceFile('function test() { return 42; }');
      const functionNode = sourceFile.statements[0];
      const complexity = calculateCyclomaticComplexity(functionNode);
      expect(complexity).toBe(1); // Base complexity
    });

    test('calculates complexity with if statement', () => {
      const sourceFile = createSourceFile(`
        function test(x) {
          if (x > 0) {
            return x;
          }
          return 0;
        }
      `);
      const functionNode = sourceFile.statements[0];
      const complexity = calculateCyclomaticComplexity(functionNode);
      expect(complexity).toBe(2); // Base + if
    });

    test('calculates complexity with loops', () => {
      const sourceFile = createSourceFile(`
        function test() {
          while (true) {}
          for (let i = 0; i < 10; i++) {}
          do {} while (false);
        }
      `);
      const functionNode = sourceFile.statements[0];
      const complexity = calculateCyclomaticComplexity(functionNode);
      expect(complexity).toBe(4); // Base + while + for + do-while
    });

    test('calculates complexity with logical operators', () => {
      const sourceFile = createSourceFile(`
        function test(a, b, c) {
          return a && b || c;
        }
      `);
      const functionNode = sourceFile.statements[0];
      const complexity = calculateCyclomaticComplexity(functionNode);
      expect(complexity).toBe(3); // Base + && + ||
    });

    test('calculates complexity with switch statement', () => {
      const sourceFile = createSourceFile(`
        function test(x) {
          switch (x) {
            case 1:
              return 'one';
            case 2:
              return 'two';
            default:
              return 'other';
          }
        }
      `);
      const functionNode = sourceFile.statements[0];
      const complexity = calculateCyclomaticComplexity(functionNode);
      expect(complexity).toBe(3); // Base + 2 case clauses (default doesn't count)
    });

    test('calculates complexity with try-catch', () => {
      const sourceFile = createSourceFile(`
        function test() {
          try {
            throw new Error();
          } catch (e) {
            console.log(e);
          }
        }
      `);
      const functionNode = sourceFile.statements[0];
      const complexity = calculateCyclomaticComplexity(functionNode);
      expect(complexity).toBe(2); // Base + catch
    });

    test('calculates complexity with conditional expression', () => {
      const sourceFile = createSourceFile(`
        function test(x) {
          return x > 0 ? 'positive' : 'non-positive';
        }
      `);
      const functionNode = sourceFile.statements[0];
      const complexity = calculateCyclomaticComplexity(functionNode);
      expect(complexity).toBe(2); // Base + ternary
    });
  });

  describe('isReactHook', () => {
    test('identifies valid React hooks', () => {
      expect(isReactHook('useState')).toBe(true);
      expect(isReactHook('useEffect')).toBe(true);
      expect(isReactHook('useCustomHook')).toBe(true);
    });

    test('rejects invalid hook names', () => {
      expect(isReactHook('use')).toBe(false); // Too short
      expect(isReactHook('user')).toBe(false); // Doesn't start with 'use' + capital
      expect(isReactHook('useState1')).toBe(true); // This actually passes the regex test
      expect(isReactHook('notAHook')).toBe(false); // Doesn't start with 'use'
      expect(isReactHook('usename')).toBe(false); // No capital letter after 'use'
    });
  });

  describe('extractHookDependencies', () => {
    test('extracts dependencies from hook call', () => {
      const sourceFile = createSourceFile('useEffect(() => {}, [a, b, c])');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const deps = extractHookDependencies(callExpr);
      expect(deps).toEqual(['a', 'b', 'c']);
    });

    test('returns empty array for hook without dependencies', () => {
      const sourceFile = createSourceFile('useEffect(() => {})');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const deps = extractHookDependencies(callExpr);
      expect(deps).toEqual([]);
    });

    test('returns empty array for non-array dependencies', () => {
      const sourceFile = createSourceFile('useEffect(() => {}, deps)');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const deps = extractHookDependencies(callExpr);
      expect(deps).toEqual([]);
    });

    test('filters out non-identifier elements', () => {
      const sourceFile = createSourceFile('useEffect(() => {}, [a, "string", 42, b])');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const deps = extractHookDependencies(callExpr);
      expect(deps).toEqual(['a', 'b']); // Only identifiers
    });
  });

  describe('isSideEffectCall', () => {
    test('identifies console calls', () => {
      const sourceFile = createSourceFile('console.log("test")');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const isSideEffect = isSideEffectCall(callExpr, ['console.*']);
      expect(isSideEffect).toBe(true);
    });

    test('identifies simple function calls', () => {
      const sourceFile = createSourceFile('fetch("/api/data")');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const isSideEffect = isSideEffectCall(callExpr, ['fetch']);
      expect(isSideEffect).toBe(true);
    });

    test('identifies nested property access', () => {
      const sourceFile = createSourceFile('api.user.create(data)');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const isSideEffect = isSideEffectCall(callExpr, ['api.*']);
      expect(isSideEffect).toBe(true);
    });

    test('handles element access expressions', () => {
      const sourceFile = createSourceFile('obj["method"]()');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const isSideEffect = isSideEffectCall(callExpr, ['obj.*']);
      expect(isSideEffect).toBe(true);
    });

    test('returns false for non-matching calls', () => {
      const sourceFile = createSourceFile('normalFunction()');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const isSideEffect = isSideEffectCall(callExpr, ['console.*', 'fetch']);
      expect(isSideEffect).toBe(false);
    });

    test('handles complex expression paths', () => {
      const sourceFile = createSourceFile('this.state.api.call()');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const isSideEffect = isSideEffectCall(callExpr, ['*.api.*']);
      expect(isSideEffect).toBe(true);
    });

    test('returns false for invalid expression types', () => {
      const sourceFile = createSourceFile('(function(){})()');
      const callExpr = (sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;
      const isSideEffect = isSideEffectCall(callExpr, ['*']);
      expect(isSideEffect).toBe(false);
    });
  });

  describe('getParameterSignature', () => {
    test('gets parameter signature with type', () => {
      const sourceFile = createSourceFile('function test(x: number) {}');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const param = functionNode.parameters[0] as ts.ParameterDeclaration;
      const signature = getParameterSignature(param);

      expect(signature.name).toBe('x');
      expect(signature.type).toBe('number');
      expect(signature.optional).toBe(false);
    });

    test('gets optional parameter signature', () => {
      const sourceFile = createSourceFile('function test(x?: string) {}');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const param = functionNode.parameters[0] as ts.ParameterDeclaration;
      const signature = getParameterSignature(param);

      expect(signature.name).toBe('x');
      expect(signature.type).toBe('string');
      expect(signature.optional).toBe(true);
    });

    test('defaults to any type when no type annotation', () => {
      const sourceFile = createSourceFile('function test(x) {}');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const param = functionNode.parameters[0] as ts.ParameterDeclaration;
      const signature = getParameterSignature(param);

      expect(signature.name).toBe('x');
      expect(signature.type).toBe('any');
      expect(signature.optional).toBe(false);
    });
  });

  describe('getFunctionSignature', () => {
    test('gets signature for named function', () => {
      const sourceFile = createSourceFile('function test(x: number): string { return ""; }');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const signature = getFunctionSignature(functionNode);

      expect(signature).toBe('test(x: number): string');
    });

    test('gets signature for async function', () => {
      const sourceFile = createSourceFile('async function test(): Promise<void> {}');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const signature = getFunctionSignature(functionNode);

      expect(signature).toBe('async test(): Promise<void>');
    });

    test('gets signature for function with optional parameters', () => {
      const sourceFile = createSourceFile('function test(x: number, y?: string): void {}');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const signature = getFunctionSignature(functionNode);

      expect(signature).toBe('test(x: number, y?: string): void');
    });

    test('handles anonymous function', () => {
      const sourceFile = createSourceFile('const fn = function(x: number) {};');
      const variableDecl = sourceFile.statements[0] as ts.VariableStatement;
      const functionNode = (variableDecl.declarationList.declarations[0] as ts.VariableDeclaration)
        .initializer as ts.FunctionExpression;
      const signature = getFunctionSignature(functionNode);

      expect(signature).toBe('anonymous(x: number): any');
    });

    test('defaults to any return type when no annotation', () => {
      const sourceFile = createSourceFile('function test() {}');
      const functionNode = sourceFile.statements[0] as ts.FunctionDeclaration;
      const signature = getFunctionSignature(functionNode);

      expect(signature).toBe('test(): any');
    });
  });

  describe('isAlphaConversion', () => {
    test('identifies alpha conversion', () => {
      const isAlpha = isAlphaConversion('oldName', 'newName', 'oldName newName');
      expect(isAlpha).toBe(true);
    });

    test('rejects non-alpha conversion with different frequencies', () => {
      const isAlpha = isAlphaConversion('x', 'y', 'function test(x) { return x + x + y; }');
      expect(isAlpha).toBe(false); // x appears twice, y appears once
    });

    test('handles missing names gracefully', () => {
      const isAlpha = isAlphaConversion('missing', 'alsoMissing', 'function test() { return 42; }');
      expect(isAlpha).toBe(false);
    });
  });

  describe('normalizeWhitespace', () => {
    test('normalizes multiple spaces', () => {
      const result = normalizeWhitespace('hello    world');
      expect(result).toBe('hello world');
    });

    test('normalizes tabs and newlines', () => {
      const result = normalizeWhitespace('hello\t\nworld');
      expect(result).toBe('hello world');
    });

    test('trims leading and trailing whitespace', () => {
      const result = normalizeWhitespace('  hello world  ');
      expect(result).toBe('hello world');
    });

    test('handles empty string', () => {
      const result = normalizeWhitespace('');
      expect(result).toBe('');
    });

    test('handles string with only whitespace', () => {
      const result = normalizeWhitespace('   \t\n  ');
      expect(result).toBe('');
    });
  });

  describe('getVisibilityModifier', () => {
    test('identifies private modifier', () => {
      const sourceFile = createSourceFile('class Test { private x: number; }');
      const classNode = sourceFile.statements[0] as ts.ClassDeclaration;
      const propertyNode = classNode.members[0] as ts.PropertyDeclaration;
      const visibility = getVisibilityModifier(propertyNode);
      expect(visibility).toBe('private');
    });

    test('identifies protected modifier', () => {
      const sourceFile = createSourceFile('class Test { protected x: number; }');
      const classNode = sourceFile.statements[0] as ts.ClassDeclaration;
      const propertyNode = classNode.members[0] as ts.PropertyDeclaration;
      const visibility = getVisibilityModifier(propertyNode);
      expect(visibility).toBe('protected');
    });

    test('identifies public modifier', () => {
      const sourceFile = createSourceFile('class Test { public x: number; }');
      const classNode = sourceFile.statements[0] as ts.ClassDeclaration;
      const propertyNode = classNode.members[0] as ts.PropertyDeclaration;
      const visibility = getVisibilityModifier(propertyNode);
      expect(visibility).toBe('public');
    });

    test('defaults to public when no modifier', () => {
      const sourceFile = createSourceFile('class Test { x: number; }');
      const classNode = sourceFile.statements[0] as ts.ClassDeclaration;
      const propertyNode = classNode.members[0] as ts.PropertyDeclaration;
      const visibility = getVisibilityModifier(propertyNode);
      expect(visibility).toBe('public');
    });

    test('handles method declarations', () => {
      const sourceFile = createSourceFile('class Test { private method() {} }');
      const classNode = sourceFile.statements[0] as ts.ClassDeclaration;
      const methodNode = classNode.members[0] as ts.MethodDeclaration;
      const visibility = getVisibilityModifier(methodNode);
      expect(visibility).toBe('private');
    });
  });
});
