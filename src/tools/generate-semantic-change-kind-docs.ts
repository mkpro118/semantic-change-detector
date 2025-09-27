/* eslint-disable no-console */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadKindEntriesFromSource, renderMarkdown } from './lib/semantic-kind-util.js';

async function main(): Promise<void> {
  const projectRoot = resolve(process.cwd());
  const outDir = resolve(projectRoot, 'docs');
  const outFile = resolve(outDir, 'semantic-change-kind.md');

  const entries = await loadKindEntriesFromSource();
  if (entries.length === 0) throw new Error('No entries parsed for SemanticChangeKind');
  const md = renderMarkdown(entries);
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, md, 'utf8');
  console.log(`Generated documentation: ${outFile}`);
}

// Execute
main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
