import { describe, it, expect } from 'vitest';
import {
  validateProject,
  moveNode,
  trashNode,
  restoreNode,
  projectBackup,
  parseProjectBackup,
  validName,
  type DocumentProject,
} from '../src/modules/documents/model';
const make = (): DocumentProject => ({
  id: 'p',
  title: 'Đề học kỳ',
  grade: '10',
  category: 'exam',
  year: '2026',
  mainId: 't',
  engine: 'pdflatex',
  revision: 0,
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'f',
      parentId: null,
      name: 'chapters',
      kind: 'folder',
      bytes: new Uint8Array(),
      deletedAt: null,
    },
    {
      id: 't',
      parentId: 'f',
      name: 'main.tex',
      kind: 'file',
      bytes: new TextEncoder().encode('Tiếng Việt'),
      deletedAt: null,
    },
  ],
});
describe('Document projects', () => {
  it('round trips exact UTF8 and creates independent backup identity', () => {
    const p = make();
    const copy = parseProjectBackup(projectBackup(p));
    expect(copy.id).not.toBe(p.id);
    expect(copy.nodes).toEqual(p.nodes);
  });
  it('rejects cyclic moves and case insensitive collisions', () => {
    const p = make();
    expect(() => moveNode(p, 'f', 'f')).toThrow();
    p.nodes.push({ ...p.nodes[1], id: 'x', name: 'MAIN.TEX' });
    expect(() => validateProject(p)).toThrow();
  });
  it('trashes subtree, clears main and restores ancestors', () => {
    const p = trashNode(make(), 'f');
    expect(p.nodes.every((n) => n.deletedAt)).toBe(true);
    expect(p.mainId).toBeNull();
    expect(restoreNode(p, 't').nodes.every((n) => !n.deletedAt)).toBe(true);
  });
  it('does not overwrite a live name when restoring trash', () => {
    const p = trashNode(make(), 't');
    p.nodes.push({ ...make().nodes[1], id: 'new' });
    expect(() => restoreNode(p, 't')).toThrow();
  });
  it('rejects traversal, reserved Windows names and corrupt backup metadata', () => {
    for (const n of ['../a', 'CON.tex', 'a\u0000b', 'a.']) expect(() => validName(n)).toThrow();
    const raw = JSON.parse(projectBackup(make()));
    raw.project.title = 5;
    expect(() => parseProjectBackup(JSON.stringify(raw))).toThrow();
    raw.project.title = 'x';
    raw.project.nodes[0].kind = 'symlink';
    expect(() => parseProjectBackup(JSON.stringify(raw))).toThrow();
  });
});
