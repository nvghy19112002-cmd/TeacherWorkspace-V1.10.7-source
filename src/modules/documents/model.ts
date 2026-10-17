export interface DocumentNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: 'folder' | 'file';
  bytes: Uint8Array;
  deletedAt: string | null;
}
export interface DocumentProject {
  id: string;
  title: string;
  grade: string;
  category: 'review' | 'exam';
  year: string;
  mainId: string | null;
  engine: string;
  nodes: DocumentNode[];
  updatedAt: string;
  revision: number;
}
export function validName(name: string) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name !== name.trim() ||
    /[<>:"/\\|?*]/.test(name) ||
    [...name].some((c) => c.charCodeAt(0) < 32) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ||
    name === '.' ||
    name === '..'
  )
    throw new Error(
      'Tên không hợp lệ. Không dùng ký tự đường dẫn hoặc tên dành riêng của Windows.',
    );
}
export function nodePath(project: DocumentProject, node: DocumentNode): string {
  const parts = [node.name];
  const seen = new Set([node.id]);
  let parent = node.parentId;
  while (parent) {
    if (seen.has(parent)) throw new Error('Cây thư mục bị lặp.');
    seen.add(parent);
    const found = project.nodes.find((n) => n.id === parent);
    if (!found || found.kind !== 'folder') throw new Error('Không tìm thấy thư mục cha.');
    parts.unshift(found.name);
    parent = found.parentId;
  }
  return parts.join('/');
}
export function descendants(project: DocumentProject, id: string): Set<string> {
  const output = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of project.nodes)
      if (node.parentId && output.has(node.parentId) && !output.has(node.id)) {
        output.add(node.id);
        changed = true;
      }
  }
  return output;
}
export function validateProject(project: DocumentProject) {
  if (
    !project ||
    typeof project.id !== 'string' ||
    !project.id ||
    typeof project.title !== 'string' ||
    typeof project.grade !== 'string' ||
    typeof project.year !== 'string' ||
    typeof project.updatedAt !== 'string' ||
    !Array.isArray(project.nodes) ||
    !project.title.trim() ||
    !['review', 'exam'].includes(project.category) ||
    !['pdflatex', 'xelatex', 'lualatex'].includes(project.engine) ||
    !Number.isInteger(project.revision) ||
    project.revision < 0 ||
    project.nodes.length > 5000
  )
    throw new Error('Dữ liệu dự án không hợp lệ.');
  const ids = new Set<string>();
  const paths = new Set<string>();
  let size = 0;
  for (const n of project.nodes) {
    if (
      !n ||
      !['file', 'folder'].includes(n.kind) ||
      typeof n.id !== 'string' ||
      (n.parentId !== null && typeof n.parentId !== 'string') ||
      (n.deletedAt !== null && typeof n.deletedAt !== 'string')
    )
      throw new Error('Nút tài liệu không hợp lệ.');
    validName(n.name);
    if (ids.has(n.id) || !n.id || !(n.bytes instanceof Uint8Array))
      throw new Error('ID hoặc nội dung file không hợp lệ.');
    ids.add(n.id);
    size += n.bytes.byteLength;
    if (n.bytes.byteLength > 25 * 1024 * 1024) throw new Error('Một file vượt quá 25 MB.');
    const path = nodePath(project, n).toLowerCase();
    if (!n.deletedAt) {
      if (paths.has(path)) throw new Error('Tên file/thư mục đã tồn tại.');
      paths.add(path);
      if (n.parentId && project.nodes.find((p) => p.id === n.parentId)?.deletedAt)
        throw new Error('Thư mục cha đang ở thùng rác.');
    }
  }
  if (size > 100 * 1024 * 1024) throw new Error('Một bộ đề vượt quá 100 MB.');
  if (
    project.mainId &&
    !project.nodes.some(
      (n) => n.id === project.mainId && n.kind === 'file' && !n.deletedAt && /\.tex$/i.test(n.name),
    )
  )
    throw new Error('File chính phải là một file .tex đang hoạt động.');
}
export function moveNode(project: DocumentProject, id: string, parentId: string | null) {
  if (parentId && descendants(project, id).has(parentId))
    throw new Error('Không thể chuyển thư mục vào chính nhánh con của nó.');
  const next = {
    ...project,
    nodes: project.nodes.map((n) => (n.id === id ? { ...n, parentId } : n)),
  };
  validateProject(next);
  return next;
}
export function trashNode(project: DocumentProject, id: string) {
  const ids = descendants(project, id);
  const next = {
    ...project,
    mainId: project.mainId && ids.has(project.mainId) ? null : project.mainId,
    nodes: project.nodes.map((n) =>
      ids.has(n.id) ? { ...n, deletedAt: new Date().toISOString() } : n,
    ),
  };
  validateProject(next);
  return next;
}
export function restoreNode(project: DocumentProject, id: string) {
  const ids = descendants(project, id);
  let current = project.nodes.find((n) => n.id === id);
  while (current?.parentId) {
    ids.add(current.parentId);
    current = project.nodes.find((n) => n.id === current?.parentId);
  }
  const next = {
    ...project,
    nodes: project.nodes.map((n) => (ids.has(n.id) ? { ...n, deletedAt: null } : n)),
  };
  validateProject(next);
  return next;
}
export function projectBackup(project: DocumentProject) {
  return JSON.stringify({
    format: 'teacher-workspace-documents',
    version: 1,
    project: {
      ...project,
      nodes: project.nodes.map((n) => ({ ...n, bytes: Array.from(n.bytes) })),
    },
  });
}
export function parseProjectBackup(text: string): DocumentProject {
  const raw = JSON.parse(text);
  if (
    raw.format !== 'teacher-workspace-documents' ||
    raw.version !== 1 ||
    !Array.isArray(raw.project?.nodes)
  )
    throw new Error('Không đúng backup Kho đề.');
  const project = {
    ...raw.project,
    id: crypto.randomUUID(),
    revision: 0,
    nodes: raw.project.nodes.map((n: DocumentNode & { bytes: number[] }) => {
      if (!Array.isArray(n.bytes) || n.bytes.some((v) => !Number.isInteger(v) || v < 0 || v > 255))
        throw new Error('Nội dung file không hợp lệ.');
      return { ...n, bytes: new Uint8Array(n.bytes) };
    }),
  };
  validateProject(project);
  return project;
}
