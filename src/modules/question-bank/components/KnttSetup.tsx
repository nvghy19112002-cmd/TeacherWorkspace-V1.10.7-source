import { useState } from 'react';
import { useQuestionBank } from '../store';
import { activeKnttNodes } from '../domain/classificationContext';
import { curriculumPath } from '../domain/curriculum';
import { useToasts } from '../../../components/feedback';
import { errorText } from '../../../app/store';
export function KnttSetup() {
  const data = useQuestionBank((s) => s.data);
  const busy = useQuestionBank((s) => s.busy);
  const toast = useToasts((s) => s.push);
  const [lesson, setLesson] = useState('');
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const fold = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
  const gradeOf = (id: string) => {
    const seen = new Set<string>();
    let n = data.curriculumNodes.find((n) => n.id === id);
    while (n && n.kind !== 'grade') {
      if (seen.has(n.id)) return '';
      seen.add(n.id);
      n = data.curriculumNodes.find((p) => p.id === n?.parentId);
    }
    return n?.code ?? '';
  };
  const lessons = activeKnttNodes(data).filter((n) => n.kind === 'lesson');
  const knttIds = new Set(activeKnttNodes(data).map((n) => n.id));
  const sources = data.curriculumNodes.filter(
    (n) =>
      !knttIds.has(n.id) &&
      n.kind === 'lesson' &&
      !n.archived &&
      (!lesson || [gradeOf(lesson), String(Number(gradeOf(lesson)) + 10)].includes(gradeOf(n.id))),
  );
  async function add(copy: boolean) {
    try {
      if (!lesson) throw new Error('Chọn bài KNTT.');
      const now = new Date().toISOString();
      await useQuestionBank.getState().commit((s) => {
        if (!activeKnttNodes(s).some((n) => n.id === lesson && n.kind === 'lesson'))
          throw new Error('Bài KNTT đã đổi hoặc bị ẩn.');
        if (copy && !sources.some((n) => n.id === source))
          throw new Error('Chọn bài nguồn cùng lớp với bài KNTT.');
        const existing = s.curriculumNodes.filter(
          (n) => n.parentId === lesson && n.kind === 'form',
        );
        const rows = copy
          ? s.curriculumNodes.filter(
              (n) => n.parentId === source && n.kind === 'form' && !n.archived,
            )
          : [
              {
                code: String(Math.max(0, ...existing.map((n) => Number(n.code) || 0)) + 1),
                name: name.trim(),
              },
            ];
        if (!rows.length || rows.some((n) => !n.name))
          throw new Error('Chọn nguồn có dạng hoặc nhập tên dạng.');
        if (rows.some((n) => !/^\d+$/.test(n.code))) throw new Error('Mã dạng phải là số.');
        if (rows.some((n) => existing.some((e) => e.code === n.code && e.name !== n.name)))
          throw new Error('Có mã dạng đã tồn tại với tên khác. Đối chiếu lại, không tự ghi đè.');
        let order = Math.max(-1, ...existing.map((n) => n.sortOrder)) + 1;
        const added = rows
          .filter((n) => !existing.some((e) => e.code === n.code))
          .map((n) => ({
            id: `${lesson}-f${n.code}`,
            parentId: lesson,
            kind: 'form' as const,
            code: n.code,
            name: n.name,
            description: 'Dạng KNTT do giáo viên chọn/duyệt; không tự ánh xạ MathHub.',
            sortOrder: order++,
            archived: false,
            createdAt: now,
            updatedAt: now,
          }));
        if (!added.length) throw new Error('Các mã dạng này đã tồn tại.');
        return { ...s, curriculumNodes: [...s.curriculumNodes, ...added] };
      });
      setName('');
      toast('Đã lưu danh mục dạng do anh duyệt.');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }
  return (
    <details className="qb-editor-optional">
      <summary>Thiết lập dạng bài KNTT · giáo viên duyệt trước khi AI chọn</summary>
      <p className="muted">
        Cây chương/bài dùng bản KNTT đã cung cấp. Dạng bài cần anh thêm hoặc đối chiếu từ MathHub;
        app không tự đoán quan hệ hai cây.
      </p>
      <label className="field">
        Tìm bài theo tên
        <input
          aria-label="Tìm bài KNTT"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <label className="field">
        Bài KNTT
        <select
          aria-label="Bài KNTT"
          value={lesson}
          onChange={(e) => {
            setLesson(e.target.value);
            setSource('');
          }}
        >
          <option value="">Chọn bài…</option>
          {lessons
            .filter(
              (n) => n.id === lesson || fold(curriculumPath(data, n.id)).includes(fold(search)),
            )
            .map((n) => (
              <option key={n.id} value={n.id}>
                {curriculumPath(data, n.id)}
              </option>
            ))}
        </select>
      </label>
      {lesson && (
        <p>
          Các dạng hiện có:{' '}
          {data.curriculumNodes
            .filter((n) => n.parentId === lesson && !n.archived && n.kind === 'form')
            .map((n) => `${n.code}. ${n.name}`)
            .join(' · ') || 'Chưa có dạng'}
        </p>
      )}
      <label className="field">
        Bài nguồn MathHub để đối chiếu
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Chọn bài nguồn…</option>
          {sources.map((n) => (
            <option key={n.id} value={n.id}>
              {curriculumPath(data, n.id)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button secondary small"
        disabled={busy || !lesson || !source}
        onClick={() => void add(true)}
      >
        Tôi đã đối chiếu · chép danh mục dạng
      </button>
      <label className="field">
        Hoặc thêm một dạng riêng
        <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      </label>
      <button
        className="button secondary small"
        disabled={busy || !lesson || !name.trim()}
        onClick={() => void add(false)}
      >
        Duyệt và thêm dạng
      </button>
    </details>
  );
}
