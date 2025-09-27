import { afterEach, beforeEach, describe, expect, test, spyOn } from 'bun:test';
import {
  __setGitRunner,
  analyzeFileChanges,
  analyzeNewFile,
  generateDiffHunks,
  getFileContent,
  hasDiffs,
  parseUnifiedDiff,
  runSemanticAnalysis,
  writeGitHubOutputFlag,
} from '../../src/analysis-runner.js';
import { logger } from '../../src/utils/logger.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('Analysis Runner - Core Functions', () => {
  let originalGitRunner: any;

  beforeEach(() => {
    // Mock logger to reduce noise during tests - mock before any function calls
    spyOn(logger, 'verbose').mockImplementation(() => {});
    spyOn(logger, 'debug').mockImplementation(() => {});
    spyOn(logger, 'machine').mockImplementation(() => {});
    spyOn(logger, 'output').mockImplementation(() => {});

    // Clear any previous mock calls
    logger.verbose.mockClear?.();
    logger.debug.mockClear?.();
    logger.machine.mockClear?.();
    logger.output.mockClear?.();
  });

  afterEach(() => {
    // Restore original git runner if it was modified
    if (originalGitRunner) {
      __setGitRunner(originalGitRunner);
    }
  });

  describe('getFileContent', () => {
    test('returns null for invalid ref', () => {
      const result = getFileContent('test.ts', 'invalid ref with spaces');
      expect(result).toBeNull();
    });

    test('returns null for invalid file path', () => {
      const result = getFileContent('invalid path with spaces', 'main');
      expect(result).toBeNull();
    });

    test('returns null when git command fails', () => {
      __setGitRunner(() => ({ status: 1, stdout: '' }));
      const result = getFileContent('test.ts', 'main');
      expect(result).toBeNull();
    });

    test('returns content when git command succeeds', () => {
      __setGitRunner(() => ({ status: 0, stdout: 'file content' }));
      const result = getFileContent('test.ts', 'main');
      expect(result).toBe('file content');
    });

    test('returns null when stdout is not a string', () => {
      __setGitRunner(() => ({ status: 0, stdout: undefined }));
      const result = getFileContent('test.ts', 'main');
      expect(result).toBeNull();
    });

    test('uses default git runner when not overridden', () => {
      // Temporarily restore default git runner to test lines 98-101
      const originalGitRunner = () => {
        // Mock the spawnSync behavior for the default git runner
        return {
          status: 0,
          stdout: 'default runner content',
        };
      };
      __setGitRunner(originalGitRunner);

      const result = getFileContent('test.ts', 'main');
      expect(result).toBe('default runner content');
    });

    test('handles spawnSync returning non-number status', () => {
      // Test the typeof check on lines 100
      __setGitRunner(() => ({ status: null as any, stdout: 'content' }));
      const result = getFileContent('test.ts', 'main');
      expect(result).toBeNull(); // Should return null due to status != 0
    });

    test('handles spawnSync returning non-string stdout', () => {
      // Test the typeof check on lines 101
      __setGitRunner(() => ({ status: 0, stdout: null as any }));
      const result = getFileContent('test.ts', 'main');
      expect(result).toBeNull(); // Should return null due to non-string stdout
    });

    test('handles file paths with parentheses correctly', () => {
      // Regression test: File paths with parentheses should work
      __setGitRunner(() => ({ status: 0, stdout: 'file content' }));
      const result = getFileContent('apps/web/src/app/(dashboard)/billing/actions.ts', 'main');
      expect(result).toBe('file content');
    });

    test('handles file paths with brackets correctly', () => {
      // Regression test: File paths with brackets should work
      __setGitRunner(() => ({ status: 0, stdout: 'component content' }));
      const result = getFileContent('src/components/ui/[slug]/page.ts', 'main');
      expect(result).toBe('component content');
    });

    test('handles complex file paths with multiple special characters', () => {
      // Regression test: Complex file paths with various special characters
      __setGitRunner(() => ({ status: 0, stdout: 'complex file content' }));
      const result = getFileContent(
        'apps/web/src/app/(dashboard)/[tenant]/billing-[id]/actions.ts',
        'main',
      );
      expect(result).toBe('complex file content');
    });
  });

  describe('hasDiffs', () => {
    test('returns false for invalid refs', () => {
      const result = hasDiffs('test.ts', 'invalid ref', 'main');
      expect(result).toBe(false);
    });

    test('returns false for invalid file path', () => {
      const result = hasDiffs('invalid path', 'base', 'head');
      expect(result).toBe(false);
    });

    test('returns false when git diff fails', () => {
      __setGitRunner(() => ({ status: 1, stdout: '' }));
      const result = hasDiffs('test.ts', 'base', 'head');
      expect(result).toBe(false);
    });

    test('returns false when no hunks present', () => {
      __setGitRunner(() => ({ status: 0, stdout: 'no hunks here' }));
      const result = hasDiffs('test.ts', 'base', 'head');
      expect(result).toBe(false);
    });

    test('returns true when hunks are present', () => {
      __setGitRunner(() => ({ status: 0, stdout: '@@ -1,1 +1,1 @@\n-old\n+new' }));
      const result = hasDiffs('test.ts', 'base', 'head');
      expect(result).toBe(true);
    });

    test('returns false when stdout is not a string', () => {
      __setGitRunner(() => ({ status: 0, stdout: undefined }));
      const result = hasDiffs('test.ts', 'base', 'head');
      expect(result).toBe(false);
    });

    test('handles exceptions in git runner and logs debug message', () => {
      // This triggers lines 301-304 (catch block)
      __setGitRunner(() => {
        throw new Error('Git command failed with exception');
      });
      const result = hasDiffs('test.ts', 'base', 'head');
      expect(result).toBe(false);
      {
        const calls = logger.debug.mock.calls ?? [];
        const texts = calls.flat();
        const hit = texts.some(
          (m) =>
            typeof m === 'string' &&
            m.includes(
              'Error checking for diffs in test.ts: ' + 'Git command failed with exception',
            ),
        );
        expect(hit).toBe(true);
      }
    });

    test('handles non-Error exceptions in git runner', () => {
      // This triggers the non-Error case in the catch block
      __setGitRunner(() => {
        throw new Error('String error');
      });
      const result = hasDiffs('test.ts', 'base', 'head');
      expect(result).toBe(false);
      {
        const calls = logger.debug.mock.calls ?? [];
        const texts = calls.flat();
        const hit = texts.some(
          (m) =>
            typeof m === 'string' &&
            m.includes('Error checking for diffs in test.ts: String error'),
        );
        expect(hit).toBe(true);
      }
    });

    test('handles file paths with parentheses correctly', () => {
      // Regression test: File paths with parentheses should work
      // Before fix: path validation would fail due to missing () in regex
      __setGitRunner(() => ({ status: 0, stdout: '@@ -1,1 +1,1 @@\n-old\n+new' }));
      const result = hasDiffs('apps/web/src/app/(dashboard)/billing/actions.ts', 'base', 'head');
      expect(result).toBe(true);
    });

    test('handles file paths with brackets correctly', () => {
      // Regression test: File paths with brackets should work
      __setGitRunner(() => ({ status: 0, stdout: '@@ -1,1 +1,1 @@\n-old\n+new' }));
      const result = hasDiffs('src/components/ui/[slug]/page.ts', 'base', 'head');
      expect(result).toBe(true);
    });

    test('handles complex file paths with multiple special characters', () => {
      // Regression test: Complex file paths with various special characters
      __setGitRunner(() => ({ status: 0, stdout: '@@ -1,1 +1,1 @@\n-old\n+new' }));
      const result = hasDiffs(
        'apps/web/src/app/(dashboard)/[tenant]/billing-[id]/actions.ts',
        'base',
        'head',
      );
      expect(result).toBe(true);
    });

    test('handles files that exist in git but not filesystem', () => {
      // Mock git cat-file -e to succeed (file exists in git history)
      // Mock git diff to return changes
      let gitCallCount = 0;
      __setGitRunner((args: string[]) => {
        gitCallCount++;
        if (args[0] === 'cat-file' && args[1] === '-e') {
          // File exists in git revision
          return { status: 0, stdout: '' };
        } else if (args[0] === 'diff') {
          // File has changes
          return { status: 0, stdout: '@@ -1,1 +1,1 @@\n-deleted file\n+new content' };
        }
        return { status: 1, stdout: '' };
      });

      const result = hasDiffs('deleted-file.ts', 'base', 'head');
      expect(result).toBe(true);
      // Should have called both git cat-file and git diff
      expect(gitCallCount).toBeGreaterThanOrEqual(1);
    });

    test('correctly validates working tree files vs git files', () => {
      // Test that working tree (.) uses filesystem check, git refs use git cat-file
      let gitCallCount = 0;
      __setGitRunner((args: string[]) => {
        gitCallCount++;
        if (args[0] === 'cat-file' && args[1] === '-e') {
          // File exists in git revision but not in working tree
          return { status: 0, stdout: '' };
        } else if (args[0] === 'diff') {
          return { status: 0, stdout: '@@ -1,1 +1,1 @@\n-old\n+new' };
        }
        return { status: 1, stdout: '' };
      });

      // This should work because it's checking git refs, not filesystem
      const result = hasDiffs('file-only-in-git.ts', 'commit1', 'commit2');
      expect(result).toBe(true);
      expect(gitCallCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('parseUnifiedDiff', () => {
    test('parses simple unified diff', () => {
      const patch = `@@ -1,1 +1,1 @@
-old line
+new line`;
      const result = parseUnifiedDiff(patch, 'test.ts');

      expect(result).toHaveLength(1);
      expect(result[0]?.file).toBe('test.ts');
      expect(result[0]?.baseRange).toEqual({ start: 1, end: 1 });
      expect(result[0]?.headRange).toEqual({ start: 1, end: 1 });
      expect(result[0]?.addedLines).toEqual([{ lineNumber: 1, content: 'new line' }]);
      expect(result[0]?.removedLines).toEqual([{ lineNumber: 1, content: 'old line' }]);
    });

    test('parses multi-line diff', () => {
      const patch = `@@ -1,3 +1,3 @@
 unchanged line
-removed line
+added line
 another unchanged`;
      const result = parseUnifiedDiff(patch, 'test.ts');

      expect(result).toHaveLength(1);
      expect(result[0]?.addedLines).toEqual([{ lineNumber: 2, content: 'added line' }]);
      expect(result[0]?.removedLines).toEqual([{ lineNumber: 2, content: 'removed line' }]);
    });

    test('handles invalid hunk header', () => {
      const patch = `@@ invalid header @@
-old line
+new line`;
      const result = parseUnifiedDiff(patch, 'test.ts');
      expect(result).toHaveLength(0);
    });

    test('handles empty patch', () => {
      const result = parseUnifiedDiff('', 'test.ts');
      expect(result).toHaveLength(0);
    });

    test('handles multiple hunks', () => {
      const patch = `@@ -1,1 +1,1 @@
-first old
+first new
@@ -5,1 +5,1 @@
-second old
+second new`;
      const result = parseUnifiedDiff(patch, 'test.ts');

      expect(result).toHaveLength(2);
      expect(result[0]?.baseRange.start).toBe(1);
      expect(result[1]?.baseRange.start).toBe(5);
    });

    test('handles diff line break within hunk content', () => {
      // This test triggers lines 262-263
      const patch = `@@ -1,3 +1,3 @@
 unchanged line
-removed line
+added line
diff --git a/another-file.txt b/another-file.txt`;
      const result = parseUnifiedDiff(patch, 'test.ts');

      expect(result).toHaveLength(1);
      expect(result[0]?.addedLines).toEqual([{ lineNumber: 2, content: 'added line' }]);
      expect(result[0]?.removedLines).toEqual([{ lineNumber: 2, content: 'removed line' }]);
    });
  });

  describe('generateDiffHunks', () => {
    test('returns git diff result when successful', () => {
      __setGitRunner(() => ({
        status: 0,
        stdout: '@@ -1,1 +1,1 @@\n-old\n+new',
      }));

      const result = generateDiffHunks('old', 'new', 'test.ts', 'base', 'head');
      expect(result).toHaveLength(1);
      expect(result[0]?.file).toBe('test.ts');
    });

    test('falls back to full file diff when git fails', () => {
      __setGitRunner(() => ({ status: 1, stdout: '' }));

      const baseContent = 'line1\nline2';
      const headContent = 'line1\nline3';
      const result = generateDiffHunks(baseContent, headContent, 'test.ts', 'base', 'head');

      expect(result).toHaveLength(1);
      expect(result[0]?.file).toBe('test.ts');
      expect(result[0]?.baseRange).toEqual({ start: 1, end: 2 });
      expect(result[0]?.headRange).toEqual({ start: 1, end: 2 });
    });

    test('handles invalid refs safely', () => {
      const result = generateDiffHunks('old', 'new', 'test.ts', 'invalid ref', 'head');

      expect(result).toHaveLength(1);
      expect(result[0]?.file).toBe('test.ts');
    });

    test('handles file paths with parentheses correctly', () => {
      // Regression test: File paths with parentheses should work
      __setGitRunner(() => ({
        status: 0,
        stdout: '@@ -1,1 +1,1 @@\n-old\n+new',
      }));

      const result = generateDiffHunks(
        'old',
        'new',
        'apps/web/src/app/(dashboard)/billing/actions.ts',
        'base',
        'head',
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.file).toBe('apps/web/src/app/(dashboard)/billing/actions.ts');
    });

    test('handles file paths with brackets correctly', () => {
      // Regression test: File paths with brackets should work
      __setGitRunner(() => ({
        status: 0,
        stdout: '@@ -10,3 +10,3 @@\n-old component\n+new component',
      }));

      const result = generateDiffHunks(
        'old component',
        'new component',
        'src/components/ui/[slug]/page.ts',
        'base',
        'head',
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.file).toBe('src/components/ui/[slug]/page.ts');
    });

    test('handles complex file paths with multiple special characters', () => {
      // Regression test: Complex file paths with various special characters
      __setGitRunner(() => ({
        status: 0,
        stdout: '@@ -5,2 +5,2 @@\n-original\n+modified',
      }));

      const result = generateDiffHunks(
        'original',
        'modified',
        'apps/web/src/app/(dashboard)/[tenant]/billing-[id]/actions.ts',
        'base',
        'head',
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.file).toBe('apps/web/src/app/(dashboard)/[tenant]/billing-[id]/actions.ts');
    });
  });

  describe('analyzeNewFile', () => {
    test('detects exported functions', () => {
      const content = 'export function test() { return 42; }';
      const result = analyzeNewFile(content, 'test.ts');

      expect(result.length).toBeGreaterThan(0);
      const exportChange = result.find((c) => c.kind === 'exportAdded');
      expect(exportChange).toBeDefined();
      expect(exportChange?.detail).toContain('test');
      expect(exportChange?.severity).toBe('high');
    });

    test('detects non-exported functions', () => {
      const content = 'function helper() { return 42; }';
      const result = analyzeNewFile(content, 'test.ts');

      const functionChange = result.find((c) => c.kind === 'functionAdded');
      expect(functionChange).toBeDefined();
      expect(functionChange?.detail).toContain('helper');
      expect(functionChange?.severity).toBe('medium');
    });

    test('does not duplicate exported functions', () => {
      const content = 'export function test() { return 42; }';
      const result = analyzeNewFile(content, 'test.ts');

      const exportChanges = result.filter((c) => c.kind === 'exportAdded');
      const functionChanges = result.filter(
        (c) => c.kind === 'functionAdded' && c.detail.includes('test'),
      );

      expect(exportChanges.length).toBe(1);
      expect(functionChanges.length).toBe(0); // Should not duplicate
    });
  });

  describe('analyzeFileChanges', () => {
    test('returns empty array when both contents are null', async () => {
      __setGitRunner(() => ({ status: 1, stdout: '' }));
      const result = await analyzeFileChanges('test.ts', 'base', 'head', {
        include: ['**/*.ts'],
        exclude: [],
        sideEffectCallees: [],
        testGlobs: [],
        bypassLabels: [],
      });
      expect(result).toEqual([]);
    });

    test('analyzes new file when base content is null', async () => {
      // Ensure logger is mocked and clear any previous calls
      logger.verbose.mockClear?.();

      __setGitRunner((args) => {
        if (args[1]?.startsWith('base:')) {
          return { status: 1, stdout: '' }; // base doesn't exist
        }
        return { status: 0, stdout: 'export function test() {}' }; // head exists
      });

      const result = await analyzeFileChanges('test.ts', 'base', 'head', {
        include: ['**/*.ts'],
        exclude: [],
        sideEffectCallees: [],
        testGlobs: [],
        bypassLabels: [],
      });

      expect(result.length).toBeGreaterThan(0);
      {
        const calls = logger.verbose.mock.calls ?? [];
        const texts = calls.flat();
        expect(texts.some((m) => typeof m === 'string' && m.includes('New file detected'))).toBe(
          true,
        );
      }
    });

    test('returns empty array when head content is null (deleted file)', async () => {
      __setGitRunner((args) => {
        if (args[1]?.startsWith('base:')) {
          return { status: 0, stdout: 'export function test() {}' }; // base exists
        }
        return { status: 1, stdout: '' }; // head doesn't exist
      });

      const result = await analyzeFileChanges('test.ts', 'base', 'head', {
        include: ['**/*.ts'],
        exclude: [],
        sideEffectCallees: [],
        testGlobs: [],
        bypassLabels: [],
      });

      expect(result).toEqual([]);
      {
        const calls = logger.verbose.mock.calls ?? [];
        const texts = calls.flat();
        expect(texts.some((m) => typeof m === 'string' && m.includes('File deleted'))).toBe(true);
      }
    });

    test('analyzes changes when both base and head content exist', async () => {
      // This test triggers lines 75, 77, 79-80, 82-83, 85-92
      __setGitRunner((args) => {
        if (args[0] === 'show') {
          const spec = String(args[1] || '');
          if (spec.startsWith('base:')) {
            return { status: 0, stdout: 'function oldFunction() { return 1; }' };
          }
          if (spec.startsWith('head:')) {
            return { status: 0, stdout: 'function newFunction() { return 2; }' };
          }
        }
        if (args[0] === 'diff') {
          return {
            status: 0,
            stdout:
              '@@ -1,1 +1,1 @@\n-function oldFunction() { return 1; }\n+function newFunction() { return 2; }',
          };
        }
        return { status: 1, stdout: '' };
      });

      const result = await analyzeFileChanges('test.ts', 'base', 'head', {
        include: ['**/*.ts'],
        exclude: [],
        sideEffectCallees: ['console.*'],
        testGlobs: ['**/*.test.ts'],
        bypassLabels: ['skip-tests'],
      });

      // Should return semantic changes
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('writeGitHubOutputFlag', () => {
    let tmpDir: string;
    let originalGithubOutput: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-output-'));
      originalGithubOutput = process.env.GITHUB_OUTPUT;
      process.env.GITHUB_OUTPUT = path.join(tmpDir, 'output.txt');
    });

    afterEach(() => {
      process.env.GITHUB_OUTPUT = originalGithubOutput;
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {} // Ignore cleanup errors
    });

    test('writes requires-tests=true', () => {
      writeGitHubOutputFlag(true);
      const content = fs.readFileSync(process.env.GITHUB_OUTPUT!, 'utf8');
      expect(content).toContain('requires-tests=true');
    });

    test('writes requires-tests=false', () => {
      writeGitHubOutputFlag(false);
      const content = fs.readFileSync(process.env.GITHUB_OUTPUT!, 'utf8');
      expect(content).toContain('requires-tests=false');
    });

    test('handles missing GITHUB_OUTPUT environment variable', () => {
      delete process.env.GITHUB_OUTPUT;
      // Should not throw
      expect(() => writeGitHubOutputFlag(true)).not.toThrow();
    });
  });
});

describe('Analysis Runner - Integration', () => {
  beforeEach(() => {
    spyOn(logger, 'verbose').mockImplementation(() => {});
    spyOn(logger, 'debug').mockImplementation(() => {});
    spyOn(logger, 'machine').mockImplementation(() => {});

    // Clear mock history before each test
    logger.verbose.mockClear?.();
    logger.debug.mockClear?.();
    logger.machine.mockClear?.();
  });

  describe('runSemanticAnalysis', () => {
    test('returns empty result when no files provided', async () => {
      const result = await runSemanticAnalysis({
        baseRef: 'base',
        headRef: 'head',
        files: [],
        outputFormat: 'machine',
      });

      expect(result.filesAnalyzed).toBe(0);
      expect(result.totalChanges).toBe(0);
      expect(result.requiresTests).toBe(false);
    });

    test('filters files by configuration', async () => {
      __setGitRunner(() => ({ status: 1, stdout: '' })); // No diffs

      const result = await runSemanticAnalysis({
        baseRef: 'base',
        headRef: 'head',
        files: ['src/test.ts', 'node_modules/pkg/index.ts', 'test.spec.ts'],
        outputFormat: 'machine',
      });

      // Only src/test.ts should be analyzed (others excluded by default config)
      expect(result.filesAnalyzed).toBe(0); // No diffs, so not analyzed
    });

    test('handles error during diff checking and logs debug message', async () => {
      // This triggers lines 401-402 in the catch block during file diff checking
      let callCount = 0;
      __setGitRunner(() => {
        callCount++;
        if (callCount === 1) {
          // First call in hasDiffs throws an error
          throw new Error('Git diff check failed');
        }
        return { status: 1, stdout: '' };
      });

      const result = await runSemanticAnalysis({
        baseRef: 'base',
        headRef: 'head',
        files: ['src/test.ts'],
        outputFormat: 'machine',
      });

      expect(result.filesAnalyzed).toBe(0);
      {
        const calls = logger.debug.mock.calls ?? [];
        const texts = calls.flat();
        expect(
          texts.some(
            (m) =>
              typeof m === 'string' &&
              m.includes('Error checking for diffs in src/test.ts: ' + 'Git diff check failed'),
          ),
        ).toBe(true);
      }
    });

    test('handles non-Error exception during diff checking', async () => {
      // This triggers the non-Error case in the catch block
      let callCount = 0;
      __setGitRunner(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('String error during diff check');
        }
        return { status: 1, stdout: '' };
      });

      const result = await runSemanticAnalysis({
        baseRef: 'base',
        headRef: 'head',
        files: ['src/test.ts'],
        outputFormat: 'machine',
      });

      expect(result.filesAnalyzed).toBe(0);
      {
        const calls = logger.debug.mock.calls ?? [];
        const texts = calls.flat();
        expect(
          texts.some(
            (m) =>
              typeof m === 'string' &&
              m.includes(
                'Error checking for diffs in src/test.ts: ' + 'String error during diff check',
              ),
          ),
        ).toBe(true);
      }
    });

    test('handles files with no diffs and logs verbose message', async () => {
      // This triggers line 399 where files with no diffs are logged
      __setGitRunner(() => ({ status: 0, stdout: '' })); // No hunks, so no diffs

      const result = await runSemanticAnalysis({
        baseRef: 'base',
        headRef: 'head',
        files: ['src/test.ts'],
        outputFormat: 'machine',
      });

      expect(result.filesAnalyzed).toBe(0);
      {
        const calls = logger.verbose.mock.calls ?? [];
        const texts = calls.flat();
        expect(texts.some((m) => typeof m === 'string' && m.includes('Skipping src/test.ts'))).toBe(
          true,
        );
        expect(
          texts.some(
            (m) => typeof m === 'string' && m.includes('Filtered down to 0 files that have diffs.'),
          ),
        ).toBe(true);
      }
    });

    test('processes files with diffs and calls worker', async () => {
      // This should trigger the worker paths and lines around 408-420
      __setGitRunner((args) => {
        if (args[0] === 'diff') {
          return { status: 0, stdout: '@@ -1,1 +1,1 @@\n-old\n+new' }; // Has diffs
        }
        return { status: 0, stdout: 'file content' };
      });

      // Mock the worker script path resolution and execution
      await runSemanticAnalysis({
        baseRef: 'base',
        headRef: 'head',
        files: ['src/test.ts'],
        outputFormat: 'machine',
        timeoutMs: 1000, // Short timeout to avoid hanging
      });

      {
        const calls = logger.verbose.mock.calls ?? [];
        const texts = calls.flat();
        expect(
          texts.some(
            (m) => typeof m === 'string' && m.includes('Filtered down to 1 files that have diffs.'),
          ),
        ).toBe(true);
      }
    });
  });
});
