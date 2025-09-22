import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mapConcurrent } from '../../src/utils/concurrency.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Concurrency Utils', () => {
  let tempWorkerFile: string;
  let tempDir: string;

  beforeAll(() => {
    // Create a temporary directory and worker script for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concurrency-test-'));
    tempWorkerFile = path.join(tempDir, 'test-worker.js');

    // Create a simple worker script that echoes back the input with additional data
    const workerScript = `
const { parentPort, workerData } = require('worker_threads');

if (parentPort) {
  const result = {
    status: 'success',
    filePath: workerData.filePath,
    processedData: 'processed-' + workerData.data
  };
  parentPort.postMessage(result);
}
`;
    fs.writeFileSync(tempWorkerFile, workerScript);
  });

  afterAll(() => {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {} // Ignore cleanup errors
  });

  describe('mapConcurrent', () => {
    test('processes tasks concurrently and returns results', async () => {
      interface TaskData {
        filePath: string;
        data: string;
      }

      interface TaskResult {
        status: string;
        filePath: string;
        processedData: string;
      }

      const tasks: TaskData[] = [
        { filePath: 'file1.ts', data: 'test1' },
        { filePath: 'file2.ts', data: 'test2' },
        { filePath: 'file3.ts', data: 'test3' },
      ];

      const results = await mapConcurrent<TaskData, TaskResult>(
        tasks,
        tempWorkerFile,
        2, // Use 2 concurrent workers
        5000, // 5 second timeout
      );

      expect(results).toHaveLength(3);

      // Results may come back in any order due to concurrency
      const filePaths = results.map((r) => r.filePath).sort();
      expect(filePaths).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);

      // Check that all results have the expected format
      results.forEach((result) => {
        expect(result.status).toBe('success');
        expect(result.filePath).toMatch(/^file[123]\.ts$/);
        expect(result.processedData).toMatch(/^processed-test[123]$/);
      });
    });

    test('handles empty task array', async () => {
      const results = await mapConcurrent([], tempWorkerFile);
      expect(results).toEqual([]);
    });

    test('respects maxConcurrency parameter', async () => {
      interface TaskData {
        filePath: string;
        data: string;
      }

      interface TaskResult {
        status: string;
        filePath: string;
        processedData: string;
      }

      const tasks: TaskData[] = [
        { filePath: 'file1.ts', data: 'test1' },
        { filePath: 'file2.ts', data: 'test2' },
      ];

      // This test mainly ensures the maxConcurrency parameter is accepted
      const results = await mapConcurrent<TaskData, TaskResult>(
        tasks,
        tempWorkerFile,
        1, // Force sequential processing
      );

      expect(results).toHaveLength(2);
    });

    test('uses default maxConcurrency when not specified', async () => {
      interface TaskData {
        filePath: string;
        data: string;
      }

      interface TaskResult {
        status: string;
        filePath: string;
        processedData: string;
      }

      const tasks: TaskData[] = [{ filePath: 'file1.ts', data: 'test1' }];

      const results = await mapConcurrent<TaskData, TaskResult>(
        tasks,
        tempWorkerFile, // No maxConcurrency specified, should use os.cpus().length
      );

      expect(results).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    test('handles non-existent worker script gracefully', async () => {
      interface TaskData {
        filePath: string;
        data: string;
      }

      interface TaskResult {
        status: string;
        filePath: string;
        error?: string;
      }

      const tasks: TaskData[] = [{ filePath: 'file1.ts', data: 'test1' }];

      const nonExistentWorker = path.join(tempDir, 'non-existent-worker.js');

      const results = await mapConcurrent<TaskData, TaskResult>(
        tasks,
        nonExistentWorker,
        1,
        1000, // Short timeout for faster test
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('error');
      expect(results[0]?.filePath).toBe('file1.ts');
      expect(results[0]?.error).toBeDefined();
    });

    test('handles worker timeout', async () => {
      // Create a worker that takes longer than the timeout
      const slowWorkerFile = path.join(tempDir, 'slow-worker.js');
      const slowWorkerScript = `
const { parentPort, workerData } = require('worker_threads');

// Simulate slow work that exceeds timeout
setTimeout(() => {
  if (parentPort) {
    parentPort.postMessage({
      status: 'success',
      filePath: workerData.filePath,
      data: 'too slow'
    });
  }
}, 2000); // 2 seconds, but we'll set timeout to 500ms
`;
      fs.writeFileSync(slowWorkerFile, slowWorkerScript);

      interface TaskData {
        filePath: string;
        data: string;
      }

      interface TaskResult {
        status: string;
        filePath: string;
        error?: string;
      }

      const tasks: TaskData[] = [{ filePath: 'slow-file.ts', data: 'test' }];

      const results = await mapConcurrent<TaskData, TaskResult>(
        tasks,
        slowWorkerFile,
        1,
        500, // 500ms timeout, worker takes 2000ms
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('error');
      expect(results[0]?.filePath).toBe('slow-file.ts');
      expect(results[0]?.error).toContain('timed out');

      // Clean up
      fs.unlinkSync(slowWorkerFile);
    });

    test('handles worker script with syntax error', async () => {
      // Create a worker with syntax error
      const badWorkerFile = path.join(tempDir, 'bad-worker.js');
      const badWorkerScript = `
const { parentPort, workerData } = require('worker_threads');

// Intentional syntax error
throw new Error('Worker script error');
`;
      fs.writeFileSync(badWorkerFile, badWorkerScript);

      interface TaskData {
        filePath: string;
        data: string;
      }

      interface TaskResult {
        status: string;
        filePath: string;
        error?: string;
      }

      const tasks: TaskData[] = [{ filePath: 'bad-file.ts', data: 'test' }];

      const results = await mapConcurrent<TaskData, TaskResult>(tasks, badWorkerFile, 1, 1000);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('error');
      expect(results[0]?.filePath).toBe('bad-file.ts');
      expect(results[0]?.error).toBeDefined();

      // Clean up
      fs.unlinkSync(badWorkerFile);
    });

    test('handles worker exit with non-zero code', async () => {
      // This triggers lines 76-83 (worker exit handler)
      const exitWorkerFile = path.join(tempDir, 'exit-worker.js');
      const exitWorkerScript = `
const { parentPort, workerData } = require('worker_threads');

// Exit with non-zero code
process.exit(1);
`;
      fs.writeFileSync(exitWorkerFile, exitWorkerScript);

      interface TaskData {
        filePath: string;
        data: string;
      }

      interface TaskResult {
        status: string;
        filePath: string;
        error?: string;
      }

      const tasks: TaskData[] = [{ filePath: 'exit-file.ts', data: 'test' }];

      const results = await mapConcurrent<TaskData, TaskResult>(tasks, exitWorkerFile, 1, 1000);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('error');
      expect(results[0]?.filePath).toBe('exit-file.ts');
      expect(results[0]?.error).toContain('Worker stopped with exit code 1');

      // Clean up
      fs.unlinkSync(exitWorkerFile);
    });
  });
});
