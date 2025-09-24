/**
 * @file This module contains the core logic for analyzing file changes.
 * It orchestrates fetching file content from git, generating diffs, creating semantic contexts,
 * and running the final analysis.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { minimatch } from 'minimatch';
import * as path from 'path';
import * as process from 'process'; // Added for process.cwd()
import * as ts from 'typescript';
import { fileURLToPath } from 'url';
import { analyzeSemanticChanges } from './analyzers/semantic-analyzer.js';
import { createSemanticContext } from './context/semantic-context-builder.js';
import { formatForGitHubActions } from './formatters/github-actions.js';
import type {
  AnalysisResult,
  AnalyzerConfig,
  DiffHunk,
  SemanticChangeType,
  SeverityLevel,
} from './types/index.js';
import { mapConcurrent } from './utils/concurrency.js';
import { logger } from './utils/logger.js';

/**
 * Represents a single semantic change detected in a file.
 */
export type FileChange = {
  /** The line number where the change occurred. */
  line: number;
  /** The column number where the change occurred. */
  column: number;
  /** The specific type of change that was detected. */
  kind: SemanticChangeType;
  /** A human-readable description of the change. */
  detail: string;
  /** The severity of the change (high, medium, or low). */
  severity: SeverityLevel;
  /** The type of the AST node related to the change. */
  astNode: string;
  /** Optional additional context about the change, like the original and new function signatures. */
  context?: string;
};

/**
 * Analyzes the semantic changes between two versions of a single file.
 * @param filePath The path to the file to analyze.
 * @param baseRef The git ref for the base version of the file.
 * @param headRef The git ref for the head version of the file.
 * @param config The analyzer configuration.
 * @returns An array of detected semantic changes for the file.
 */
export function analyzeFileChanges(
  filePath: string,
  baseRef: string,
  headRef: string,
  config: AnalyzerConfig,
): Array<FileChange> {
  const baseContent = getFileContent(filePath, baseRef);
  const headContent = getFileContent(filePath, headRef);

  if (!baseContent && !headContent) {
    return [];
  }

  if (!baseContent) {
    logger.verbose(`   New file detected`);
    return analyzeNewFile(headContent!, filePath);
  }

  if (!headContent) {
    logger.verbose(`   File deleted`);
    return [];
  }

  const hunks = generateDiffHunks(baseContent, headContent, filePath, baseRef, headRef);

  const baseSourceFile = ts.createSourceFile(filePath, baseContent, ts.ScriptTarget.Latest, true);
  const headSourceFile = ts.createSourceFile(filePath, headContent, ts.ScriptTarget.Latest, true);

  const baseContext = createSemanticContext(baseSourceFile, config.sideEffectCallees);
  const headContext = createSemanticContext(headSourceFile, config.sideEffectCallees);

  const changes = analyzeSemanticChanges(
    baseContext,
    headContext,
    hunks,
    baseContent,
    headContent,
    config,
  );

  return changes;
}

/** The internal function used to execute git commands. Can be overridden for testing. */
let gitRunner: (args: string[]) => { status: number; stdout?: string } = (args: string[]) => {
  const res = spawnSync('git', args, { encoding: 'utf8' });
  const status = typeof res.status === 'number' ? res.status : 1;
  const stdout = typeof res.stdout === 'string' ? res.stdout : undefined;
  return { status, stdout };
};

/**
 * Overrides the internal git runner function. Used for testing purposes.
 * @param fn The function to use for running git commands.
 * @internal
 */
export function __setGitRunner(fn: (args: string[]) => { status: number; stdout?: string }) {
  gitRunner = fn;
}

/**
 * Retrieves the content of a file from a specific git ref.
 * @param filePath The path to the file.
 * @param ref The git ref (e.g., commit SHA, branch name).
 * @returns The file content as a string, or null if it could not be retrieved.
 */
export function getFileContent(filePath: string, ref: string): string | null {
  const safePath = /^[A-Za-z0-9._\/#\-]+$/.test(filePath) ? filePath : '';
  if (!safePath) {
    return null;
  }

  // Handle working tree (current filesystem) reference
  if (ref === '.') {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  const safeRef = /^[A-Za-z0-9._:\/\-]+$/.test(ref) ? ref : '';
  if (!safeRef) {
    return null;
  }

  const res = gitRunner(['show', `${safeRef}:${safePath}`]);

  if (res.status === 0 && typeof res.stdout === 'string') {
    return res.stdout;
  }

  return null;
}

/**
 * Performs a lightweight analysis of a new file to find some basic changes.
 * @param content The full content of the new file.
 * @param _filePath The path to the new file (currently unused).
 * @returns An array of high-level changes found in the new file.
 */
export function analyzeNewFile(content: string, filePath: string): Array<FileChange> {
  const changes: FileChange[] = [];
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const context = createSemanticContext(sourceFile, []);
  const exportedNames = new Set(context.exports.map((e) => e.name));

  for (const exp of context.exports) {
    changes.push({
      line: exp.line,
      column: exp.column,
      kind: 'exportAdded',
      detail: `New export '${exp.name}' added`,
      severity: 'high', // New exports are high-severity
      astNode: exp.type,
      context: `Export type: ${exp.type}`,
    });
  }

  for (const func of context.functions) {
    if (!exportedNames.has(func.name)) {
      // Only add if not already covered by exports
      changes.push({
        line: func.line,
        column: func.column,
        kind: 'functionAdded',
        detail: `New function '${func.name}' added`,
        severity: 'medium',
        astNode: 'FunctionDeclaration',
      });
    }
  }

  return changes;
}

/**
 * Generates an array of diff hunks representing the changes between two versions of a file.
 * It attempts to use `git diff` for precision, falling back to a single, full-file hunk.
 * @param baseContent The content of the base version.
 * @param headContent The content of the head version.
 * @param filePath The path to the file.
 * @param baseRef The git ref for the base version.
 * @param headRef The git ref for the head version.
 * @returns An array of diff hunks.
 */
export function generateDiffHunks(
  baseContent: string,
  headContent: string,
  filePath: string,
  baseRef: string,
  headRef: string,
): DiffHunk[] {
  try {
    const safeRefA = /^[A-Za-z0-9._:\/\-]+$/.test(baseRef) ? baseRef : '';
    const safeRefB = /^[A-Za-z0-9._:\/\-]+$/.test(headRef) || headRef === '.' ? headRef : '';
    const safePath = /^[A-Za-z0-9._\/#\-]+$/.test(filePath) ? filePath : '';
    if (safeRefA && safeRefB && safePath) {
      const args = ['diff', '--unified=0', safeRefA];
      if (safeRefB !== '.') {
        args.push(safeRefB);
      }
      args.push('--', safePath);
      const res = gitRunner(args);
      if (res.status === 0 && typeof res.stdout === 'string') {
        const parsed = parseUnifiedDiff(res.stdout, filePath);
        if (parsed.length > 0) return parsed;
      }
    }
  } catch {
    // ignore and fall back
  }

  const baseLines = baseContent.split('\n');
  const headLines = headContent.split('\n');
  return [
    {
      file: filePath,
      baseRange: { start: 1, end: baseLines.length },
      headRange: { start: 1, end: headLines.length },
      addedLines: [],
      removedLines: [],
    },
  ];
}

/**
 * Parses a unified diff patch string into an array of DiffHunk objects.
 * @param patch The raw string output from a `git diff` command.
 * @param filePath The path to the file the patch applies to.
 * @returns An array of structured diff hunks.
 */
export function parseUnifiedDiff(patch: string, filePath: string): DiffHunk[] {
  const lines = patch.split(/\r?\n/);
  const hunks: DiffHunk[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.startsWith('@@')) {
      const m = /@@\s+-([0-9]+)(?:,([0-9]+))?\s+\+([0-9]+)(?:,([0-9]+))?\s+@@/.exec(line);
      if (!m) {
        i++;
        continue;
      }
      const baseStart = Number.parseInt(m[1] ?? '1', 10);
      const baseLen = m[2] ? Number.parseInt(m[2], 10) : 1;
      const headStart = Number.parseInt(m[3] ?? '1', 10);
      const headLen = m[4] ? Number.parseInt(m[4], 10) : 1;

      let baseLine = baseStart;
      let headLine = headStart;
      const added: Array<{ lineNumber: number; content: string }> = [];
      const removed: Array<{ lineNumber: number; content: string }> = [];

      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('@@')) {
        const l = lines[i] ?? '';
        if (l.startsWith('+')) {
          added.push({ lineNumber: headLine, content: l.slice(1) });
          headLine++;
        } else if (l.startsWith('-')) {
          removed.push({ lineNumber: baseLine, content: l.slice(1) });
          baseLine++;
        } else if (l.startsWith(' ')) {
          baseLine++;
          headLine++;
        } else if (l.startsWith('diff ')) {
          break;
        }
        i++;
      }

      hunks.push({
        file: filePath,
        baseRange: { start: baseStart, end: baseStart + Math.max(baseLen - 1, 0) },
        headRange: { start: headStart, end: headStart + Math.max(headLen - 1, 0) },
        addedLines: added,
        removedLines: removed,
      });
      continue;
    }
    i++;
  }
  return hunks;
}

/**
 * Checks if a file has any diffs between two git refs.
 * @param filePath The path to the file to check.
 * @param baseRef The git ref for the base version.
 * @param headRef The git ref for the head version.
 * @returns True if the file has diffs, false otherwise.
 */
export function hasDiffs(filePath: string, baseRef: string, headRef: string): boolean {
  try {
    const safeRefA = /^[A-Za-z0-9._:\/\-~^]+$/.test(baseRef) ? baseRef : '';
    const safeRefB = /^[A-Za-z0-9._:\/\-~^]+$/.test(headRef) || headRef === '.' ? headRef : '';
    const safePath = /^[A-Za-z0-9._\/#\-]+$/.test(filePath) ? filePath : '';
    if (safeRefA && safeRefB && safePath) {
      const args = ['diff', '--unified=0', safeRefA];
      if (safeRefB !== '.') {
        args.push(safeRefB);
      }
      args.push('--', safePath);
      const res = gitRunner(args);
      // Check for the presence of hunk markers
      if (res.status === 0 && typeof res.stdout === 'string' && res.stdout.includes('@@')) {
        return true;
      }
    }
  } catch (error) {
    logger.debug(
      `Error checking for diffs in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false; // If git fails, assume no diff to be safe and avoid processing
  }
  return false;
}

/**
 * Defines the shape of the command-line options for the CLI.
 */
export interface AnalysisOptions {
  /** The git ref for the base version (e.g., main, sha). */
  baseRef: string;
  /** The git ref for the head version (e.g., feature-branch, sha). */
  headRef: string;
  /** A list of file paths to analyze. */
  files: string[];
  /** The desired output format. */
  outputFormat: 'json' | 'github-actions' | 'console' | 'machine';
  /** The path to write JSON output to. */
  outputFile?: string;
  /** Flag to enable maximum debug logging. */
  debug?: boolean;
  /** Flag to suppress all output except for exit codes. */
  quiet?: boolean;
  /** The timeout in milliseconds for analyzing a single file. */
  timeoutMs?: number;
  /** Whether to show help. */
  help?: boolean;
  /** Whether to read file paths from stdin. */
  stdin?: boolean;
  /** Path to a custom analyzer configuration file. */
  configPath?: string;
}

/**
 * The default configuration for the semantic analyzer.
 * This is used when no custom config is provided.
 */
const DEFAULT_CONFIG: AnalyzerConfig = {
  include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  exclude: ['node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts', 'dist/**', 'build/**'],
  sideEffectCallees: [
    'console.*',
    'fetch',
    '*.api.*',
    '*.service.*',
    'track*',
    'log*',
    'analytics.*',
    'gtag',
    'dataLayer.*',
  ],
  testGlobs: ['**/*.test.*', '**/*.spec.*'],
  bypassLabels: ['skip-tests', 'docs-only', 'trivial'],
  timeoutMs: 120000,
};

/**
 * The main function to run the semantic analysis process.
 * It coordinates file filtering, concurrent analysis, and result processing.
 * @param options The analysis options parsed from the command line.
 * @returns A promise that resolves with the final analysis result.
 */
export async function runSemanticAnalysis(options: AnalysisOptions): Promise<AnalysisResult> {
  const effectiveConfig = loadConfig(options); // Load config here

  const startTime = Date.now();
  const initialMemory = getMemoryUsage();

  logger.verbose('Starting semantic change analysis...');
  logger.verbose(`Analyzing ${options.files.length} files concurrently...`);
  logger.verbose(`Comparing ${options.baseRef} -> ${options.headRef}`);

  const allChanges: AnalyzedChange[] = [];
  const failedFiles: Array<{ filePath: string; error: string }> = [];
  let filesAnalyzed = 0;

  const filesToAnalyzeInitially = options.files.filter(
    (file) => shouldAnalyzeFile(file, effectiveConfig), // Use effectiveConfig
  );
  logger.verbose(
    `Filtered down to ${filesToAnalyzeInitially.length} files based on include/exclude rules.`,
  );

  // Early exit for files with no diffs
  const filesWithDiffs: string[] = [];
  for (const file of filesToAnalyzeInitially) {
    try {
      if (hasDiffs(file, options.baseRef, options.headRef)) {
        filesWithDiffs.push(file);
      } else {
        logger.verbose(`Skipping ${file} (no diffs)`);
      }
    } catch (error) {
      logger.debug(
        `Error checking diffs for ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
      failedFiles.push({
        filePath: file,
        error: `Diff check failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  logger.verbose(`Filtered down to ${filesWithDiffs.length} files that have diffs.`);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const workerScript = path.resolve(__dirname, 'worker.js');

  const tasks = filesWithDiffs.map((file) => ({
    filePath: file,
    baseRef: options.baseRef,
    headRef: options.headRef,
    config: effectiveConfig, // Use effectiveConfig
  }));

  try {
    const results = await mapConcurrent<
      (typeof tasks)[number],
      { status: string; filePath: string; changes?: FileChange[]; error?: string }
    >(
      tasks,
      workerScript,
      undefined, // Use default concurrency
      options.timeoutMs,
    );

    for (const result of results) {
      if (result.status === 'success' && result.changes) {
        logger.verbose(
          `Successfully analyzed ${result.filePath} - Found ${result.changes.length} changes`,
        );
        allChanges.push(...result.changes.map((change) => ({ ...change, file: result.filePath })));
        filesAnalyzed++;
      } else {
        logger.debug(`Error analyzing ${result.filePath}: ${result.error}`);
        failedFiles.push({
          filePath: result.filePath,
          error: result.error || 'Unknown analysis error',
        });
      }
    }
  } catch (error) {
    logger.debug(
      `A worker failed catastrophically: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const analysisTime = Date.now() - startTime;
  const finalMemory = getMemoryUsage();

  logger.verbose(`Analysis completed in ${analysisTime}ms`);
  logger.verbose(`Total changes found: ${allChanges.length}`);

  const result = processAnalysisResults(allChanges, filesAnalyzed, failedFiles, {
    analysisTimeMs: analysisTime,
    memoryUsageMB: finalMemory - initialMemory,
  });

  await outputResults(result, options);

  return result;
}

/** A type representing a semantic change that has been associated with its file path. */
type AnalyzedChange = FileChange & { file: string };

/**
 * Checks if a file should be analyzed based on the include/exclude globs in the config.
 * @param filePath The path to the file to check.
 * @param config The analyzer configuration.
 * @returns True if the file should be analyzed, false otherwise.
 */
function shouldAnalyzeFile(filePath: string, config: AnalyzerConfig): boolean {
  const included = config.include.some((glob) => minimatch(filePath, glob, { dot: true }));
  if (!included) return false;
  const excluded = config.exclude.some((glob) => minimatch(filePath, glob, { dot: true }));
  if (excluded) return false;
  return true;
}

/**
 * Processes the raw list of changes to generate a structured analysis result.
 * @param changes The flat list of all detected changes.
 * @param filesAnalyzed The number of files that were successfully analyzed.
 * @param performance An object containing performance metrics.
 * @returns A structured analysis result.
 */
function processAnalysisResults(
  changes: AnalyzedChange[],
  filesAnalyzed: number,
  failedFiles: Array<{ filePath: string; error: string }>,
  performance: { analysisTimeMs: number; memoryUsageMB: number },
): AnalysisResult {
  const severityBreakdown: AnalysisResult['severityBreakdown'] = {
    high: changes.filter((c) => c.severity === 'high').length,
    medium: changes.filter((c) => c.severity === 'medium').length,
    low: changes.filter((c) => c.severity === 'low').length,
  };

  const changeTypeCounts: Record<string, { count: number; maxSeverity: SeverityLevel }> = {};
  for (const change of changes) {
    const key = change.kind;
    const entry = changeTypeCounts[key] ?? { count: 0, maxSeverity: 'low' };
    entry.count += 1;
    const level = { low: 0, medium: 1, high: 2 } as const;
    if (level[change.severity] > level[entry.maxSeverity]) {
      entry.maxSeverity = change.severity;
    }
    changeTypeCounts[key] = entry;
  }

  const changeKeys = Object.keys(changeTypeCounts);
  const topChangeTypes = changeKeys
    .map((k) => [k, changeTypeCounts[k]] as const)
    .filter((pair): pair is readonly [string, { count: number; maxSeverity: SeverityLevel }] =>
      Boolean(pair[1]),
    )
    .map(([kind, data]) => ({ kind, count: data.count, maxSeverity: data.maxSeverity }))
    .sort((a, b) => b.count - a.count);

  const requiresTests = shouldRequireTests(changes);

  const criticalChanges = changes.filter((change) => change.severity === 'high').slice(0, 20);

  const hasReactChanges = changes.some(
    (change) =>
      change.kind.includes('jsx') ||
      change.kind.includes('hook') ||
      change.kind.includes('component'),
  );

  const summary = generateSummary(changes, severityBreakdown, requiresTests);

  return {
    requiresTests,
    summary,
    filesAnalyzed,
    totalChanges: changes.length,
    severityBreakdown,
    highSeverityChanges: severityBreakdown.high,
    topChangeTypes,
    criticalChanges,
    changes,
    failedFiles,
    hasReactChanges,
    performance,
  };
}

/**
 * Determines if tests should be required based on the detected changes.
 * @param changes The list of detected semantic changes.
 * @returns True if tests are required, false otherwise.
 */
function shouldRequireTests(changes: AnalyzedChange[]): boolean {
  const highSeverityChanges = changes.filter((c) => c.severity === 'high');
  if (highSeverityChanges.length === 0) {
    return false;
  }

  const testRequiringPatterns = [
    'functionSignatureChanged',
    'functionRemoved',
    'exportRemoved',
    'exportAdded', // Added to require tests for new exports
    'exportSignatureChanged',
    'hookDependencyChanged',
    'functionCallAdded',
    'classStructureChanged',
  ];

  return highSeverityChanges.some((change) => testRequiringPatterns.includes(change.kind));
}

/**
 * Generates a human-readable summary string of the analysis results.
 * @param changes The list of detected changes.
 * @param severityBreakdown An object with the count of changes per severity.
 * @param requiresTests A boolean indicating if tests are required.
 * @returns A summary string.
 */
function generateSummary(
  changes: AnalyzedChange[],
  severityBreakdown: { high: number; medium: number; low: number },
  requiresTests: boolean,
): string {
  if (changes.length === 0) {
    return 'No semantic changes detected';
  }

  const parts = [
    `${changes.length} semantic changes detected`,
    `${severityBreakdown.high} high-severity`,
    `${severityBreakdown.medium} medium-severity`,
    `${severityBreakdown.low} low-severity`,
  ];

  if (requiresTests) {
    parts.push('Tests required');
  } else {
    parts.push('No tests required');
  }

  return parts.join(', ');
}

/**
 * Outputs the analysis results in the specified format.
 * @param result The structured analysis result.
 * @param options The command-line options.
 */
async function outputResults(result: AnalysisResult, options: AnalysisOptions): Promise<void> {
  const outputFile = options.outputFile || 'semantic-analysis-results.json';

  switch (options.outputFormat) {
    case 'machine': {
      logger.machine(JSON.stringify(result, null, 2));
      break;
    }
    case 'json': {
      await fs.promises.writeFile(outputFile, JSON.stringify(result, null, 2), 'utf8');
      logger.verbose(`Results written to ${outputFile}`);
      break;
    }
    case 'github-actions': {
      // Write JSON result file for reference
      await fs.promises.writeFile(outputFile, JSON.stringify(result, null, 2), 'utf8');

      // Format and output GitHub Actions annotations to stdout
      const annotations = formatForGitHubActions(result);
      for (const annotation of annotations) {
        logger.output(annotation);
      }

      // Write summary information as logs (to stderr in GitHub Actions mode)
      logger.verbose(`::group::Analysis Results`);
      logger.verbose(`Files analyzed: ${result.filesAnalyzed}`);
      logger.verbose(`Total changes: ${result.totalChanges}`);
      logger.verbose(`High severity: ${result.severityBreakdown.high}`);
      logger.verbose(`Medium severity: ${result.severityBreakdown.medium}`);
      logger.verbose(`Low severity: ${result.severityBreakdown.low}`);
      logger.verbose(`Tests required: ${result.requiresTests}`);
      logger.verbose(`::endgroup::`);

      if (result.failedFiles.length > 0) {
        logger.verbose(`::error::Failed to analyze ${result.failedFiles.length} files:`);
        result.failedFiles.forEach((file) => {
          logger.verbose(`::error file=${file.filePath}::${file.error}`);
        });
      }

      if (result.requiresTests) {
        logger.verbose(
          `::warning::Tests required due to ${result.highSeverityChanges} high-severity changes`,
        );
      }
      writeGitHubOutputFlag(result.requiresTests);
      break;
    }
    case 'console': {
      logger.verbose('\nAnalysis Results:');
      logger.verbose(`   Files analyzed: ${result.filesAnalyzed}`);
      logger.verbose(`   Total changes: ${result.totalChanges}`);
      logger.verbose(`   High severity: ${result.severityBreakdown.high}`);
      logger.verbose(`   Medium severity: ${result.severityBreakdown.medium}`);
      logger.verbose(`   Low severity: ${result.severityBreakdown.low}`);
      logger.verbose(`   Tests required: ${result.requiresTests ? 'Yes' : 'No'}`);

      if (result.failedFiles.length > 0) {
        logger.verbose(`\nFailed to analyze ${result.failedFiles.length} files:`);
        result.failedFiles.forEach((file) => {
          logger.verbose(`   - ${file.filePath}: ${file.error}`);
        });
      }

      if (result.topChangeTypes.length > 0) {
        logger.verbose('\nTop change types:');
        result.topChangeTypes.slice(0, 5).forEach((change) => {
          logger.verbose(`   ${change.kind}: ${change.count} (${change.maxSeverity})`);
        });
      }
      break;
    }
  }
}

/**
 * Gets the current memory usage of the process.
 * @returns The heap usage in megabytes.
 */
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  }
  return 0;
}

/**
 * Writes the `requires-tests` output for GitHub Actions.
 * @param requiresTests A boolean indicating if tests are required.
 */
export function writeGitHubOutputFlag(requiresTests: boolean): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  try {
    fs.appendFileSync(outputPath, `requires-tests=${requiresTests}\n`);
  } catch {
    // ignore write errors in read-only contexts
  }
}

/**
 * Loads the analyzer configuration from a file, merging with default settings.
 * @param options The analysis options, potentially containing a custom config path.
 * @returns The merged AnalyzerConfig.
 */
function loadConfig(options: AnalysisOptions): AnalyzerConfig {
  let configPath: string;
  if (options.configPath) {
    configPath = path.resolve(process.cwd(), options.configPath);
  } else {
    configPath = path.join(process.cwd(), '.semantic-change-detector.json');
  }
  let loadedConfig: Partial<AnalyzerConfig> = {};

  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      loadedConfig = JSON.parse(configContent);
      logger.verbose(`Loaded configuration from ${configPath}`);
    } catch (error) {
      logger.debug(
        `Failed to load configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    logger.verbose(`No custom configuration file found at ${configPath}. Using default settings.`);
  }

  return { ...DEFAULT_CONFIG, ...loadedConfig };
}
