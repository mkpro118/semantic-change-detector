#!/usr/bin/env bun

import { expect } from 'bun:test';
import { readFile } from 'fs/promises';
import path from 'path';

export interface ChangeShape {
  kind: string;
  severity: 'low' | 'medium' | 'high';
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  context?: string;
}

export interface FixturePair {
  basePath: string;
  modifiedPath: string;
  baseCode: string;
  modifiedCode: string;
}

export async function loadFixturePair(
  fixtureDir: string,
  modifiedFile: string = 'modified.ts',
): Promise<FixturePair> {
  const root = path.resolve(path.join(import.meta.dir, '..', 'fixtures', fixtureDir));
  const basePath = path.join(root, 'base.ts');
  const modifiedPath = path.join(root, modifiedFile);
  const [baseCode, modifiedCode] = await Promise.all([
    readFile(basePath, 'utf8'),
    readFile(modifiedPath, 'utf8'),
  ]);
  return { basePath, modifiedPath, baseCode, modifiedCode };
}

export function findLineOf(source: string, needle: string): number {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1; // 1-indexed
  }
  return -1;
}

export function assertHasChange(
  changes: ChangeShape[],
  predicate: (c: ChangeShape) => boolean,
  message?: string,
): ChangeShape {
  const match = changes.find(predicate);
  expect(match, message ?? 'Expected change not found').toBeTruthy();
  return match as ChangeShape;
}

export function assertNoChange(
  changes: ChangeShape[],
  predicate: (c: ChangeShape) => boolean,
  message?: string,
): void {
  const match = changes.find(predicate);
  expect(match, message ?? 'Unexpected change found').toBeUndefined();
}

export function expectValidLocation(change: ChangeShape): void {
  expect(change.startLine).toBeGreaterThan(0);
  expect(change.endLine).toBeGreaterThanOrEqual(change.startLine);
  expect(change.startColumn).toBeGreaterThanOrEqual(0);
  expect(change.endColumn).toBeGreaterThanOrEqual(change.startColumn);
}
