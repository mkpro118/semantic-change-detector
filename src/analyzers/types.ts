import type { SemanticChange as BaseSemanticChange } from '../types/index';

/**
 * Represents a semantic change with file/position metadata, extending
 * the base {@link SemanticChange}. Includes path and start/end
 * positions for richer editor and CI annotations.
 *
 * @library-export
 * @public
 */
export type LocatedSemanticChange = BaseSemanticChange & {
  /** The path to the file where the change was detected. */
  filePath: string;
  /** The starting line number of the change in the modified file (1-indexed). */
  startLine: number;
  /** The starting column number of the change in the modified file (0-indexed). */
  startColumn: number;
  /** The ending line number of the change in the modified file (1-indexed). */
  endLine: number;
  /** The ending column number of the change in the modified file (0-indexed). */
  endColumn: number;
};

/**
 * Input parameters for semantic change detection functions that compare
 * two versions of a single file.
 *
 * @library-export
 * @public
 */
export type AnalyzeFileParams = {
  /** The absolute path to the base version of the file. */
  baseFilePath: string;
  /** The content of the base version of the file. */
  baseCode: string;
  /** The absolute path to the modified version of the file. */
  modifiedFilePath: string;
  /** The content of the modified version of the file. */
  modifiedCode: string;
  /** Optional analyzer configuration */
  config?: {
    /** Callee patterns considered side-effectful. */
    sideEffectCallees?: string[];
    /** Glob patterns for test files. */
    testGlobs?: string[];
    /** Labels that permit skipping tests. */
    bypassLabels?: string[];
  };
};

/**
 * Analyzes changes in function signatures between two versions of a file.
 *
 * @param params - An object containing the base and modified file paths and their respective code contents.
 * @returns A promise that resolves to an array of detected function signature changes.
 */
/**
 * Detect function signature changes between two file versions.
 * @library-export
 * @public
 */
export declare function analyzeFunctionSignatureChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]>;

/**
 * Analyzes changes in type definitions between two versions of a file.
 *
 * @param params - An object containing the base and modified file paths and their respective code contents.
 * @returns A promise that resolves to an array of detected type definition changes.
 */
/**
 * Detect type alias/interface definition changes between versions.
 * @library-export
 * @public
 */
export declare function analyzeTypeDefinitionChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]>;

/**
 * Analyzes changes in function calls (e.g., argument count, order) between two versions of a file.
 *
 * @param params - An object containing the base and modified file paths and their respective code contents.
 * @returns A promise that resolves to an array of detected function call changes.
 */
/**
 * Detect behavioral changes at function/constructor call sites.
 * @library-export
 * @public
 */
export declare function analyzeFunctionCallChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]>;

/**
 * Analyzes changes in import structures (e.g., reordering, specifier changes) between two versions of a file.
 *
 * @param params - An object containing the base and modified file paths and their respective code contents.
 * @returns A promise that resolves to an array of detected import structure changes.
 */
/**
 * Detect import structure changes (specifiers/side-effect order).
 * @library-export
 * @public
 */
export declare function analyzeImportStructureChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]>;

/**
 * The main function for detecting all semantic changes between two versions of a TypeScript/JavaScript file.
 * This function orchestrates calls to individual analysis functions.
 *
 * @param params - An object containing the base and modified file paths and their respective code contents.
 * @returns A promise that resolves to an array of all detected semantic changes with locations.
 */
/**
 * Aggregate all analyzer results in one pass.
 * @library-export
 * @public
 */
export declare function detectSemanticChanges(
  params: AnalyzeFileParams,
): Promise<LocatedSemanticChange[]>;

// Intentionally not re-exported here; available from src/types/index
