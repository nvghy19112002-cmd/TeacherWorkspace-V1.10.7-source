import { useMemo, useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Download,
  FileJson,
  Plus,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import { errorText } from '../../../app/store';
import { useToasts } from '../../../components/feedback';
import { saveFile } from '../../../services/files';
import { parseCurriculum, PARENT_KIND, serializeCurriculum } from '../domain/curriculum';
import { visibleCurriculumRows } from '../domain/curriculumView';
import type { CurriculumNode } from '../domain/model';
import { useQuestionBank } from '../store';
import { MathHubTree } from './MathHubTree';
import { activeKnttNodes } from '../domain/classificationContext';
import { KnttCatalogStatus } from './KnttCatalogStatus';

const KIND_LABELS: Record<CurriculumNode['kind'], string> = {
  grade: 'Khối lớp',
  domain: 'Mạch kiến thức',
  chapter: 'Chương',
  lesson: 'Bài',
  form: 'Dạng',
};

export function CurriculumManager() {
  const data = useQuestionBank((state) => state.data);
  const commit = useQuestionBank((state) => state.commit);
  const busy = useQuestionBank((state) => state.busy);
  const toast = useToasts((state) => state.push);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reference, setReference] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [treeQuery, setTreeQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selected = data.curriculumNodes.find((node) => node.id === selectedId);
  const [kind, setKind] = useState<CurriculumNode['kind']>('form');
  const [parentId, setParentId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [importText, setImportText] = useState('');
  const [outcomeCode, setOutcomeCode] = useState('');
  const [outcomeContent, setOutcomeContent] = useState('');
  const editableNodes = useMemo(
    () => (legacy ? data.curriculumNodes : activeKnttNodes(data)),
    [data, legacy],
  );
  const rows = useMemo(
    () => visibleCurriculumRows(editableNodes, expanded, treeQuery),
    [editableNodes, expanded, treeQuery],
  );
  const parentKind = PARENT_KIND[kind];
  const parentOptions = parentKind
    ? editableNodes.filter((node) => node.kind === parentKind && !node.archived)
    : [];

  function resetForm(nextKind: CurriculumNode['kind'] = 'form') {
    setKind(nextKind);
    setParentId(null);
    setCode('');
    setName('');
    setDescription('');
  }

  function edit(node: CurriculumNode) {
    setSelectedId(node.id);
    setKind(node.kind);
    setParentId(node.parentId);
    setCode(node.code);
    setName(node.name);
    setDescription(node.description);
  }

  async function saveNode() {
    try {
      if (!code.trim() || !name.trim()) throw new Error('Cần nhập mã và tên.');
      if (parentKind && !parentId) throw new Error(`${KIND_LABELS[kind]} cần chọn nút cha.`);
      if (!parentKind && parentId) throw new Error('Khối lớp không có nút cha.');
      if (
        selected &&
        (selected.kind !== kind ||
          selected.parentId !== parentId ||
          selected.code !== code.trim().toUpperCase())
      )
        throw new Error(
          'Không đổi loại, nút cha hoặc mã của nút đã lưu vì có thể làm hỏng ID câu hỏi. Hãy thêm nút mới.',
        );
      if (
        data.curriculumNodes.some(
          (node) =>
            node.id !== selected?.id &&
            node.parentId === parentId &&
            node.code === code.trim().toUpperCase(),
        )
      )
        throw new Error('Mã này đã tồn tại trong cùng nhánh.');
      const now = new Date().toISOString();
      const existing = selected ?? undefined;
      const node: CurriculumNode = {
        id: existing?.id ?? crypto.randomUUID(),
        parentId,
        kind,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        archived: existing?.archived ?? false,
        sortOrder:
          existing?.sortOrder ??
          data.curriculumNodes.filter((item) => item.parentId === parentId).length,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await commit((snapshot) => ({
        ...snapshot,
        curriculumNodes: existing
          ? snapshot.curriculumNodes.map((item) => (item.id === node.id ? node : item))
          : [...snapshot.curriculumNodes, node],
      }));
      toast(existing ? 'Đã cập nhật cây chương trình.' : 'Đã thêm nút chương trình.');
      setSelectedId(node.id);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  async function archiveSelected() {
    if (!selected) return;
    await commit((snapshot) => ({
      ...snapshot,
      curriculumNodes: snapshot.curriculumNodes.map((node) =>
        node.id === selected.id
          ? { ...node, archived: !node.archived, updatedAt: new Date().toISOString() }
          : node,
      ),
    }));
    toast(selected.archived ? 'Đã khôi phục nút.' : 'Đã lưu trữ nút; mã cũ không bị tái sử dụng.');
  }

  async function addOutcome() {
    if (!selected || !outcomeCode.trim() || !outcomeContent.trim()) {
      toast('Chọn một nút và nhập đủ mã, nội dung yêu cầu cần đạt.', 'error');
      return;
    }
    const now = new Date().toISOString();
    await commit((snapshot) => ({
      ...snapshot,
      learningOutcomes: [
        ...snapshot.learningOutcomes,
        {
          id: crypto.randomUUID(),
          nodeId: selected.id,
          code: outcomeCode.trim(),
          content: outcomeContent.trim(),
          source: 'Chương trình GDPT 2018',
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    setOutcomeCode('');
    setOutcomeContent('');
    toast('Đã thêm yêu cầu cần đạt.');
  }

  async function importCurriculum() {
    try {
      const parsed = parseCurriculum(importText);
      const currentQuestions = data.questions.length;
      const replace =
        data.curriculumNodes.length === 0 ||
        window.confirm(
          `Cây hiện tại có ${data.curriculumNodes.length} nút và ${currentQuestions} câu hỏi. Nhấn OK để hợp nhất theo ID; dữ liệu không có trong tệp vẫn được giữ.`,
        );
      if (!replace) return;
      await commit((snapshot) => {
        const nodes = new Map(snapshot.curriculumNodes.map((node) => [node.id, node]));
        parsed.nodes.forEach((node) => nodes.set(node.id, node));
        const outcomes = new Map(snapshot.learningOutcomes.map((row) => [row.id, row]));
        parsed.learningOutcomes.forEach((row) => outcomes.set(row.id, row));
        return {
          ...snapshot,
          curriculumNodes: [...nodes.values()],
          learningOutcomes: [...outcomes.values()],
        };
      });
      toast(
        `Đã hợp nhất ${parsed.nodes.length} nút và ${parsed.learningOutcomes.length} yêu cầu cần đạt.`,
      );
      setImportText('');
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  if (reference) return <MathHubTree onBack={() => setReference(false)} />;

  return (
    <div className="qb-curriculum-layout">
      <section className="panel qb-tree-panel">
        <div className="qb-panel-title">
          <div>
            <h2>{legacy ? 'Các cây dữ liệu cũ' : 'Mục lục KNTT · Toán 10–12'}</h2>
            <p>{editableNodes.length} nút trong chế độ đang xem</p>
          </div>
          <button
            className="button small secondary"
            onClick={() => {
              setSelectedId(null);
              resetForm();
            }}
          >
            <Plus size={15} /> Thêm
          </button>
          <button className="button small secondary" onClick={() => setReference(true)}>
            Xem đủ 5 cây MathHub
          </button>
        </div>
        <KnttCatalogStatus data={data} />
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={legacy}
              onChange={(e) => {
                setLegacy(e.target.checked);
                setSelectedId(null);
                setExpanded(new Set());
                setTreeQuery('');
                resetForm();
              }}
            />{' '}
            Hiện tất cả cây cũ / dữ liệu tham khảo
          </span>
        </label>
        <label className="qb-tree-search">
          <Search size={15} />
          <input
            aria-label="Tìm trong cây chương trình"
            value={treeQuery}
            onChange={(event) => setTreeQuery(event.target.value)}
            placeholder="Tìm mã, tên hoặc mô tả…"
          />
        </label>
        <div className="qb-tree" role="tree">
          {rows.length === 0 && (
            <div className="qb-empty-inline">
              {treeQuery
                ? 'Không tìm thấy nút khớp từ khóa.'
                : 'Chưa có cây chương trình. Hãy tạo thủ công hoặc nhập JSON.'}
            </div>
          )}
          {rows.map(({ node, depth, children }) => (
            <div
              key={node.id}
              className={`qb-tree-item ${selectedId === node.id ? 'active' : ''} ${node.archived ? 'archived' : ''}`}
              style={{ paddingLeft: 6 + depth * 16 }}
            >
              {children ? (
                <button
                  className="qb-tree-toggle"
                  aria-label={`${expanded.has(node.id) ? 'Thu gọn' : 'Mở rộng'} ${node.name}`}
                  aria-expanded={treeQuery ? true : expanded.has(node.id)}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    })
                  }
                >
                  {treeQuery || expanded.has(node.id) ? (
                    <ChevronDown size={15} />
                  ) : (
                    <ChevronRight size={15} />
                  )}
                </button>
              ) : (
                <span className="qb-tree-toggle" />
              )}
              <button
                className="qb-tree-row"
                aria-selected={selectedId === node.id}
                role="treeitem"
                onClick={() => edit(node)}
              >
                <span>{node.code}</span>
                <strong title={node.name}>{node.name}</strong>
                <small>{children || KIND_LABELS[node.kind]}</small>
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="qb-curriculum-main">
        <section className="panel">
          <div className="qb-panel-title">
            <div>
              <h2>{selected ? 'Chỉnh nút chương trình' : 'Thêm nút chương trình'}</h2>
              <p>Mã cố định; thứ tự hiển thị độc lập.</p>
            </div>
            {selected && (
              <button className="button small secondary" onClick={() => void archiveSelected()}>
                {selected.archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                {selected.archived ? 'Khôi phục' : 'Lưu trữ'}
              </button>
            )}
          </div>
          <div className="form-grid">
            <label className="field">
              Loại
              <select
                value={kind}
                disabled={Boolean(selected)}
                onChange={(event) => {
                  const next = event.target.value as CurriculumNode['kind'];
                  setKind(next);
                  setParentId(null);
                }}
              >
                <option value="grade" disabled={!legacy}>
                  Khối lớp (chế độ dữ liệu cũ)
                </option>
                <option value="domain">Mạch kiến thức</option>
                <option value="chapter">Chương</option>
                <option value="lesson">Bài</option>
                <option value="form">Dạng</option>
              </select>
            </label>
            <label className="field">
              Nút cha
              <select
                value={parentId ?? ''}
                disabled={!parentKind || Boolean(selected)}
                onChange={(event) => setParentId(event.target.value || null)}
              >
                <option value="">— {parentKind ? 'Chọn nút cha' : 'Không có'} —</option>
                {parentOptions.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.code} · {node.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Mã
              <input
                value={code}
                disabled={Boolean(selected)}
                maxLength={30}
                onChange={(event) => setCode(event.target.value)}
                placeholder={
                  kind === 'grade' ? 'Ví dụ: 0' : kind === 'domain' ? 'Ví dụ: D' : 'Ví dụ: 1'
                }
              />
            </label>
            <label className="field">
              Tên
              <input
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          </div>
          <label className="field">
            Mô tả/hồ sơ nhận diện
            <textarea
              rows={4}
              value={description}
              maxLength={4000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy} onClick={() => void saveNode()}>
            <Save size={16} /> Lưu nút
          </button>
        </section>
        <section className="panel">
          <h2>Yêu cầu cần đạt 2018</h2>
          <p>
            {selected
              ? `Đang gắn vào: ${selected.name}`
              : 'Chọn một nút trên cây trước khi thêm YCCD.'}
          </p>
          <div className="qb-outcome-add">
            <input
              value={outcomeCode}
              onChange={(event) => setOutcomeCode(event.target.value)}
              placeholder="Mã YCCD"
            />
            <textarea
              rows={2}
              value={outcomeContent}
              onChange={(event) => setOutcomeContent(event.target.value)}
              placeholder="Nội dung chính xác của yêu cầu cần đạt"
            />
            <button className="button secondary" onClick={() => void addOutcome()}>
              Thêm YCCD
            </button>
          </div>
          <div className="qb-outcomes">
            {data.learningOutcomes
              .filter((row) => row.nodeId === selectedId)
              .map((row) => (
                <div key={row.id}>
                  <strong>{row.code}</strong>
                  <span>{row.content}</span>
                </div>
              ))}
          </div>
        </section>
        <section className="panel">
          <div className="qb-panel-title">
            <div>
              <h2>Nhập/xuất cây đã duyệt</h2>
              <p>JSON có schema; import hợp nhất bằng transaction.</p>
            </div>
            <button
              className="button small secondary"
              onClick={() =>
                void saveFile(
                  'TeacherWorkspace-curriculum.json',
                  new TextEncoder().encode(serializeCurriculum(data)),
                  'application/json',
                )
              }
            >
              <Download size={15} /> Xuất JSON
            </button>
          </div>
          <textarea
            className="qb-json-input"
            rows={7}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='Dán JSON có type: "curriculum" tại đây…'
          />
          <button
            className="button secondary"
            disabled={!importText.trim() || busy}
            onClick={() => void importCurriculum()}
          >
            <FileJson size={16} /> Kiểm tra và hợp nhất
          </button>
        </section>
      </div>
    </div>
  );
}
