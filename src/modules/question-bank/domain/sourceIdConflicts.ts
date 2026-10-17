import type { Question } from './model';
import { sourceIdCandidates } from './id6Taxonomy';

function fullSourceId(question: Question): string | null {
  const candidates = sourceIdCandidates(question.rawSource);
  if (candidates.length !== 1 || !/-\d{3,}$/.test(candidates[0])) return null;
  return candidates[0].toUpperCase();
}

/** A classification code may repeat; only a complete source ID with sequence must be unique. */
export function flagSourceIdConflicts(imported: Question[], existing: Question[]): Question[] {
  const seen = new Set(existing.map(fullSourceId).filter((id): id is string => Boolean(id)));
  return imported.map((question) => {
    const id = fullSourceId(question);
    if (!id) return question;
    const conflict = seen.has(id);
    seen.add(id);
    return conflict
      ? {
          ...question,
          warnings: [
            ...question.warnings,
            `ID nguồn ${id} đã xuất hiện trong ngân hàng hoặc lô nhập; cần kiểm tra câu trùng.`,
          ],
        }
      : question;
  });
}
