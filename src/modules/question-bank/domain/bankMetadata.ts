import { maskComments, readGroup } from './latex';
import type { BankSnapshot } from './model';
/** Records references without claiming their files were copied or verified. */
export function withBankMetadata(snapshot: BankSnapshot, before?: BankSnapshot): BankSnapshot {
  const knownNames = new Set(snapshot.tagDefinitions.map((t) => t.name));
  const tags = [...snapshot.tagDefinitions],
    assets = [...snapshot.assets];
  const knownAssets = new Set(assets.map((a) => `${a.questionId}\n${a.relativePath}`));
  const old = new Map(before?.questions.map((q) => [q.id, q.rawSource]));
  const now = new Date().toISOString();
  for (const question of snapshot.questions) {
    for (const name of question.tags)
      if (!knownNames.has(name)) {
        knownNames.add(name);
        tags.push({ id: crypto.randomUUID(), name, color: '', createdAt: now });
      }
    if (
      old.get(question.id) === question.rawSource ||
      !question.rawSource.includes('includegraphics')
    )
      continue;
    const clean = maskComments(question.rawSource);
    for (const match of clean.matchAll(/\\includegraphics(?:\s*\[[^\]]*\])?\s*\{/g)) {
      const path = readGroup(clean, match.index + match[0].length - 1)?.value.trim();
      if (!path || knownAssets.has(`${question.id}\n${path}`)) continue;
      knownAssets.add(`${question.id}\n${path}`);
      const extension = path.split('.').pop()?.toLowerCase();
      const mimeType =
        extension === 'pdf'
          ? 'application/pdf'
          : extension === 'png'
            ? 'image/png'
            : ['jpg', 'jpeg'].includes(extension ?? '')
              ? 'image/jpeg'
              : 'application/octet-stream';
      assets.push({
        id: crypto.randomUUID(),
        questionId: question.id,
        name: path.split(/[\\/]/).pop() ?? path,
        relativePath: path,
        mimeType,
        checksum: '',
        missing: true,
        createdAt: now,
      });
    }
  }
  return tags.length === snapshot.tagDefinitions.length && assets.length === snapshot.assets.length
    ? snapshot
    : { ...snapshot, tagDefinitions: tags, assets };
}
