import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type ChangeKindEntry = {
  name: string;
  tag: string;
  description: string;
  line: number; // 1-indexed line number in the source file
};

export const SOURCE_RELATIVE_PATH = 'src/types/semantic-change-kind.ts';

export function normalizeJsDoc(blockInner: string): string {
  const lines = blockInner.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trimStart();
    const withoutStar = trimmed.startsWith('*') ? trimmed.slice(1).replace(/^\s?/, '') : trimmed;
    cleaned.push(withoutStar.replace(/\s+$/u, ''));
  }
  while (cleaned.length > 0) {
    const first = cleaned[0];
    if (first !== undefined && first.trim() === '') cleaned.shift();
    else break;
  }
  while (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    if (last !== undefined && last.trim() === '') cleaned.pop();
    else break;
  }
  return cleaned.join('\n');
}

export function extractTypeBody(
  source: string,
  typeDecl: string,
): { body: string; startOffset: number } {
  const startIndex = source.indexOf(typeDecl);
  if (startIndex === -1) throw new Error(`Could not find type declaration: ${typeDecl}`);
  const braceStart = source.indexOf('{', startIndex);
  if (braceStart === -1) throw new Error('Opening brace for type literal not found');
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0)
        return { body: source.slice(braceStart + 1, i), startOffset: braceStart + 1 };
    }
  }
  throw new Error('Matching closing brace for type literal not found');
}

function getLineFromOffset(source: string, absOffset: number): number {
  let line = 1;
  for (let i = 0; i < source.length && i < absOffset; i += 1)
    if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

export function parseSemanticChangeKind(
  source: string,
  body: string,
  bodyStartOffset: number,
): ChangeKindEntry[] {
  const entries: ChangeKindEntry[] = [];
  const pairRe = /\/\*\*([\s\S]*?)\*\/\s*([a-zA-Z_][\w]*)\s*:\s*'([^']+)'\s*;/gu;
  let match: RegExpExecArray | null;
  while ((match = pairRe.exec(body)) !== null) {
    const docRaw = match[1] ?? '';
    const name = (match[2] ?? '').trim();
    const tag = (match[3] ?? '').trim();
    if (name.length === 0 || tag.length === 0) continue;
    const description = normalizeJsDoc(docRaw);
    const localOffset = match.index ?? 0;
    const absOffset = bodyStartOffset + localOffset;
    const line = getLineFromOffset(source, absOffset);
    entries.push({ name, tag, description, line });
  }
  return entries;
}

export function renderMarkdown(entries: ChangeKindEntry[]): string {
  const now = new Date().toISOString();
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const header =
    `# SemanticChangeKind Reference\n\n` +
    `This document is generated from \`${SOURCE_RELATIVE_PATH}\` and describes each \`SemanticChangeKind\` entry and its emitted tag.\n\n`;
  const toc = sorted.map((e) => `- [${e.name}](#${e.name.toLowerCase()})`).join('\n');
  const sections = sorted
    .map((e) => {
      const desc = e.description.length > 0 ? `\n\n${e.description}\n` : '';
      const sourceLink = `/${SOURCE_RELATIVE_PATH}#L${e.line}`;
      return `## ${e.name}\n\n- Tag: \`${e.tag}\`\n- Source: [${sourceLink}](${sourceLink})${desc}`;
    })
    .join('\n');
  const footer = `\n---\n\nMeta\n\n- Total kinds: ${sorted.length}\n- Generated on: ${now}\n- Generator: \`src/tools/generate-semantic-change-kind-docs.ts\``;
  return `${header}## Index\n\n${toc}\n\n${sections}\n${footer}\n`;
}

export async function loadKindEntriesFromSource(): Promise<ChangeKindEntry[]> {
  const projectRoot = resolve(process.cwd());
  const srcPath = resolve(projectRoot, SOURCE_RELATIVE_PATH);
  const source = await readFile(srcPath, 'utf8');
  const { body, startOffset } = extractTypeBody(source, 'export type SemanticChangeKind');
  return parseSemanticChangeKind(source, body, startOffset);
}
