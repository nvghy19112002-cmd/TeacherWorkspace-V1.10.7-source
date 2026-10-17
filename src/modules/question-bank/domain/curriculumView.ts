import type { CurriculumNode } from './model';

export interface CurriculumRow {
  node: CurriculumNode;
  depth: number;
  children: number;
}

/** Return only expanded branches; a search also exposes ancestors of matching nodes. */
export function visibleCurriculumRows(
  nodes: CurriculumNode[],
  expanded: ReadonlySet<string>,
  query = '',
): CurriculumRow[] {
  const byParent = new Map<string | null, CurriculumNode[]>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }
  for (const siblings of byParent.values())
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  const needle = query.trim().toLocaleLowerCase('vi');
  const included = new Set<string>();
  if (needle) {
    for (const node of nodes) {
      if (!`${node.code} ${node.name} ${node.description}`.toLocaleLowerCase('vi').includes(needle))
        continue;
      let ancestor: CurriculumNode | undefined = node;
      const visited = new Set<string>();
      while (ancestor && !visited.has(ancestor.id)) {
        visited.add(ancestor.id);
        included.add(ancestor.id);
        ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
      }
    }
  }

  const output: CurriculumRow[] = [];
  const walk = (parentId: string | null, depth: number, ancestors: ReadonlySet<string>) => {
    for (const node of byParent.get(parentId) ?? []) {
      if (ancestors.has(node.id) || (needle && !included.has(node.id))) continue;
      const children = byParent.get(node.id)?.length ?? 0;
      output.push({ node, depth, children });
      if (children && (needle || expanded.has(node.id)))
        walk(node.id, depth + 1, new Set([...ancestors, node.id]));
    }
  };
  walk(null, 0, new Set());
  return output;
}
