import { useEffect, useState } from 'react';
import { useQuestionBank } from './store';
import { useWorkspace, errorText } from '../../app/store';
import { useUi } from '../../app/ui';
import { useToasts } from '../../components/feedback';
import { saveModuleSetting } from '../../services/moduleSettings';
import { saveFile } from '../../services/files';
import {
  examMatrixSchema,
  newExamMatrix,
  planExamMatrix,
  commitMatrixExam,
  type ExamMatrix,
  type MatrixPlan,
} from './domain/examMatrix';
import { examToLatex } from './domain/exams';
import type { Exam } from './domain/model';
import { QuestionPreview } from './components/QuestionPreview';
import { TexLivePreview } from './components/TexLivePreview';
import './exam-builder.css';

function loadDraft(): ExamMatrix {
  try {
    return examMatrixSchema.parse(
      JSON.parse(useWorkspace.getState().data.settings.moduleState?.examMatrixDraft ?? ''),
    );
  } catch {
    return newExamMatrix();
  }
}
const TYPES = [
  ['', 'Mọi loại'],
  ['multiple_choice', 'Trắc nghiệm'],
  ['true_false', 'Đúng / sai'],
  ['short_answer', 'Trả lời ngắn'],
  ['essay', 'Tự luận'],
  ['multi_part', 'Nhiều phần'],
];
export default function ExamBuilderPage() {
  const data = useQuestionBank((s) => s.data),
    ready = useQuestionBank((s) => s.ready),
    busy = useQuestionBank((s) => s.busy),
    bankError = useQuestionBank((s) => s.error);
  const push = useToasts((s) => s.push);
  const [draft, setDraft] = useState(loadDraft),
    [dirty, setDirty] = useState(false);
  const [plan, setPlan] = useState<MatrixPlan | null>(null),
    [error, setError] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [selected, setSelected] = useState(''),
    [tex, setTex] = useState(false);
  useEffect(() => {
    void useQuestionBank.getState().initialize();
  }, []);
  useEffect(() => {
    const previous = useUi.getState().navigationGuard;
    const guard = () =>
      !dirty || window.confirm('Ma trận chưa lưu nháp. Rời trang và bỏ các thay đổi này?');
    useUi.setState({ navigationGuard: guard });
    return () => {
      if (useUi.getState().navigationGuard === guard) useUi.setState({ navigationGuard: previous });
    };
  }, [dirty]);
  function update(next: ExamMatrix) {
    setDraft(next);
    setDirty(true);
    setTex(false);
    setPlan(null);
    setError('');
  }
  function patchRow(index: number, patch: Partial<ExamMatrix['rows'][number]>) {
    update({ ...draft, rows: draft.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  }
  function preview() {
    try {
      const next = planExamMatrix(useQuestionBank.getState().data, draft);
      setPlan(next);
      setSelected(next.rows.flatMap((r) => r.questions)[0]?.id ?? '');
      setError('');
    } catch (e) {
      setPlan(null);
      setError(errorText(e));
    }
  }
  async function persistDraft() {
    try {
      await saveModuleSetting('examMatrixDraft', JSON.stringify(examMatrixSchema.parse(draft)));
      setDirty(false);
      push('Đã lưu nháp ma trận.');
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function saveExam() {
    if (!plan) return;
    try {
      let title = '';
      await useQuestionBank.getState().commit((s) => {
        const result = commitMatrixExam(s, plan);
        title = result.exam.title;
        return result.snapshot;
      });
      setPlan(null);
      push(`Đã lưu đề “${title}” và snapshot các câu hỏi.`);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function exportExam(exam: Exam) {
    try {
      const filename = exam.title.replace(/[<>:"/\\|?*]/g, '-');
      if (
        await saveFile(
          `${filename}.tex`,
          new TextEncoder().encode(examToLatex(useQuestionBank.getState().data, exam)),
          'text/plain',
        )
      )
        push('Đã xuất mã ex_test và đáp án của bản đề đã lưu.');
    } catch (e) {
      setError(errorText(e));
    }
  }
  if (!ready) return <div className="page-loading">{bankError || 'Đang mở dữ liệu tạo đề…'}</div>;
  const questions = plan?.rows.flatMap((r) => r.questions) ?? [];
  const current = questions.find((q) => q.id === selected);
  const nodes = data.curriculumNodes.filter(
    (n) => !n.archived && ['grade', 'chapter', 'lesson', 'form'].includes(n.kind),
  );
  return (
    <div className="exam-builder-page">
      <header>
        <div>
          <div className="eyebrow">ACADEMIC DESKTOP STUDIO</div>
          <h1>Tạo đề theo ma trận</h1>
          <p>Chỉ lấy câu đã duyệt. Kiểm tra thiếu câu trước khi lưu và giữ nguyên mã LaTeX.</p>
        </div>
        <button className="button secondary" disabled={!dirty} onClick={() => void persistDraft()}>
          Lưu nháp ma trận
        </button>
      </header>
      <section className="panel exam-spec" aria-label="Thông tin đề">
        <label className="field">
          Tên đề
          <input
            aria-label="Tên đề"
            value={draft.title}
            maxLength={200}
            onChange={(e) => update({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="field">
          Thời gian (phút)
          <input
            type="number"
            min={1}
            max={1440}
            value={draft.durationMinutes}
            onChange={(e) => update({ ...draft, durationMinutes: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          Hạt trộn
          <input
            aria-label="Hạt trộn"
            value={draft.seed}
            maxLength={100}
            onChange={(e) => update({ ...draft, seed: e.target.value })}
          />
        </label>
      </section>
      <section className="panel" aria-label="Ma trận đề">
        <div className="exam-table-scroll">
          <table className="exam-matrix-table">
            <thead>
              <tr>
                <th>Chương trình</th>
                <th>Mức độ</th>
                <th>Loại câu</th>
                <th>Số câu</th>
                <th>Điểm/câu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.rows.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <select
                      aria-label={`Chương trình ô ${index + 1}`}
                      value={row.nodeId}
                      onChange={(e) => patchRow(index, { nodeId: e.target.value })}
                    >
                      <option value="">Toàn bộ ngân hàng</option>
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.kind} · {n.code} · {n.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Mức độ ô ${index + 1}`}
                      value={row.level}
                      onChange={(e) =>
                        patchRow(index, { level: e.target.value as typeof row.level })
                      }
                    >
                      <option value="">Mọi mức</option>
                      {['N', 'H', 'V', 'C'].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Loại câu ô ${index + 1}`}
                      value={row.type}
                      onChange={(e) => patchRow(index, { type: e.target.value as typeof row.type })}
                    >
                      {TYPES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Số câu ô ${index + 1}`}
                      type="number"
                      min={1}
                      max={200}
                      value={row.count}
                      onChange={(e) => patchRow(index, { count: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Điểm mỗi câu ô ${index + 1}`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.points / 100}
                      onChange={(e) =>
                        patchRow(index, { points: Math.round(Number(e.target.value) * 100) })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      aria-label={`Xóa ô ${index + 1}`}
                      disabled={draft.rows.length === 1}
                      onClick={() =>
                        update({ ...draft, rows: draft.rows.filter((r) => r.id !== row.id) })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="exam-toolbar">
          <button
            className="button secondary"
            disabled={draft.rows.length >= 40}
            onClick={() =>
              update({
                ...draft,
                rows: [
                  ...draft.rows,
                  {
                    id: crypto.randomUUID(),
                    nodeId: '',
                    level: '',
                    type: '',
                    count: 1,
                    points: 100,
                  },
                ],
              })
            }
          >
            Thêm ô ma trận
          </button>
          <span>
            {draft.rows.reduce((n, r) => n + r.count, 0)} câu yêu cầu ·{' '}
            {(draft.rows.reduce((n, r) => n + r.count * r.points, 0) / 100).toFixed(2)} điểm
          </span>
          <button className="button primary" disabled={busy} onClick={preview}>
            Kiểm tra và xem trước
          </button>
        </div>
      </section>
      {error && (
        <p className="panel" role="alert">
          {error}
        </p>
      )}
      {plan && (
        <section className="panel exam-plan" aria-label="Kết quả ma trận">
          <h2>{plan.complete ? 'Ma trận đủ câu' : 'Ma trận thiếu câu'}</h2>
          <p>
            {questions.length} câu được chọn · {(plan.totalPoints / 100).toFixed(2)} điểm. Câu trùng
            nội dung chỉ được dùng một lần.
          </p>
          <ul>
            {plan.rows.map((row, index) => (
              <li key={row.rowId}>
                Ô {index + 1}: {row.available} câu phù hợp · đã chọn {row.questions.length}
                {row.missing ? ` · thiếu ${row.missing} câu (kể cả phần giao với ô khác)` : ''}
              </li>
            ))}
          </ul>
          <div className="exam-preview-grid">
            <ol className="exam-picked">
              {questions.map((q, index) => (
                <li key={q.id}>
                  <button
                    className={`button ${selected === q.id ? 'primary' : 'secondary'}`}
                    onClick={() => setSelected(q.id)}
                  >
                    {index + 1}. {q.displayId || 'Chưa có ID'} · {q.level}
                  </button>
                </li>
              ))}
            </ol>
            <div className="exam-question-preview">
              {current && (
                <>
                  <h3>Câu {questions.findIndex((q) => q.id === selected) + 1}</h3>
                  <QuestionPreview source={current.rawSource} />
                  <details>
                    <summary>Mã LaTeX gốc</summary>
                    <pre>{current.rawSource}</pre>
                  </details>
                </>
              )}
            </div>
          </div>
          <div className="exam-toolbar">
            <button
              className="button secondary"
              disabled={!questions.length}
              onClick={() => setTex(true)}
            >
              Biên dịch bản xem trước
            </button>
            <button
              className="button primary"
              disabled={!plan.complete || busy}
              onClick={() => void saveExam()}
            >
              Lưu đề và khóa snapshot
            </button>
          </div>
        </section>
      )}
      <section className="panel" aria-label="Đề đã lưu">
        <h2>Đề đã lưu ({data.exams.length})</h2>
        <p>
          Xuất mã ex_test và đáp án từ snapshot. Tệp .tex cần preamble và các ảnh gốc tương ứng để
          biên dịch.
        </p>
        {data.exams
          .slice()
          .reverse()
          .slice(historyPage * 30, (historyPage + 1) * 30)
          .map((exam) => (
            <div className="exam-saved-row" key={exam.id}>
              <span>
                <strong>{exam.title}</strong> · {exam.durationMinutes} phút ·{' '}
                {data.examItems.filter((item) => item.examId === exam.id).length} câu
              </span>
              <button className="button secondary" onClick={() => void exportExam(exam)}>
                Xuất .tex
              </button>
              {exam.matrixJson && (
                <button
                  className="button secondary"
                  onClick={() => {
                    if (dirty && !window.confirm('Thay ma trận đang sửa bằng ma trận của đề này?'))
                      return;
                    try {
                      update(examMatrixSchema.parse(JSON.parse(exam.matrixJson)));
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                >
                  Dùng lại ma trận
                </button>
              )}
            </div>
          ))}
        <div className="exam-toolbar">
          <button
            className="button secondary"
            disabled={historyPage === 0}
            onClick={() => setHistoryPage((p) => p - 1)}
          >
            Đề mới hơn
          </button>
          <span>
            Trang {historyPage + 1} / {Math.max(1, Math.ceil(data.exams.length / 30))}
          </span>
          <button
            className="button secondary"
            disabled={(historyPage + 1) * 30 >= data.exams.length}
            onClick={() => setHistoryPage((p) => p + 1)}
          >
            Đề cũ hơn
          </button>
        </div>
      </section>
      {tex && (
        <TexLivePreview
          source={questions.map((q) => q.rawSource).join('\n\n')}
          items={questions.map((q, index) => ({
            id: q.id,
            label: `Câu ${index + 1}`,
            source: q.rawSource,
          }))}
          onClose={() => setTex(false)}
        />
      )}
    </div>
  );
}
