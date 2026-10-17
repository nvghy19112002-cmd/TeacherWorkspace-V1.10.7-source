import { maskComments } from './latex';
import type { Question } from './model';

/** One ordering rule for the tray, clipboard, PDF and exam snapshots. */
export function orderedQuestions(ids: string[], questions: Question[]): Question[] {
  const byId = new Map(questions.filter((question) => !question.deletedAt).map((q) => [q.id, q]));
  return [...new Set(ids)].flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });
}

export function questionExcerpt(source: string): string {
  return maskComments(source)
    .replace(/\\begin\{ex\}(?:\[[^\]]*\])?/g, '')
    .split(/\\(?:choiceTF|choice|loigiai|shortans)\b/)[0]
    .replace(/\\(?:begin|end)\{[^}]*\}/g, ' ')
    .replace(/\\(?:textbf|textit|emph)\{([^{}]*)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function moveSelection(ids: string[], id: string, offset: number): string[] {
  const index = ids.indexOf(id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function searchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}
