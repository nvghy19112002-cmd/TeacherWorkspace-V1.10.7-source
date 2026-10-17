import id6 from '../data/id6-thcs-thpt.json';
import type { CurriculumNode } from './model';
import { parseClassificationCode } from './ids';

type SourceNode = { code: string; name: string; children?: SourceNode[] };

const KINDS: CurriculumNode['kind'][] = ['grade', 'domain', 'chapter', 'lesson', 'form'];

/** Add missing MathHub ID6 branches without replacing teacher edits or changing question links. */
export function mergeMathHubId6(
  current: CurriculumNode[],
  now = new Date().toISOString(),
): CurriculumNode[] {
  const byId = new Map(current.map((node) => [node.id, node]));
  const byPath = new Map<string, CurriculumNode>();
  const pathOf = (node: CurriculumNode): string | null => {
    const parts = [node.code];
    const seen = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      if (seen.has(parentId)) return null;
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) return null;
      parts.unshift(parent.code);
      parentId = parent.parentId;
    }
    return parts.join('/');
  };
  for (const node of current) {
    const path = pathOf(node);
    if (path && !byPath.has(path)) byPath.set(path, node);
  }

  const added: CurriculumNode[] = [];
  const visit = (sources: SourceNode[], parentId: string | null, path: string[], depth: number) => {
    sources.forEach((source, sortOrder) => {
      const parts = [...path, source.code];
      const key = parts.join('/');
      const existing = byPath.get(key);
      // Existing IDs are retained so imported questions and teacher edits stay linked.
      const id = existing?.id ?? `mathhub-id6-${parts.join('-')}`;
      if (!existing) {
        const row: CurriculumNode = {
          id,
          parentId,
          kind: KINDS[depth],
          code: source.code,
          name: source.name,
          description: 'Cây ID6 MathHub do người dùng cung cấp.',
          sortOrder,
          archived: false,
          createdAt: now,
          updatedAt: now,
        };
        added.push(row);
        byPath.set(key, row);
      }
      if (source.children?.length) visit(source.children, id, parts, depth + 1);
    });
  };
  visit(id6.nodes, null, [], 0);
  return added.length ? [...current, ...added] : current;
}

/** Resolve an ID6 classification to the actual node IDs, including IDs retained from an older bank. */
export function id6NodePath(code: string, nodes: CurriculumNode[]) {
  const parsed = parseClassificationCode(code);
  if (!parsed) return null;
  const parts = [parsed.grade, parsed.domain, parsed.chapter, parsed.lesson, parsed.form];
  const matches: CurriculumNode[] = [];
  let parentId: string | null = null;
  for (let depth = 0; depth < parts.length; depth++) {
    const found: CurriculumNode | undefined = nodes.find(
      (node) => node.parentId === parentId && node.kind === KINDS[depth] && node.code === parts[depth],
    );
    if (!found) return null;
    matches.push(found);
    parentId = found.id;
  }
  return {
    gradeNodeId: matches[0].id,
    domainNodeId: matches[1].id,
    chapterNodeId: matches[2].id,
    lessonNodeId: matches[3].id,
    formNodeId: matches[4].id,
  };
}
