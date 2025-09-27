#!/usr/bin/env bun

import { describe, test, expect } from 'bun:test';
import path from 'path';

import {
  analyzeFunctionSignatureChanges,
  analyzeTypeDefinitionChanges,
  analyzeFunctionCallChanges,
  analyzeImportStructureChanges,
  detectSemanticChanges,
} from '../../src/analyzers/index.js';

import {
  loadFixturePair,
  assertHasChange,
  assertNoChange,
  findLineOf,
  expectValidLocation,
  type ChangeShape,
} from './_helpers.ts';

describe('Analyzer core scenarios', () => {
  describe('Function signature changes', () => {
    test('detects parameter removal from destructured signature (HIGH)', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } = await loadFixturePair(
        'function-signature-changes',
      );

      const changes = await analyzeFunctionSignatureChanges({
        baseFilePath: basePath,
        baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      const change = assertHasChange(
        changes,
        (c) => c.kind === 'functionSignatureChanged' && c.severity === 'high',
        'Expected high-severity functionSignatureChanged',
      );

      expect(change.filePath).toBe(modifiedPath);
      const expectedLine = findLineOf(
        modifiedCode,
        'export async function getScheduledTimeForUser',
      );
      expect(change.startLine).toBe(expectedLine);
      expectValidLocation(change);
      expect(change.context && change.context.length).toBeGreaterThan(0);
      expect(change.context ?? '').toContain('localTimezone');
    });
  });

  describe('Type definition changes', () => {
    test('detects property removal in type alias (MEDIUM)', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } =
        await loadFixturePair('type-definition-changes');

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: basePath,
        baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      const change = assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged' && c.severity === 'medium',
        'Expected medium-severity typeDefinitionChanged',
      );

      expect(change.filePath).toBe(modifiedPath);
      const expectedLine = findLineOf(modifiedCode, 'type ScheduledTimeBaseInputs');
      expect(change.startLine).toBe(expectedLine);
      expectValidLocation(change);
      expect(change.context && change.context.length).toBeGreaterThan(0);
      expect(change.context ?? '').toContain('localTimezone');
    });

    test('detects union expansion as type change (MEDIUM)', async () => {
      const base = await loadFixturePair('type-definition-changes');
      const modifiedPath = path.join(path.dirname(base.modifiedPath), 'modified-union-expanded.ts');
      const modifiedCode = await Bun.file(modifiedPath).text();

      const changes = await analyzeTypeDefinitionChanges({
        baseFilePath: base.basePath,
        baseCode: base.baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      assertHasChange(
        changes,
        (c) => c.kind === 'typeDefinitionChanged' && c.severity === 'medium',
        'Expected medium-severity typeDefinitionChanged for union expansion',
      );
    });
  });

  describe('Function call changes', () => {
    test('detects argument removal in call expression (HIGH)', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } =
        await loadFixturePair('function-call-changes');

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: basePath,
        baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      const change = assertHasChange(
        changes,
        (c) => c.kind === 'functionCallChanged' && c.severity === 'high',
        'Expected high-severity functionCallChanged',
      );

      expect(change.filePath).toBe(modifiedPath);
      const expectedLine = findLineOf(modifiedCode, 'computeOverridesForAppointments(');
      expect(change.startLine).toBe(expectedLine);
      expectValidLocation(change);
      expect(change.context && change.context.length).toBeGreaterThan(0);
    });

    test('ignores trailing undefined removal (no-op)', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } = await loadFixturePair(
        'function-call-changes-trailing-undefined',
      );

      const changes = await analyzeFunctionCallChanges({
        baseFilePath: basePath,
        baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      assertNoChange(
        changes,
        (c) => c.kind === 'functionCallChanged',
        'Trailing undefined removal should not be flagged',
      );
    });
  });

  describe('Import structure changes', () => {
    test('ignores pure reordering with no runtime impact', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } =
        await loadFixturePair('import-structure');

      const changes = await analyzeImportStructureChanges({
        baseFilePath: basePath,
        baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      expect(Array.isArray(changes)).toBe(true);
      expect(changes.length).toBe(0);
    });

    test('detects specifier additions as low severity', async () => {
      const base = await loadFixturePair('import-structure');
      const modifiedPath = path.join(
        path.dirname(base.modifiedPath),
        'modified-specifier-change.ts',
      );
      const modifiedCode = await Bun.file(modifiedPath).text();

      const changes = await analyzeImportStructureChanges({
        baseFilePath: base.basePath,
        baseCode: base.baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      const change = assertHasChange(
        changes,
        (c) => c.kind === 'importStructureChanged' && c.severity === 'low',
        'Expected low-severity importStructureChanged (specifier addition)',
      );
      expect(change.filePath).toBe(modifiedPath);
      expectValidLocation(change);
    });
  });

  describe('Integration: combined real-world synthetic case', () => {
    test('detects multiple changes with proper severities', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } =
        await loadFixturePair('real-world-synthetic');

      const changes = await detectSemanticChanges({
        baseFilePath: basePath,
        baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });

      const kinds = new Set(changes.map((c) => c.kind));
      const severities = changes.map((c) => c.severity);

      expect(kinds.has('functionSignatureChanged')).toBe(true);
      expect(kinds.has('functionCallChanged')).toBe(true);
      expect(kinds.has('typeDefinitionChanged')).toBe(true);
      expect(severities.filter((s) => s === 'high').length).toBeGreaterThanOrEqual(2);
      expect(severities.includes('medium')).toBe(true);

      expect(changes.some((c) => c.kind === 'importStructureChanged')).toBe(false);
    });
  });

  describe('Negatives and edge cases', () => {
    test('formatting-only changes are ignored', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } = await loadFixturePair(
        'negatives-and-edges/formatting-only',
      );

      const [sig, types, calls, imports] = await Promise.all([
        analyzeFunctionSignatureChanges({
          baseFilePath: basePath,
          baseCode,
          modifiedFilePath: modifiedPath,
          modifiedCode,
        }),
        analyzeTypeDefinitionChanges({
          baseFilePath: basePath,
          baseCode,
          modifiedFilePath: modifiedPath,
          modifiedCode,
        }),
        analyzeFunctionCallChanges({
          baseFilePath: basePath,
          baseCode,
          modifiedFilePath: modifiedPath,
          modifiedCode,
        }),
        analyzeImportStructureChanges({
          baseFilePath: basePath,
          baseCode,
          modifiedFilePath: modifiedPath,
          modifiedCode,
        }),
      ]);

      expect(sig.length).toBe(0);
      expect(types.length).toBe(0);
      expect(calls.length).toBe(0);
      expect(imports.length).toBe(0);
    });

    test('empty/comment-only files produce no changes', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } = await loadFixturePair(
        'negatives-and-edges/empty-or-comments',
      );

      const changes = await detectSemanticChanges({
        baseFilePath: basePath,
        baseCode,
        modifiedFilePath: modifiedPath,
        modifiedCode,
      });
      expect(Array.isArray(changes)).toBe(true);
      expect(changes.length).toBe(0);
    });

    test('syntax errors do not crash analyzer', async () => {
      const { basePath, modifiedPath, baseCode, modifiedCode } = await loadFixturePair(
        'negatives-and-edges/syntax-error',
      );

      let changes: ChangeShape[] = [];
      let failed = false;
      try {
        changes = await detectSemanticChanges({
          baseFilePath: basePath,
          baseCode,
          modifiedFilePath: modifiedPath,
          modifiedCode,
        });
      } catch (_err) {
        failed = true;
      }

      expect(failed).toBe(false);
      expect(Array.isArray(changes)).toBe(true);
    });
  });
});
