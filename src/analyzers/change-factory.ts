/**
 * Module: Change Factory
 *
 * Responsibility
 * - Provide a small, typed helper to construct
 *   `LocatedSemanticChange` objects consistently.
 *
 * Expected Output
 * - A single `createChange` function that returns a fully
 *   populated `LocatedSemanticChange` record with file and
 *   AST location metadata.
 */
import type { SemanticChangeType, SeverityLevel } from '../types/index';
import type { LocatedSemanticChange } from './types';

export function createChange(
  kind: SemanticChangeType,
  severity: SeverityLevel,
  detail: string,
  context: string,
  filePath: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  astNode: string,
): LocatedSemanticChange {
  return {
    kind,
    severity,
    line: startLine,
    column: startColumn,
    detail,
    astNode,
    context,
    filePath,
    startLine,
    startColumn,
    endLine,
    endColumn,
  };
}
