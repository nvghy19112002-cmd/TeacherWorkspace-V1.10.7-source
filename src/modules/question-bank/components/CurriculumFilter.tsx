import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import { activeKnttNodes } from '../domain/classificationContext';
import { gradeNumber, questionGrade } from '../domain/curriculumPresentation';
import { curriculumPath } from '../domain/curriculum';
import { visibleCurriculumRows } from '../domain/curriculumView';
import { searchText } from '../domain/library';
import { id6NodePath } from '../domain/mathhubCurriculum';
import type { BankSnapshot, CurriculumNode, Question } from '../domain/model';

export function CurriculumFilter({
  data,
  questions,
  activeNodeId,
  onApply,
  onClear,
  onClose,
}: {
  data: BankSnapshot;
  questions: Question[];
  activeNodeId: string;
  onApply: (node: CurriculumNode) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const nodes = useMemo(() => activeKnttNodes(data), [data]);
  const grades = nodes
    .filter((n) => n.kind === 'grade')
    .sort((a, b) => Number(a.code) - Number(b.code));
  const pathTo = (id: string) => {
    const ids: string[] = [],
      seen = new Set<string>();
    let n = nodes.find((n) => n.id === id);
    while (n && !seen.has(n.id)) {
      seen.add(n.id);
      ids.push(n.id);
      n = nodes.find((p) => p.id === n?.parentId);
    }
    return ids;
  };
  const initialPath = pathTo(activeNodeId);
  const [gradeId, setGradeId] = useState(
    grades.find((g) => initialPath.includes(g.id))?.id ?? grades[0]?.id ?? '',
  );
  const [selectedId, setSelectedId] = useState(activeNodeId || grades[0]?.id || '');
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([...initialPath, ...nodes.filter((n) => n.kind === 'domain').map((n) => n.id)]),
  );
  const [query, setQuery] = useState('');
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    const paths = new Map<string, ReturnType<typeof id6NodePath>>();
    for (const q of questions) {
      if (!q.gradeNodeId && q.classificationCode && !paths.has(q.classificationCode))
        paths.set(q.classificationCode, id6NodePath(q.classificationCode, data.curriculumNodes));
      const path = q.gradeNodeId ? q : paths.get(q.classificationCode);
      for (const id of new Set([
        path?.gradeNodeId,
        path?.domainNodeId,
        path?.chapterNodeId,
        path?.lessonNodeId,
        path?.formNodeId,
      ]))
        if (id) result.set(id, (result.get(id) ?? 0) + 1);
    }
    for (const g of nodes.filter((n) => n.kind === 'grade'))
      result.set(
        g.id,
        questions.filter((q) => questionGrade(q, data.curriculumNodes) === gradeNumber(g.code))
          .length,
      );
    return result;
  }, [questions, nodes, data.curriculumNodes]);
  const subset = nodes
    .filter((n) => pathTo(n.id).includes(gradeId))
    .map((n) => (n.id === gradeId ? { ...n, parentId: null } : n));
  // Fold accents for search while keeping the original labels in the displayed tree.
  const searchNodes = query
    ? subset.map((n) => ({
        ...n,
        name: searchText(n.name),
        description: searchText(n.description),
      }))
    : subset;
  const rows = visibleCurriculumRows(
    searchNodes,
    new Set([...expanded, gradeId]),
    searchText(query),
  ).filter((r) => r.node.id !== gradeId);
  const selected = nodes.find((n) => n.id === selectedId);
  return (
    <Modal
      title="Lọc theo mục lục KNTT"
      subtitle="Chọn lớp, mở chương/bài rồi áp dụng bộ lọc."
      onClose={onClose}
      wide
      className="qb-catalog-dialog"
    >
      <div className="modal-body qb-catalog-body">
        <div className="qb-catalog-grades" aria-label="Chọn lớp KNTT">
          {grades.map((g) => (
            <button
              key={g.id}
              aria-pressed={g.id === gradeId}
              onClick={() => {
                setGradeId(g.id);
                setSelectedId(g.id);
                setQuery('');
              }}
            >
              Lớp {gradeNumber(g.code)} <small>{counts.get(g.id) ?? 0}</small>
            </button>
          ))}
        </div>
        <label className="qb-catalog-search">
          <Search size={17} />
          <input
            aria-label="Tìm chương bài dạng KNTT"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm chương, bài, dạng…"
          />
        </label>
        <div className="qb-catalog-tree" aria-label="Cây lọc KNTT">
          {rows.map(({ node: row, depth, children }) => {
            const node = nodes.find((n) => n.id === row.id)!;
            const open = !!query || expanded.has(node.id);
            return (
              <div
                className={`qb-catalog-row ${node.id === selectedId ? 'active' : ''}`}
                key={node.id}
                style={{ paddingLeft: 8 + Math.max(0, depth - 1) * 18 }}
              >
                {children ? (
                  <button
                    className="qb-catalog-toggle"
                    aria-label={`${open ? 'Thu gọn' : 'Mở'} ${node.name}`}
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((before) => {
                        const next = new Set(before);
                        if (next.has(node.id)) next.delete(node.id);
                        else next.add(node.id);
                        return next;
                      })
                    }
                  >
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <span className="qb-catalog-toggle" />
                )}
                <button
                  className="qb-catalog-label"
                  aria-pressed={node.id === selectedId}
                  onClick={() => setSelectedId(node.id)}
                >
                  <span>{node.name}</span>
                  <small>{counts.get(node.id) ?? 0} câu</small>
                </button>
              </div>
            );
          })}
          {!rows.length && (
            <p className="qb-empty-inline">Không tìm thấy mục phù hợp trong lớp đang chọn.</p>
          )}
        </div>
        <div className="qb-catalog-selection">
          <BookOpen size={16} />
          <span>{selected ? curriculumPath(data, selected.id) : 'Chọn một mục để lọc'}</span>
        </div>
        <small className="muted">
          Câu thuộc cây cũ chỉ tính tổng lớp; cần duyệt KNTT để phân về chương/bài tương ứng.
        </small>
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClear}>
          Xóa lọc mục lục
        </button>
        <button className="button secondary" onClick={onClose}>
          Đóng
        </button>
        <button
          className="button primary"
          disabled={!selected}
          onClick={() => selected && onApply(selected)}
        >
          Áp dụng mục đã chọn
        </button>
      </div>
    </Modal>
  );
}
