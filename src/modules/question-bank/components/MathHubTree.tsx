import { useEffect, useMemo, useState } from 'react';

interface TaxonomyNode {
  code: string;
  name: string;
  children?: TaxonomyNode[];
}
interface Taxonomy {
  nodes: TaxonomyNode[];
  levels: { code: string; name: string }[];
  _chuThich?: string;
}

const SOURCES = {
  id6: { label: 'ID6 · Toán 6–12', load: () => import('../data/id6-thcs-thpt.json') },
  thpt: { label: 'ID6 · Toán 10–12', load: () => import('../data/mathhub/ID6-thpt-TOAN-VA-LATEX.json') },
  kntt1: { label: 'KNTT · Toán 1–5', load: () => import('../data/mathhub/TOAN-1-5-KNTT.json') },
  kntt6: { label: 'KNTT · Toán 6–12', load: () => import('../data/mathhub/TOAN-6-12-KNTT.json') },
  btpro: { label: 'ID BTpro', load: () => import('../data/mathhub/ID-BTpro.json') },
} as const;
type Source = keyof typeof SOURCES;

function count(nodes: TaxonomyNode[]): number {
  return nodes.reduce((total, node) => total + 1 + count(node.children ?? []), 0);
}

function TreeRow({ node, path, open, toggle }: {
  node: TaxonomyNode;
  path: string;
  open: Set<string>;
  toggle: (path: string) => void;
}) {
  const children = node.children ?? [];
  const expanded = open.has(path);
  return (
    <li>
      <button
        type="button"
        className="qb-mathhub-node"
        aria-expanded={children.length ? expanded : undefined}
        onClick={() => children.length && toggle(path)}
      >
        <span aria-hidden="true">{children.length ? (expanded ? '▾' : '▸') : '·'}</span>
        <code>{node.code}</code>
        <span>{node.name}</span>
        {children.length > 0 && <small>{children.length}</small>}
      </button>
      {expanded && children.length > 0 && (
        <ul>
          {children.map((child, index) => (
            <TreeRow key={`${index}:${child.code}`} node={child} path={`${path}/${index}`} open={open} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Keep the supplied MathHub exports separate from the editable curriculum and its question links. */
export function MathHubTree({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState<Source>('id6');
  const [tree, setTree] = useState<Taxonomy | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    let mounted = true;
    setTree(null);
    setError('');
    setOpen(new Set());
    void SOURCES[source].load().then((module) => {
      if (mounted) setTree(module.default as Taxonomy);
    }).catch(() => {
      if (mounted) setError('Không đọc được cây đã đóng gói.');
    });
    return () => { mounted = false; };
  }, [source]);
  const total = useMemo(() => tree ? count(tree.nodes) : 0, [tree]);
  const toggle = (path: string) => setOpen((previous) => {
    const next = new Set(previous);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  return (
    <section className="panel qb-mathhub-tree">
      <div className="qb-panel-title">
        <div>
          <h2>Cây mục lục MathHub</h2>
          <p>Bản sao nguyên nội dung các cây anh gửi. Cây ID6 6–12 được bổ sung vào ngân hàng; các hệ mã khác để tham khảo riêng.</p>
        </div>
        <button className="button small secondary" onClick={onBack}>Về cây ngân hàng</button>
      </div>
      <label className="field">
        Chọn cây MathHub
        <select value={source} onChange={(event) => setSource(event.target.value as Source)}>
          {Object.entries(SOURCES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {!tree && !error && <p role="status">Đang đọc cây…</p>}
      {tree && (
        <>
          <p>{total.toLocaleString('vi-VN')} nút · {tree.levels.map((level) => `${level.code}: ${level.name}`).join(' · ')}</p>
          {tree._chuThich && <details><summary>Ghi chú từ MathHub</summary><p>{tree._chuThich}</p></details>}
          <ul className="qb-mathhub-branches">
            {tree.nodes.map((node, index) => <TreeRow key={`${index}:${node.code}`} node={node} path={String(index)} open={open} toggle={toggle} />)}
          </ul>
        </>
      )}
    </section>
  );
}
