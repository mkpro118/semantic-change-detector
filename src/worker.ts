/**
 * @file This script defines the behavior of a worker thread for the semantic change detector.
 * It receives a task via `workerData`, performs a semantic analysis on a single file,
 * and posts the results back to the main thread via `parentPort`.
 */

import { parentPort, workerData } from 'worker_threads';
import { analyzeFileChanges } from './analysis-runner.js';
import type { AnalyzerConfig } from './types/index.js';

interface WorkerData {
  filePath: string;
  baseRef: string;
  headRef: string;
  config: AnalyzerConfig;
}

// Ensure this script is running as a worker.
if (!parentPort) {
  throw new Error('This file should be run as a worker thread.');
}

// Main worker logic: perform the analysis and post the result.
try {
  const data = workerData as WorkerData;
  const { filePath, baseRef, headRef, config } = data;
  const changes = analyzeFileChanges(filePath, baseRef, headRef, config);
  parentPort.postMessage({ status: 'success', filePath, changes });
} catch (error) {
  const data = workerData as WorkerData;
  const { filePath } = data;
  parentPort.postMessage({
    status: 'error',
    filePath,
    error: error instanceof Error ? error.message : String(error),
  });
}
