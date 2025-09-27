/* eslint-disable no-console */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  loadKindEntriesFromSource,
  renderMarkdown,
  SOURCE_RELATIVE_PATH,
} from './lib/semantic-kind-util.js';

async function readDocNames(docPath: string): Promise<Set<string>> {
  try {
    const text = await readFile(docPath, 'utf8');
    const names = new Set<string>();
    for (const line of text.split(/\r?\n/)) {
      const m = /^##\s+([a-zA-Z_][\w]*)\s*$/.exec(line);
      if (m) {
        const name = m[1];
        if (typeof name === 'string' && name.length > 0) names.add(name);
      }
    }
    return names;
  } catch {
    return new Set<string>();
  }
}

async function main(): Promise<void> {
  const projectRoot = resolve(process.cwd());
  const outDir = resolve(projectRoot, 'docs');
  const outFile = resolve(outDir, 'semantic-change-kind.md');

  const entries = await loadKindEntriesFromSource();
  if (entries.length === 0) throw new Error('No entries parsed for SemanticChangeKind');

  const codeNames = new Set(entries.map((e) => e.name));
  const docNames = await readDocNames(outFile);

  // Only regenerate when there are new variants (names present in code but not in docs)
  let hasNew = false;
  for (const name of codeNames) {
    if (!docNames.has(name)) {
      hasNew = true;
      break;
    }
  }

  if (!hasNew) {
    console.log('[docs] No new SemanticChangeKind variants; skipping generation');
    return;
  }

  const md = renderMarkdown(entries);
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, md, 'utf8');
  console.log(`[docs] New variants detected; docs regenerated from ${SOURCE_RELATIVE_PATH}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
