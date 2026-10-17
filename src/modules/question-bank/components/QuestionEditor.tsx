import { applyParsedMetadata, parseExTest } from '../domain/parser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Columns2, Eye, ScanText, Save } from 'lucide-react';
import { prepareEditedQuestion } from '../domain/editor';
import { TexLivePreview } from './TexLivePreview';
import { inspectId6 } from '../domain/id6Taxonomy';
import { Modal } from '../../../components/Modal';
import { useToasts } from '../../../components/feedback';
import { errorText } from '../../../app/store';
import { buildClassificationCode } from '../domain/ids';
import { normalizeQuestionSource, questionHash } from '../domain/normalize';
import {
  LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  STATUS_LABELS,
  type CurriculumNode,
  type Question,
} from '../domain/model';
import { useQuestionBank } from '../store';
import { id6NodePath } from '../domain/mathhubCurriculum';
import { QuestionPreview } from './QuestionPreview';

function blankQuestion(): Question {
  const now = new Date().toISOString();
  const rawSource = '\\begin{ex}\n\t\n\t\\loigiai{\n\t}\n\\end{ex}';
  return {
    id: crypto.randomUUID(),
    displayId: '',
    classificationCode: '',
    sequenceNumber: null,
    rawSource,
    normalizedSource: normalizeQuestionSource(rawSource),
    contentHash: questionHash(rawSource),
    questionType: 'essay',
    answer: '',
    solution: '',
    level: 'N',
    gradeNodeId: null,
    domainNodeId: null,
    chapterNodeId: null,
    lessonNodeId: null,
    formNodeId: null,
    primaryOutcomeId: null,
    secondaryOutcomeIds: [],
    tags: [],
    source: '',
    status: 'draft',
    confidence: null,
    reasoning: '',
    warnings: [],
    hasImage: false,
    usageCount: 0,
    idLocked: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function QuestionEditor({
  question,
  onClose,
}: {
  question?: Question;
  onClose: () => void;
}) {
  const data = useQuestionBank((state) => state.data);
  const commit = useQuestionBank((state) => state.commit);
  const busy = useQuestionBank((state) => state.busy);
  const toast = useToasts((state) => state.push);
  const [draft, setDraft] = useState<Question>(() => {
    const current = structuredClone(question ?? blankQuestion());
    const path =
      !current.gradeNodeId && current.classificationCode
        ? id6NodePath(current.classificationCode, data.curriculumNodes)
        : null;
    return path ? { ...current, ...path } : current;
  });
  const [view, setView] = useState<'source' | 'split' | 'preview'>('split');
  const [discard, setDiscard] = useState(false);
  const [compilerOpen, setCompilerOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState(draft.rawSource);
  const initial = useRef(JSON.stringify(draft));
  const dirty = initial.current !== JSON.stringify(draft);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const detected = useMemo(() => {
    try {
      const rows = parseExTest(draft.rawSource);
      return {
        value: rows.length === 1 ? rows[0] : null,
        error: rows.length !== 1 ? 'Trình sửa chỉ nhận một câu hỏi.' : '',
      };
    } catch (error) {
      return { value: null, error: errorText(error) };
    }
  }, [draft.rawSource]);
  const sourceInspection =
    !draft.tags.includes('curriculum:kntt-2026') && detected.value?.sourceId
      ? inspectId6(detected.value.sourceId)
      : null;
  const sourcePath = sourceInspection?.classificationCode
    ? id6NodePath(sourceInspection.classificationCode, data.curriculumNodes)
    : null;
  const displayed = {
    ...draft,
    ...(sourcePath ?? {}),
    level: sourceInspection?.level ?? draft.level,
  };
  const originalParsed = useMemo(() => {
    if (!question) return null;
    try {
      return parseExTest(question.rawSource)[0] ?? null;
    } catch {
      return null;
    }
  }, [question]);
  const displayedAnswer =
    detected.value?.answer || (!originalParsed?.answer ? (question?.answer ?? '') : '');
  const displayedSolution =
    detected.value?.solution || (!originalParsed?.solution ? (question?.solution ?? '') : '');
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewSource(draft.rawSource), 800);
    return () => window.clearTimeout(timer);
  }, [draft.rawSource]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const children = (parentId: string | null, kind: CurriculumNode['kind']) =>
    data.curriculumNodes
      .filter((node) => node.parentId === parentId && node.kind === kind && !node.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const grades = children(null, 'grade');
  const domains = children(displayed.gradeNodeId, 'domain');
  const chapters = children(displayed.domainNodeId, 'chapter');
  const lessons = children(displayed.chapterNodeId, 'lesson');
  const forms = children(displayed.lessonNodeId, 'form');
  const outcomes = data.learningOutcomes.filter((outcome) => outcome.active);
  const classificationCode = useMemo(
    () => buildClassificationCode(data.curriculumNodes, draft),
    [data.curriculumNodes, draft],
  );
  const setNode = (
    field: keyof Pick<
      Question,
      'gradeNodeId' | 'domainNodeId' | 'chapterNodeId' | 'lessonNodeId' | 'formNodeId'
    >,
    value: string,
  ) => {
    const patch: Partial<Question> = { [field]: value || null };
    if (field === 'gradeNodeId')
      Object.assign(patch, {
        domainNodeId: null,
        chapterNodeId: null,
        lessonNodeId: null,
        formNodeId: null,
      });
    if (field === 'domainNodeId')
      Object.assign(patch, { chapterNodeId: null, lessonNodeId: null, formNodeId: null });
    if (field === 'chapterNodeId') Object.assign(patch, { lessonNodeId: null, formNodeId: null });
    if (field === 'lessonNodeId') Object.assign(patch, { formNodeId: null });
    setDraft((current) => ({ ...current, ...patch }));
  };

  function readSource() {
    try {
      const rows = parseExTest(draft.rawSource);
      if (rows.length !== 1)
        throw new Error('Trình sửa chỉ nhận một câu; hãy dùng Nhập .tex cho nhiều câu.');
      const parsed = rows[0];
      const updated = applyParsedMetadata(draft, parsed, data.curriculumNodes);
      if (draft.tags.includes('curriculum:kntt-2026')) {
        for (const key of [
          'gradeNodeId',
          'domainNodeId',
          'chapterNodeId',
          'lessonNodeId',
          'formNodeId',
          'level',
          'classificationCode',
          'displayId',
          'sequenceNumber',
          'idLocked',
        ] as const)
          Object.assign(updated, { [key]: draft[key] });
      }
      setDraft(updated);
      toast(
        parsed.sourceId
          ? `Đã đọc ID6 ${parsed.sourceId} từ ${parsed.sourceIdOrigin}; kiểm tra phân loại rồi lưu.`
          : 'Chưa tìm thấy một ID6 hợp lệ duy nhất; kiểm tra cảnh báo và phân loại thủ công.',
      );
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  async function save() {
    try {
      let saved: Question | undefined;
      await commit((snapshot) => {
        const current = question
          ? snapshot.questions.find((item) => item.id === question.id)
          : undefined;
        if (question && (!current || current.updatedAt !== question.updatedAt))
          throw new Error(
            'Câu đã thay đổi sau khi mở trình sửa. Đóng và mở lại để tránh ghi đè phiên bản mới.',
          );
        saved = prepareEditedQuestion(draft, current, snapshot.questions, snapshot.curriculumNodes);
        return {
          ...snapshot,
          questions: current
            ? snapshot.questions.map((item) => (item.id === saved!.id ? saved! : item))
            : [...snapshot.questions, saved],
          revisions: current
            ? [
                ...snapshot.revisions,
                {
                  id: crypto.randomUUID(),
                  questionId: current.id,
                  snapshot: JSON.stringify(current),
                  reason: 'Chỉnh sửa LaTeX',
                  createdAt: saved.updatedAt,
                },
              ]
            : snapshot.revisions,
        };
      });
      if (!saved) return;
      toast(question ? 'Đã lưu phiên bản câu hỏi.' : 'Đã thêm câu hỏi.');
      useQuestionBank.getState().select(saved.id);
      onClose();
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  saveRef.current = save;

  const select = (label: string, field: keyof Question, rows: CurriculumNode[]) => (
    <label className="field">
      {label}
      <select
        disabled={Boolean(detected.value?.sourceId) || Boolean(question?.idLocked)}
        value={String(displayed[field] ?? '')}
        onChange={(event) => setNode(field as never, event.target.value)}
      >
        <option value="">— Chưa chọn —</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.code} · {row.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal
      title={question ? `Sửa ${question.displayId || 'câu nháp'}` : 'Thêm câu hỏi'}
      subtitle="Soạn bằng LaTeX. Đáp án, lời giải và ID6 được đọc từ mã khi lưu."
      className="qb-editor-dialog"
      onClose={close}
      wide
    >
      <div className="modal-body qb-editor-modal">
        <div className="qb-editor-grid">
          <div className="qb-editor-workspace">
            <div className="qb-editor-source-toolbar">
              <div className="qb-editor-tabs">
                <button
                  className={`button small ${view === 'source' ? 'primary' : 'secondary'}`}
                  onClick={() => setView('source')}
                >
                  <Code2 size={14} /> Mã LaTeX
                </button>
                <button
                  className={`button small ${view === 'split' ? 'primary' : 'secondary'}`}
                  onClick={() => setView('split')}
                >
                  <Columns2 size={14} /> Song song
                </button>
                <button
                  className={`button small ${view === 'preview' ? 'primary' : 'secondary'}`}
                  onClick={() => setView('preview')}
                >
                  <Eye size={14} /> Xem trước
                </button>
              </div>
              <span>
                {draft.rawSource.split('\n').length} dòng ·{' '}
                {draft.rawSource.length.toLocaleString('vi')} ký tự
              </span>
            </div>
            <div className={view === 'split' ? 'qb-editor-split' : ''}>
              {view !== 'preview' && (
                <textarea
                  className="qb-source-editor"
                  aria-label="Mã LaTeX"
                  spellCheck={false}
                  value={draft.rawSource}
                  onChange={(event) => setDraft({ ...draft, rawSource: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab') {
                      event.preventDefault();
                      const input = event.currentTarget;
                      const start = input.selectionStart;
                      const end = input.selectionEnd;
                      setDraft({
                        ...draft,
                        rawSource:
                          draft.rawSource.slice(0, start) + '  ' + draft.rawSource.slice(end),
                      });
                      requestAnimationFrame(() => {
                        input.selectionStart = input.selectionEnd = start + 2;
                      });
                    }
                  }}
                />
              )}
              {view !== 'source' && (
                <div className="qb-editor-live">
                  <QuestionPreview
                    renderTikz={!compilerOpen}
                    source={previewSource}
                    answer={displayedAnswer}
                    solution={displayedSolution}
                    onRequestCompile={() => setCompilerOpen(true)}
                  />
                </div>
              )}
            </div>
            <div className="qb-editor-source-toolbar" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="button secondary small"
                disabled={busy || !detected.value}
                onClick={readSource}
              >
                <ScanText size={14} /> Đọc thông tin từ LaTeX
              </button>
              <span>Thông tin được đọc lại khi lưu.</span>
            </div>
            {detected.error || detected.value?.warnings.length ? (
              <div className="qb-editor-diagnostics" role="status">
                {detected.error ? (
                  <p>{detected.error}</p>
                ) : (
                  detected.value?.warnings.map((warning) => <p key={warning}>{warning}</p>)
                )}
              </div>
            ) : null}
            <details className="qb-editor-optional">
              <summary>Đáp án và lời giải đọc từ LaTeX</summary>
              <div className="form-grid">
                <label className="field">
                  Đáp án
                  <textarea aria-label="Đáp án" rows={3} value={displayedAnswer} readOnly />
                </label>
                <label className="field">
                  Lời giải
                  <textarea aria-label="Lời giải" rows={3} value={displayedSolution} readOnly />
                </label>
              </div>
            </details>
          </div>
          <div className="qb-metadata-fields">
            <label className="field">
              Loại câu
              <select value={detected.value?.questionType ?? draft.questionType} disabled>
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Mức độ
              <select
                value={
                  (!draft.tags.includes('curriculum:kntt-2026') &&
                    detected.value?.sourceId &&
                    inspectId6(detected.value.sourceId).level) ||
                  draft.level
                }
                disabled={Boolean(detected.value?.sourceId) || Boolean(question?.idLocked)}
                onChange={(event) =>
                  setDraft({ ...draft, level: event.target.value as Question['level'] })
                }
              >
                {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <details className="qb-editor-optional" open={!question || Boolean(draft.gradeNodeId)}>
              <summary>
                Phân loại theo cây ID6{' '}
                {sourceInspection?.classificationCode || classificationCode
                  ? `· ${sourceInspection?.classificationCode || classificationCode}`
                  : '· chưa chọn'}
              </summary>
              {detected.value?.sourceId && (
                <p className="muted" style={{ fontSize: 10, marginBottom: 10 }}>
                  ID nguồn trong LaTeX: {detected.value.sourceId}.{' '}
                  {draft.tags.includes('curriculum:kntt-2026')
                    ? 'Mã KNTT đã duyệt được lưu riêng; quét và duyệt lại để đổi phân loại.'
                    : 'Đổi phân loại bằng cách sửa ID trong LaTeX.'}
                </p>
              )}
              {select('Lớp', 'gradeNodeId', grades)}
              {select('Mạch kiến thức', 'domainNodeId', domains)}
              {select('Chương', 'chapterNodeId', chapters)}
              {select('Bài', 'lessonNodeId', lessons)}
              {select('Dạng', 'formNodeId', forms)}
            </details>
            <details className="qb-editor-optional">
              <summary>Thông tin bổ sung · yêu cầu cần đạt, nguồn, nhãn</summary>
              <label className="field">
                Yêu cầu cần đạt
                <select
                  value={draft.primaryOutcomeId ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, primaryOutcomeId: event.target.value || null })
                  }
                >
                  <option value="">— Chưa chọn —</option>
                  {outcomes.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} · {row.content}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Nguồn
                <input
                  value={draft.source}
                  maxLength={1000}
                  onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                />
              </label>
              <label className="field">
                Nhãn, phân cách bằng dấu phẩy
                <input
                  value={draft.tags.join(', ')}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      tags: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 100),
                    })
                  }
                />
              </label>
              <label className="field">
                Trạng thái
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value as Question['status'] })
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </details>
            <div className="qb-id-preview">
              <span>Mã sẽ lưu</span>
              <strong>
                {(draft.tags.includes('curriculum:kntt-2026')
                  ? draft.displayId
                  : detected.value?.sourceId) ||
                  (classificationCode
                    ? `${classificationCode}-${String(draft.sequenceNumber ?? 'TỰ ĐỘNG').padStart(3, '0')}`
                    : 'Chưa đủ cây phân loại')}
              </strong>
            </div>
          </div>
        </div>
      </div>
      {compilerOpen && (
        <TexLivePreview source={draft.rawSource} onClose={() => setCompilerOpen(false)} />
      )}
      <div className="modal-footer">
        {discard ? (
          <>
            <span className="qb-discard-warning">Anh còn thay đổi chưa lưu.</span>
            <button className="button secondary" onClick={() => setDiscard(false)}>
              Tiếp tục sửa
            </button>
            <button className="button danger" onClick={onClose}>
              Bỏ thay đổi
            </button>
          </>
        ) : (
          <>
            <span className="qb-editor-shortcut">
              {dirty ? 'Có thay đổi chưa lưu' : 'Chưa có thay đổi'} · Ctrl + S để lưu
            </span>
            <button className="button secondary" onClick={close}>
              Hủy
            </button>
          </>
        )}
        <button
          className="button primary"
          disabled={busy || !detected.value}
          onClick={() => void save()}
        >
          <Save size={15} /> {busy ? 'Đang lưu…' : 'Lưu câu hỏi'}
        </button>
      </div>
    </Modal>
  );
}
