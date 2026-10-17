import { classificationContext } from './classificationContext';
import type { BankSnapshot, Question } from './model';
import { maskComments } from './latex';

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
const topics = [
  ['dao ham', 'tiep tuyen', 'derivative'],
  ['nguyen ham', 'tich phan', 'integral'],
  ['xac suat', 'bien co', 'probability'],
  ['thong ke', 'trung vi', 'phuong sai'],
  ['vector', 'vectơ', 'vecto', 'toa do'],
  ['luong giac', 'sin', 'cos', 'tan'],
  ['logarit', 'log', 'ham so mu'],
  ['cap so', 'day so'],
  ['gioi han', 'lien tuc', 'lim'],
  ['mat phang', 'duong thang', 'khoang cach', 'vuong goc'],
  ['tap hop', 'menh de'],
  ['bat phuong trinh', 'bat dang thuc'],
];
/** Candidate retrieval only; a lexical score is never a mathematical classification. */
export function retrieveCurriculum(
  snapshot: BankSnapshot,
  question: Question,
  scopeId = '',
  expand = false,
) {
  const full = classificationContext(snapshot, scopeId);
  const text = normalized(maskComments(`${question.rawSource}\n${question.solution}`));
  const matching = topics.filter((terms) => terms.some((term) => text.includes(normalized(term))));
  const lessons = full.nodes.filter((n) => n.kind === 'lesson');
  const candidates = lessons
    .map((lesson) => ({
      lesson,
      score: matching.reduce(
        (score, terms) =>
          score +
          (terms.some((term) =>
            normalized(`${lesson.name} ${lesson.description}`).includes(normalized(term)),
          )
            ? 1
            : 0),
        0,
      ),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  if (scopeId || expand || !candidates.length || candidates.length === lessons.length)
    return {
      ...full,
      retrieval: {
        mode: 'expanded' as const,
        candidateLessons: lessons.map((n) => n.id),
        totalLessons: lessons.length,
      },
    };
  const included = new Set<string>();
  for (const { lesson } of candidates)
    for (const node of classificationContext(snapshot, lesson.id).nodes) included.add(node.id);
  const nodes = full.nodes.filter((n) => included.has(n.id));
  return {
    nodes,
    forms: full.forms.filter((n) => included.has(n.id)),
    learningOutcomes: full.learningOutcomes.filter((o) => included.has(o.nodeId)),
    missingLessons: full.missingLessons.filter((n) => included.has(n.id)),
    retrieval: {
      mode: 'candidates' as const,
      candidateLessons: candidates.map((r) => r.lesson.id),
      totalLessons: lessons.length,
    },
  };
}
