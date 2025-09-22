import * as os from 'os';
import { Worker } from 'worker_threads';

/**
 * Executes a list of tasks concurrently using a pool of worker threads.
 * This function is designed to parallelize CPU-intensive work across multiple cores.
 *
 * @param tasks An array of task data objects to be processed. Each object is passed as `workerData` to a worker.
 * @param workerScript The absolute path to the script that the worker threads will execute.
 * @param maxConcurrency The maximum number of tasks to run in parallel. Defaults to the number of CPU cores.
 * @param timeoutMs The maximum time in milliseconds to allow a worker to run before terminating it. Defaults to 2 minutes.
 * @returns A promise that resolves with an array of results from all worker tasks.
 */
export function mapConcurrent<T extends { filePath: string }, R>(
  tasks: T[],
  workerScript: string,
  maxConcurrency: number = os.cpus().length,
  timeoutMs: number = 120000, // Default timeout of 2 minutes
): Promise<R[]> {
  return new Promise((resolve) => {
    const results: R[] = [];
    let running = 0;
    let currentIndex = 0;

    /**
     * Internal function to manage the worker pool.
     * It starts new workers as long as there are tasks in the queue and available concurrency slots.
     * When all tasks are complete, it resolves the main promise.
     */
    function runNext() {
      if (currentIndex === tasks.length && running === 0) {
        return resolve(results);
      }

      while (running < maxConcurrency && currentIndex < tasks.length) {
        running++;
        const task = tasks[currentIndex++]!;
        const worker = new Worker(workerScript, { workerData: task });

        let timeoutId: NodeJS.Timeout | null = null;

        /**
         * Handles the completion of a worker task, either by message, error, or timeout.
         * It cleans up listeners and timers, records the result, and calls `runNext` to continue processing.
         * @param result The result object from the worker, or null if the worker was terminated without a result.
         */
        const onDone = (result: R | null) => {
          if (timeoutId) clearTimeout(timeoutId);
          worker.removeAllListeners();
          running--;
          if (result) {
            results.push(result);
          }
          runNext();
        };

        timeoutId = setTimeout(() => {
          void worker.terminate();
          const errorResult = {
            status: 'error',
            filePath: task.filePath,
            error: `Worker timed out after ${timeoutMs}ms`,
          } as R;
          onDone(errorResult);
        }, timeoutMs);

        worker.on('message', (result: R) => onDone(result));
        worker.on('error', (error) => {
          const errorResult = {
            status: 'error',
            filePath: task.filePath,
            error: error.message,
          } as R;
          onDone(errorResult);
        });
        worker.on('exit', (code) => {
          if (code !== 0) {
            const errorResult = {
              status: 'error',
              filePath: task.filePath,
              error: `Worker stopped with exit code ${code}`,
            } as R;
            onDone(errorResult);
          }
        });
      }
    }

    runNext();
  });
}
