/**
 * @file GitHub Actions output formatter for semantic change analysis results.
 * Formats analysis results as GitHub Actions workflow commands for file annotations.
 */

import type { AnalysisResult, SeverityLevel } from '../types/index.js';

/**
 * GitHubActionsAnnotationType represents the three annotation severities
 * supported by GitHub Actions workflow commands.
 */
type GitHubActionsAnnotationType = 'notice' | 'warning' | 'error';

/**
 * A single GitHub Actions annotation record used to surface analysis
 * results in CI. This maps our change metadata to the workflow command
 * format supported by the GitHub runner.
 *
 * Fields
 * - type — notice | warning | error mapped from severity.
 * - file — Path relative to repo root.
 * - line/endLine — 1-indexed lines to annotate.
 * - title — Short classification (e.g., change kind).
 * - message — Detailed, human-readable explanation.
 *
 * @library-export
 * @public
 */
export type GitHubActionsAnnotation = {
  /** notice | warning | error derived from severity. */
  type: GitHubActionsAnnotationType;
  /** File path (relative to repo). */
  file: string;
  /** 1-indexed line to annotate. */
  line: number;
  /** Optional 1-indexed end line (range). */
  endLine?: number;
  /** Short label for the annotation (e.g., change kind). */
  title: string;
  /** Detailed, human-readable message body. */
  message: string;
};

/**
 * Maps semantic change severity levels to GitHub Actions annotation types.
 * @param severity The severity level from semantic analysis
 * @returns The corresponding GitHub Actions annotation type
 */
export function mapSeverityToAnnotationType(severity: SeverityLevel): GitHubActionsAnnotationType {
  switch (severity) {
    case 'low':
      return 'notice';
    case 'medium':
      return 'warning';
    case 'high':
      return 'error';
    default:
      return 'notice';
  }
}

/**
 * Formats a single annotation as a GitHub Actions workflow command.
 * @param annotation The annotation to format
 * @returns The formatted GitHub Actions workflow command string
 */
export function formatAnnotation(annotation: GitHubActionsAnnotation): string {
  const { type, file, line, endLine, title, message } = annotation;

  // Escape special characters in title and message
  // Only escape double colons (GitHub Actions command separator) and newlines
  const escapedTitle = title.replace(/::/g, '%3A%3A').replace(/\r?\n/g, '%0A');
  const escapedMessage = message.replace(/::/g, '%3A%3A').replace(/\r?\n/g, '%0A');

  // Build the annotation command
  let command = `::${type} file=${file},line=${line}`;

  if (endLine !== undefined) {
    command += `,endLine=${endLine}`;
  }

  command += `,title=${escapedTitle}::${escapedMessage}`;

  return command;
}

/**
 * Converts analysis results to GitHub Actions annotations.
 * @param result The analysis result to convert
 * @returns Array of GitHub Actions annotations
 */
export function convertToAnnotations(result: AnalysisResult): GitHubActionsAnnotation[] {
  return result.changes.map((change) => ({
    type: mapSeverityToAnnotationType(change.severity),
    file: change.file,
    line: change.line,
    title: change.kind,
    message: change.detail,
  }));
}

/**
 * Formats analysis results as GitHub Actions workflow commands.
 * Each change becomes an annotation with proper severity mapping.
 * @param result The analysis result to format
 * @returns Array of formatted GitHub Actions workflow command strings
 */
export function formatForGitHubActions(result: AnalysisResult): string[] {
  const annotations = convertToAnnotations(result);
  return annotations.map(formatAnnotation);
}
