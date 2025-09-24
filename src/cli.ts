#!/usr/bin/env node
/**
 * @file This is the main entry point for the semantic-change-detector CLI.
 * It parses command-line arguments, orchestrates the analysis of files,
 * and outputs the results in the specified format.
 */

import type { AnalysisOptions } from './analysis-runner.js';
import { runSemanticAnalysis } from './analysis-runner.js';
import type { AnalysisResult } from './types/index.js';
import { logger, LogLevel } from './utils/logger.js';

/**
 * Parses command-line arguments into an options object.
 * @param args The array of command-line arguments.
 * @returns A partial options object.
 */
function parseCommandLineArgs(args: string[]): Partial<AnalysisOptions> {
  const options: Partial<AnalysisOptions> = {};

  for (const arg of args) {
    if (arg.startsWith('--base-ref=')) {
      const [, v] = arg.split('=');
      if (v) options.baseRef = v;
    } else if (arg.startsWith('--head-ref=')) {
      const [, v] = arg.split('=');
      if (v) options.headRef = v;
    } else if (arg.startsWith('--files=')) {
      const [, v] = arg.split('=');
      if (v)
        options.files = v
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
    } else if (arg.startsWith('--output-format=')) {
      const [, v] = arg.split('=');
      if (v === 'json' || v === 'github-actions' || v === 'console' || v === 'machine') {
        options.outputFormat = v;
      }
    } else if (arg.startsWith('--output-file=')) {
      const [, v] = arg.split('=');
      if (v) options.outputFile = v;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--quiet') {
      options.quiet = true;
    } else if (arg.startsWith('--timeout-ms=')) {
      const [, v] = arg.split('=');
      if (v) options.timeoutMs = Number.parseInt(v, 10);
    } else if (arg === '--stdin') {
      options.stdin = true;
    } else if (arg.startsWith('--config-path=')) {
      const [, v] = arg.split('=');
      if (v) options.configPath = v;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

/**
 * Validates the parsed options and sets default values.
 * Exits the process if required options are missing.
 * @param options The partial options object from parsing.
 * @returns A full options object with defaults applied.
 */
function validateOptions(
  options: Partial<AnalysisOptions>,
): AnalysisResult extends never ? never : AnalysisOptions {
  if (!options.baseRef || !options.headRef) {
    logger.debug('Error: --base-ref and --head-ref are required');
    process.exit(1);
  }

  if ((!options.files || options.files.length === 0) && !options.stdin) {
    logger.verbose('No files to analyze. Use --files or --stdin.');
    process.exit(0);
  }

  const ensured = options as Required<Pick<AnalysisOptions, 'baseRef' | 'headRef'>> &
    Partial<AnalysisOptions>;

  return {
    baseRef: ensured.baseRef,
    headRef: ensured.headRef,
    files: ensured.files || [],
    outputFormat: ensured.outputFormat || 'console',
    outputFile: ensured.outputFile,
    debug: ensured.debug || false,
    quiet: ensured.quiet || false,
    timeoutMs: ensured.timeoutMs,
    stdin: ensured.stdin || false,
  };
}

/**
 * Shows the help message for the CLI.
 */
function showHelp(): void {
  logger.verbose(`
@mkpro118/semantic-change-detector - Advanced semantic change detection for TypeScript and React

USAGE:
  semantic-change-detector [OPTIONS]
  git diff --name-only ... | semantic-change-detector --stdin [OPTIONS]

REQUIRED OPTIONS:
  --base-ref=<ref>         Git reference for the base version (e.g., main, HEAD~1)
  --head-ref=<ref>         Git reference for the head version (e.g., feature-branch, HEAD)

INPUT OPTIONS (choose one):
  --files=<paths>          Comma-separated list of file paths to analyze
  --stdin                  Read file paths from stdin (newline-separated)

OUTPUT OPTIONS:
  --output-format=<format> Output format: console (default), json, machine, github-actions
  --output-file=<path>     File path to write JSON output (for json/github-actions formats)

GENERAL OPTIONS:
  --debug                  Enable verbose debug logging
  --quiet                  Suppress all console output except critical errors
  --timeout-ms=<ms>        Timeout for individual file analysis (default: 120000ms)
  --config-path=<path>     Path to a custom analyzer configuration file (default: .semantic-change-detector.json)
  --help, -h               Show this help message

EXAMPLES:
  # Basic usage with --files
  semantic-change-detector \\
    --base-ref=main \\
    --head-ref=feature-branch \\
    --files="src/component.tsx,src/utils.ts"

  # Pipe files from git diff
  git diff --name-only main...feature-branch | semantic-change-detector --stdin --base-ref=main --head-ref=feature-branch

  # GitHub Actions usage
  git diff --name-only \\
    "\${github.event.pull_request.base.sha}...\${github.event.pull_request.head.sha}" |
  semantic-change-detector \\
    --stdin \\
    --base-ref="\${github.event.pull_request.base.sha}" \\
    --head-ref="\${github.event.pull_request.head.sha}" \\
    --output-format=github-actions

For more information, visit: https://github.com/mkpro118/semantic-change-detector
`);
}

/**
 * Reads file paths from stdin.
 * @returns A promise that resolves with an array of file paths.
 */
function readStdin(): Promise<string[]> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let data = '';

    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => {
      data += chunk.toString();
    });

    stdin.on('end', () => {
      const files = data
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);
      resolve(files);
    });

    if (stdin.isTTY) {
      resolve([]);
    }
  });
}

/**
 * The main entry point for the CLI application.
 * It parses arguments, runs the analysis, and handles process exit.
 */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const parsedOptions = parseCommandLineArgs(args);

    if (parsedOptions.help) {
      showHelp();
      process.exit(0);
    }

    if (parsedOptions.stdin) {
      const stdinFiles = await readStdin();
      parsedOptions.files = [...(parsedOptions.files || []), ...stdinFiles];
    }

    const options = validateOptions(parsedOptions);

    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else if (options.quiet) {
      logger.setLevel(LogLevel.QUIET);
    } else if (options.outputFormat === 'machine' || options.outputFormat === 'github-actions') {
      logger.setLevel(LogLevel.MACHINE);
    } else {
      logger.setLevel(LogLevel.VERBOSE);
    }

    await runSemanticAnalysis(options);

    process.exit(0);
  } catch (error) {
    logger.debug(`Analysis failed: ${error as string}`);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.debug(`Fatal error: ${error as string}`);
  process.exit(1);
});
