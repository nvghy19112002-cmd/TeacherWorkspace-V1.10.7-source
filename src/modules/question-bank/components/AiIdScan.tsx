import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { useToasts } from '../../../components/feedback';
import { useUi } from '../../../app/ui';
import { errorText, useWorkspace } from '../../../app/store';
import { readAiState } from '../../ai-tools/services/state';
import { structuredTextModelReason } from '../../ai-tools/domain/modelCapabilities';
import { KnttSetup } from './KnttSetup';
import { KnttCatalogStatus } from './KnttCatalogStatus';
import { QuestionPreview } from './QuestionPreview';
import { rejectClassificationRun } from '../domain/classificationReview';
import { saveFile } from '../../../services/files';
import { acceptKnttRun } from '../domain/kntt';
import { acceptKnttBatch, pendingKnttRuns } from '../domain/batchApproval';
import {
  classificationContext,
  scanMetadata,
  scanPreflight,
  resultForSelection,
  resultPathError,
} from '../domain/classificationContext';
import { curriculumPath } from '../domain/curriculum';
import { runScanQueue, restoreScanJob, resumableRow, type ScanQueueRow } from '../domain/scanQueue';
import { classificationResultSchema } from '../domain/classification';
import { activeClassificationPrompt, promptFingerprint } from '../domain/classificationPrompts';
import { saveModuleSetting } from '../../../services/moduleSettings';
import { AiRequestError } from '../../ai-tools/services/requestManager';
import {
  LEVEL_LABELS,
  type Question,
  type ClassificationRun,
  type BankSnapshot,
} from '../domain/model';
import { classifyQuestionOnline } from '../services/classificationProvider';
import { useQuestionBank } from '../store';
import { beginScanSession, finishScanSession } from '../services/scanSession';
import './ai-id-scan.css';
const statusNames = {
  pending: 'Chờ quét',
  running: 'Đang phân tích',
  completed: 'Đã lưu đề xuất',
  retrying: 'Đang chờ thử lại',
  paused: 'Đã tạm dừng',
  cancelled: 'Đã hủy yêu cầu',
  needs_review: 'Cần giáo viên kiểm tra',
  failed: 'Lỗi',
};
function Suggestion({
  run,
  data,
  disabled,
  onError,
  onEdit,
}: {
  run: ClassificationRun;
  data: BankSnapshot;
  disabled: boolean;
  onError: (message: string) => void;
  onEdit: (id: string, dirty: boolean) => void;
}) {
  const toast = useToasts((s) => s.push);
  const parsed = (() => {
    try {
      return {
        raw: JSON.parse(run.resultJson),
        result: classificationResultSchema.parse(JSON.parse(run.resultJson)),
      };
    } catch {
      return null;
    }
  })();
  const [formId, setFormId] = useState(parsed?.result.formId ?? '');
  const [lessonId, setLessonId] = useState(parsed?.result.lessonId ?? '');
  const [level, setLevel] = useState<Question['level']>(parsed?.result.level ?? 'N');
  const [reason, setReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [touched, setTouched] = useState(false);
  if (!parsed) return <p>Đề xuất cũ không hợp lệ; quét lại để nhận kết quả mới.</p>;
  const { raw, result } = parsed;
  const question = data.questions.find((q) => q.id === run.questionId && !q.deletedAt);
  let context;
  let scopeError = '';
  try {
    context = classificationContext(data, raw.__scopeId ?? '');
  } catch (e) {
    scopeError = errorText(e);
  }
  const forms = context?.forms ?? [];
  const lessons =
    context?.nodes.filter((n) => n.kind === 'lesson' && forms.some((f) => f.parentId === n.id)) ??
    [];
  const edited = touched || formId !== (result.formId ?? '') || level !== result.level;
  let corrected = result,
    pathError = '';
  try {
    if (edited) corrected = resultForSelection(data, result, formId, level);
    pathError = resultPathError(data, corrected);
  } catch (e) {
    pathError = errorText(e);
  }
  const metadata = question ? scanMetadata(data, question, raw.__scopeId ?? '') : null;
  const stale =
    !metadata ||
    raw.__scheme !== metadata.__scheme ||
    raw.__sourceFingerprint !== metadata.__sourceFingerprint ||
    raw.__sourceUpdatedAt !== metadata.__sourceUpdatedAt ||
    raw.__contextFingerprint !== metadata.__contextFingerprint;
  const sourceBlocked = !question
    ? 'Câu không còn trong kho.'
    : question.idLocked
      ? 'ID đã khóa do dùng trong đề.'
      : stale
        ? 'Câu hoặc cây KNTT đã đổi. Hãy quét lại.'
        : '';
  const quality =
    result.dataCheck !== 'valid'
      ? 'Dữ kiện chưa đủ rõ để duyệt. Sửa nguồn và quét lại.'
      : !edited && ['insufficient_data', 'out_of_scope', 'off_target'].includes(result.alignment)
        ? 'AI chưa xác định được phân loại; cần chọn lại đường dẫn và ghi lý do.'
        : '';
  const problem = sourceBlocked || scopeError || pathError || quality;
  const reset = () => {
    setTouched(true);
    onEdit(run.id, true);
  };
  async function apply() {
    if (
      !window.confirm(
        'Anh xác nhận đã đối chiếu câu hỏi, bài KNTT, dạng và mức độ, và muốn áp dụng phân loại này?',
      )
    )
      return;
    try {
      await useQuestionBank
        .getState()
        .commit((s) => acceptKnttRun(s, run.id, edited ? { formId, level, reason } : undefined));
      onEdit(run.id, false);
      toast('Đã cập nhật phân loại KNTT. Trạng thái câu phản ánh việc kiểm tra đáp án.');
    } catch (e) {
      onError(errorText(e));
    }
  }
  return (
    <details className="qb-ai-result">
      <summary>
        {question?.displayId || 'Câu chưa có ID'} ·{' '}
        {corrected.proposedClassificationCode || 'Chưa đủ mã'} ·{' '}
        {run.accepted
          ? 'Đã áp dụng'
          : raw.__teacherRejected
            ? 'Đã từ chối'
            : stale
              ? 'Cần quét lại'
              : 'Chờ giáo viên duyệt'}
      </summary>
      <small>
        {run.model} · {raw.__promptVersion || 'Prompt cũ chưa có phiên bản'} ·{' '}
        {new Date(run.createdAt).toLocaleString('vi-VN')} · {Math.round(result.confidence * 100)}%
        do AI tự đánh giá
      </small>
      <p className="muted">
        Token: {raw.__usage?.totalTokenCount ?? 'không được provider báo cáo'} · Chi phí: chưa có
        đơn giá để tính.
      </p>
      <div className="qb-ai-review-grid">
        <section>
          <h4>Câu hỏi đang đối chiếu</h4>
          {question && (
            <QuestionPreview
              source={question.rawSource}
              answer={question.answer}
              solution={question.solution}
            />
          )}
        </section>
        <section>
          <h4>Phân loại đề xuất</h4>
          <p className="muted">
            Duyệt phân loại không tự xác nhận chất lượng nội dung. Câu mới vẫn cần duyệt đáp án/lời
            giải trước khi ra đề.
          </p>
          <p>{result.reasoningSummary}</p>
          <p>
            <strong>Đường dẫn AI:</strong>{' '}
            {result.formId ? curriculumPath(data, result.formId) : 'Chưa xác định dạng'}
          </p>
          <p>
            <strong>Mã lưu:</strong> {corrected.proposedClassificationCode || 'Chưa xác định'}
          </p>
          <p>
            <strong>Đáp án AI:</strong> {result.independentAnswer || 'Chưa xác định'} ·{' '}
            {result.answerCheck}
          </p>
          {result.answerCheck !== 'correct' && (
            <p className="qb-ai-warning">
              Duyệt ID không đồng nghĩa đáp án đúng. Câu sẽ ở trạng thái{' '}
              {result.answerCheck === 'incorrect' ? 'cần sửa' : 'cần kiểm tra'}.
            </p>
          )}
          {result.evidence.length > 0 && (
            <ul>
              {result.evidence.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          )}
          {result.warnings.map((v, i) => (
            <p className="qb-ai-warning" key={i}>
              {v}
            </p>
          ))}
          {raw.__teacherRejected && (
            <p className="qb-ai-warning">Giáo viên từ chối: {raw.__teacherRejected.reason}</p>
          )}
          {!run.accepted && !raw.__teacherRejected && (
            <>
              <label className="field">
                Bài KNTT sau đối chiếu
                <select
                  aria-label="Bài duyệt KNTT"
                  value={lessonId}
                  disabled={disabled}
                  onChange={(e) => {
                    setLessonId(e.target.value);
                    setFormId('');
                    reset();
                  }}
                >
                  <option value="">Chọn bài…</option>
                  {lessons.map((n) => (
                    <option key={n.id} value={n.id}>
                      {curriculumPath(data, n.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Dạng bài sau đối chiếu
                <select
                  aria-label="Dạng duyệt KNTT"
                  value={formId}
                  disabled={disabled}
                  onChange={(e) => {
                    setFormId(e.target.value);
                    reset();
                  }}
                >
                  <option value="">Chọn dạng…</option>
                  {forms
                    .filter((n) => n.parentId === lessonId)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.code}. {n.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Mức độ sau đối chiếu
                <select
                  aria-label="Mức độ duyệt KNTT"
                  value={level}
                  disabled={disabled}
                  onChange={(e) => {
                    setLevel(e.target.value as Question['level']);
                    reset();
                  }}
                >
                  {Object.entries(LEVEL_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {edited && (
                <label className="field">
                  Lý do sửa phân loại
                  <input
                    aria-label="Lý do sửa ID"
                    maxLength={400}
                    value={reason}
                    disabled={disabled}
                    onChange={(e) => {
                      setReason(e.target.value);
                      reset();
                    }}
                  />
                </label>
              )}
              {edited && (
                <button
                  className="button secondary small"
                  disabled={disabled}
                  onClick={() => {
                    setFormId(result.formId ?? '');
                    setLessonId(result.lessonId ?? '');
                    setLevel(result.level);
                    setReason('');
                    setTouched(false);
                    onEdit(run.id, false);
                  }}
                >
                  Hủy chỉnh sửa đề xuất
                </button>
              )}
              {problem && <p role="alert">{problem}</p>}
              <button
                className="button primary small"
                disabled={disabled || Boolean(problem) || (edited && reason.trim().length < 5)}
                onClick={() => void apply()}
              >
                Duyệt và áp dụng phân loại
              </button>
              <label className="field">
                Lý do từ chối
                <input
                  aria-label="Lý do từ chối đề xuất"
                  value={rejectionReason}
                  maxLength={500}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={disabled}
                />
              </label>
              <button
                className="button secondary small"
                disabled={disabled || rejectionReason.trim().length < 5}
                onClick={() =>
                  void useQuestionBank
                    .getState()
                    .commit((s) => rejectClassificationRun(s, run.id, rejectionReason))
                    .then(() => {
                      onEdit(run.id, false);
                      toast('Đã từ chối đề xuất; ID câu được giữ nguyên.');
                    })
                    .catch((e) => onError(errorText(e)))
                }
              >
                Từ chối đề xuất
              </button>
            </>
          )}
          {raw.__teacherCorrection && <p>Giáo viên sửa: {raw.__teacherCorrection.reason}</p>}
        </section>
      </div>
    </details>
  );
}
export function AiIdScan({
  questions,
  onClose,
  embedded = false,
}: {
  questions: Question[];
  onClose: () => void;
  embedded?: boolean;
}) {
  const data = useQuestionBank((s) => s.data),
    busy = useQuestionBank((s) => s.busy);
  const settings = useWorkspace((s) => s.data.settings);
  const model = readAiState(settings.moduleState?.aiTools).model;
  const modelIncompatibility = model ? structuredTextModelReason(model) : null;
  const prompt = activeClassificationPrompt(settings.moduleState?.classificationPrompts);
  const restored = restoreScanJob(settings.moduleState?.classificationJob);
  const selectionIds = new Set(questions.map((q) => q.id));
  const matchingJob =
    restored && restored.rows.every((r) => selectionIds.has(r.id)) ? restored : null;
  const [running, setRunning] = useState(false),
    [started, setStarted] = useState(embedded || Boolean(matchingJob)),
    [error, setError] = useState('');
  const [scopeId, setScopeId] = useState(matchingJob?.scopeId ?? ''),
    [force, setForce] = useState(false),
    [rows, setRows] = useState<ScanQueueRow[]>(matchingJob?.rows ?? []);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [dirtyRuns, setDirtyRuns] = useState<Set<string>>(new Set());
  const [batchReport, setBatchReport] = useState<Pick<
    ReturnType<typeof acceptKnttBatch>,
    'applied' | 'skipped'
  > | null>(null);
  useEffect(() => {
    if (!dirtyRuns.size) return;
    const previous = useUi.getState().navigationGuard;
    const guard = () =>
      window.confirm('Có chỉnh sửa đề xuất chưa áp dụng. Rời màn hình và bỏ các chỉnh sửa này?') &&
      (!previous || previous());
    useUi.setState({ navigationGuard: guard });
    return () => {
      if (useUi.getState().navigationGuard === guard) useUi.setState({ navigationGuard: previous });
    };
  }, [dirtyRuns]);
  function closeScan() {
    if (
      !embedded &&
      dirtyRuns.size &&
      !window.confirm('Có chỉnh sửa đề xuất chưa áp dụng. Đóng và bỏ chỉnh sửa?')
    )
      return;
    controller.current?.abort();
    onClose();
  }
  const controller = useRef<AbortController | null>(null);
  const authorized = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const context = (() => {
    try {
      return classificationContext(data, scopeId);
    } catch {
      return { nodes: [], forms: [], learningOutcomes: [], missingLessons: [] };
    }
  })();
  const scopes = classificationContext(data).nodes.filter((n) =>
    ['grade', 'chapter', 'lesson'].includes(n.kind),
  );
  const ids = new Set(questions.map((q) => q.id));
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [allVersions, setAllVersions] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const allHistory = data.classificationRuns
    .filter((r) => ids.has(r.questionId))
    .slice()
    .reverse();
  const seen = new Set<string>();
  const history = allVersions
    ? allHistory
    : allHistory.filter((r) => {
        if (seen.has(r.questionId)) return false;
        seen.add(r.questionId);
        return true;
      });
  const filteredHistory = lowConfidenceOnly
    ? history.filter((r) => {
        try {
          return JSON.parse(r.resultJson).confidence < 0.65;
        } catch {
          return true;
        }
      })
    : history;
  const page = Math.min(historyPage, Math.max(0, Math.ceil(filteredHistory.length / 20) - 1));
  const visibleHistory = filteredHistory.slice(page * 20, page * 20 + 20);
  const failed = rows.filter(resumableRow);
  async function start(retry = false, explicitConsent = false) {
    if (controller.current || busy || !model) return;
    if (
      !authorized.current &&
      !explicitConsent &&
      !window.confirm(
        'Gửi nội dung câu hỏi, đáp án, lời giải và danh mục KNTT đến Gemini để quét ID? Có thể phát sinh phí API.',
      )
    )
      return;
    authorized.current = true;
    setStarted(true);
    setOptionsOpen(false);
    setBatchReport(null);
    const abort = beginScanSession();
    if (!abort) {
      setError('Lượt quét trước đang lưu tiến trình dừng. Hãy thử lại sau vài giây.');
      return;
    }
    controller.current = abort;
    setRunning(true);
    setError('');
    const targets = retry ? failed.map((r) => r.id) : questions.map((q) => q.id);
    if (targets.length > 1000) {
      controller.current = null;
      finishScanSession(abort);
      setRunning(false);
      setError('Mỗi lô tối đa 1.000 câu. Hãy chia nhỏ lựa chọn.');
      return;
    }
    const jobId = crypto.randomUUID();
    const retained = rows.filter((r) => !targets.includes(r.id));
    try {
      const completed = await runScanQueue(
        targets,
        abort.signal,
        async (id, onRetry) => {
          const s = useQuestionBank.getState().data;
          const q = s.questions.find((q) => q.id === id);
          if (!q) return 'Câu không còn trong kho.';
          const blocked = scanPreflight(s, q, scopeId);
          if (blocked) return blocked;
          const metadata = scanMetadata(s, q, scopeId);
          if (!force) {
            if (q.status === 'approved' && q.tags.includes('curriculum:kntt-2026'))
              return 'Câu đã duyệt KNTT; bật quét lại nếu cần rà soát.';
            const existing = s.classificationRuns.some((r) => {
              if (r.accepted || r.questionId !== id || r.model !== model) return false;
              try {
                const v = JSON.parse(r.resultJson);
                return (
                  v.__sourceFingerprint === metadata.__sourceFingerprint &&
                  v.__sourceUpdatedAt === metadata.__sourceUpdatedAt &&
                  v.__contextFingerprint === metadata.__contextFingerprint &&
                  v.__scopeId === scopeId &&
                  v.__promptFingerprint === promptFingerprint(prompt) &&
                  classificationResultSchema.safeParse(v).success &&
                  !resultPathError(s, v) &&
                  v.dataCheck === 'valid'
                );
              } catch {
                return false;
              }
            });
            if (existing) return 'Đã có đề xuất hiện hành chờ duyệt; không gọi API lại.';
          }
          const response = await classifyQuestionOnline(s, q, abort.signal, scopeId, {
            onRetry,
            prompt,
          });
          abort.signal.throwIfAborted();
          await useQuestionBank.getState().commit((latest) => ({
            ...latest,
            classificationRuns: [
              ...latest.classificationRuns,
              {
                id: crypto.randomUUID(),
                questionId: q.id,
                provider: 'gemini',
                model: response.model,
                resultJson: JSON.stringify({
                  ...response.result,
                  ...metadata,
                  __promptVersion: response.prompt.version,
                  __promptId: response.prompt.id,
                  __promptFingerprint: response.prompt.fingerprint,
                  __usage: response.usage,
                  __usageRequests: response.usageRequests,
                  __retrieval: response.retrieval,
                  __cost: response.cost,
                }),
                accepted: false,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
          return {
            needsReview:
              response.result.confidence < 0.65 ||
              response.result.dataCheck !== 'valid' ||
              response.result.alignment !== 'direct' ||
              response.result.answerCheck !== 'correct' ||
              !s.learningOutcomes.length ||
              q.hasImage,
          };
        },
        async (next) => {
          const merged = [...retained, ...next];
          await saveModuleSetting(
            'classificationJob',
            JSON.stringify({
              version: 1,
              id: jobId,
              model,
              scopeId,
              promptFingerprint: promptFingerprint(prompt),
              updatedAt: new Date().toISOString(),
              rows: merged,
            }),
          );
          setRows(merged);
        },
        (cause) => cause instanceof AiRequestError && cause.fatalBatch,
        rows,
      );
      if (completed.some((r) => r.status === 'completed')) setOptionsOpen(false);
      const firstFailure = completed.find((r) => r.status === 'failed');
      if (firstFailure) setError(firstFailure.message);
    } catch (e) {
      if (!abort.signal.aborted) setError(errorText(e));
    } finally {
      controller.current = null;
      finishScanSession(abort);
      setRunning(false);
    }
  }
  const pending = pendingKnttRuns(
    data,
    questions.map((q) => q.id),
  );
  async function approveBatch() {
    if (busy || running || dirtyRuns.size || !pending.length) return;
    if (
      !window.confirm(
        `Anh xác nhận đã đối chiếu ${pending.length} đề xuất và muốn áp dụng ID hàng loạt? Câu không đủ điều kiện sẽ được giữ lại để kiểm tra; duyệt ID không xác nhận đáp án đúng.`,
      )
    )
      return;
    try {
      let report: ReturnType<typeof acceptKnttBatch> | null = null;
      await useQuestionBank.getState().commit((current) => {
        report = acceptKnttBatch(
          current,
          questions.map((q) => q.id),
        );
        return report.snapshot;
      });
      if (report) {
        const { applied, skipped } = report as ReturnType<typeof acceptKnttBatch>;
        setBatchReport({ applied, skipped });
      }
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  const body = (
    <>
      <div className="modal-body qb-ai-scan">
        <p>
          <strong>{questions.length} câu đã chọn</strong> · Gemini ·{' '}
          {model || 'Chưa thiết lập model'}
        </p>
        {!model && (
          <p role="alert">Chưa chọn model Gemini. Vào Cài đặt → API key để thiết lập một lần.</p>
        )}
        {modelIncompatibility && (
          <p role="alert">
            {modelIncompatibility} Vào Cài đặt → Model, tải danh sách, thử JSON rồi lưu model văn
            bản.
          </p>
        )}
        {!context.forms.length && (
          <p role="alert">Phạm vi chưa có dạng bài. Mở Tùy chọn nâng cao để thiết lập.</p>
        )}
        {!started && (
          <>
            <p className="qb-ai-consent-note">
              Bấm xác nhận để gửi nội dung câu hỏi, đáp án, lời giải và danh mục KNTT đến Gemini. Có
              thể phát sinh phí API. ID chỉ đổi sau khi anh duyệt kết quả.
            </p>
            {history.length > 0 && (
              <button className="button secondary small" onClick={() => setStarted(true)}>
                Xem kết quả đã có ({history.length})
              </button>
            )}
          </>
        )}
        <details
          className="qb-ai-options"
          open={optionsOpen}
          onToggle={(e) => setOptionsOpen(e.currentTarget.open)}
        >
          <summary>Tùy chọn nâng cao</summary>
          <div>
            <KnttCatalogStatus data={data} />
            <label className="field">
              Giới hạn phạm vi theo sách KNTT
              <select
                aria-label="Phạm vi quét KNTT"
                value={scopeId}
                disabled={running || busy}
                onChange={(e) => setScopeId(e.target.value)}
              >
                <option value="">Toán 10–12 · toàn bộ cây KNTT</option>
                {scopes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {curriculumPath(data, n.id)}
                  </option>
                ))}
              </select>
            </label>
            <p>
              {context.forms.length} dạng khả dụng · {context.missingLessons.length} bài chưa có
              dạng. Chọn đúng lớp/bài giúp giảm ngữ cảnh và tránh chọn nhầm.
            </p>
            {!context.forms.length && (
              <p role="alert">
                Chưa có dạng trong phạm vi này. Thiết lập bên dưới trước khi chạy AI; app sẽ không
                gửi yêu cầu khi thiếu danh mục.
              </p>
            )}
            {!context.learningOutcomes.length && (
              <p className="qb-ai-warning">
                Phạm vi chưa có yêu cầu cần đạt đã nhập. AI chỉ đối chiếu danh mục bài/dạng; chưa
                xác nhận được mức phù hợp chương trình 2018.
              </p>
            )}
            <fieldset disabled={running || busy}>
              <KnttSetup />
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={force}
                disabled={running}
                onChange={(e) => setForce(e.target.checked)}
              />{' '}
              Quét lại cả câu đã duyệt hoặc đã có đề xuất hiện hành.
            </label>
          </div>
        </details>
        {started && (
          <>
            <p role="status">
              Đã lưu{' '}
              {
                rows.filter(
                  (r) => r.status === 'completed' || (r.status === 'needs_review' && !r.skipped),
                ).length
              }{' '}
              · Lỗi {rows.filter((r) => r.status === 'failed').length} · Bỏ qua{' '}
              {rows.filter((r) => r.skipped).length} · Chờ{' '}
              {rows.filter((r) => ['pending', 'paused', 'cancelled'].includes(r.status)).length}
              {running
                ? ` · ${rows.find((r) => r.status === 'retrying')?.message || 'Đang quét…'}`
                : ''}
            </p>
            {error && <p role="alert">{error}</p>}
            {batchReport && (
              <div role="status" className="qb-ai-batch-report">
                Đã áp dụng {batchReport.applied.length} câu · Còn {batchReport.skipped.length} câu
                cần kiểm tra.
                {batchReport.skipped.length > 0 && (
                  <details>
                    <summary>Xem câu chưa áp dụng</summary>
                    <ul>
                      {batchReport.skipped.map((r) => (
                        <li key={r.questionId}>
                          Câu {questions.findIndex((q) => q.id === r.questionId) + 1}: {r.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {dirtyRuns.size > 0 && (
              <p className="qb-ai-warning">
                Có đề xuất đang chỉnh sửa. Duyệt từng câu đã sửa trước khi duyệt hàng loạt.
              </p>
            )}
            {rows.length > 0 && (
              <details>
                <summary>Tiến trình từng câu</summary>
                <ul className="qb-ai-queue">
                  {rows.map((r, i) => (
                    <li key={r.id}>
                      <strong>
                        Câu {questions.findIndex((q) => q.id === r.id) + 1 || i + 1}:{' '}
                        {statusNames[r.status]}
                      </strong>{' '}
                      {r.message}
                      {r.diagnostic && (
                        <details>
                          <summary>Diagnostics</summary>
                          <pre>{r.diagnostic}</pre>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <h3>Đề xuất để đối chiếu ({filteredHistory.length})</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={lowConfidenceOnly}
                onChange={(e) => {
                  setLowConfidenceOnly(e.target.checked);
                  setHistoryPage(0);
                }}
              />{' '}
              Chỉ xem độ tin cậy dưới 65%
            </label>
            <details className="qb-ai-history-options">
              <summary>Lịch sử các lần quét</summary>
              <label>
                <input
                  type="checkbox"
                  checked={allVersions}
                  onChange={(e) => {
                    setAllVersions(e.target.checked);
                    setHistoryPage(0);
                  }}
                />{' '}
                Xem cả các lần quét cũ của từng câu
              </label>
            </details>
            {filteredHistory.length > 20 && (
              <div className="qb-ai-history-pages">
                <button
                  className="button secondary small"
                  disabled={page === 0}
                  onClick={() => setHistoryPage(page - 1)}
                >
                  Trang trước
                </button>
                <span>
                  {page + 1}/{Math.ceil(filteredHistory.length / 20)}
                </span>
                <button
                  className="button secondary small"
                  disabled={(page + 1) * 20 >= filteredHistory.length}
                  onClick={() => setHistoryPage(page + 1)}
                >
                  Trang sau
                </button>
              </div>
            )}
            {visibleHistory.map((run) => (
              <Suggestion
                key={run.id}
                run={run}
                data={data}
                disabled={busy || running}
                onError={setError}
                onEdit={(id, dirty) =>
                  setDirtyRuns((current) => {
                    const next = new Set(current);
                    if (dirty) next.add(id);
                    else next.delete(id);
                    return next;
                  })
                }
              />
            ))}
            {!history.length && <p>Chưa có đề xuất cho các câu đã chọn.</p>}
          </>
        )}
      </div>
      <div className="modal-footer">
        {started && (
          <button
            className="button secondary"
            onClick={() =>
              void saveFile(
                `TeacherWorkspace-AI-${Date.now()}.json`,
                new TextEncoder().encode(
                  JSON.stringify(
                    {
                      type: 'teacher-workspace-ai-report',
                      generatedAt: new Date().toISOString(),
                      model,
                      scopeId,
                      rows,
                      runs: allHistory,
                    },
                    null,
                    2,
                  ),
                ),
                'application/json',
              ).catch((e) => setError(errorText(e)))
            }
          >
            Xuất báo cáo quét
          </button>
        )}
        {running ? (
          <button className="button secondary" onClick={() => controller.current?.abort()}>
            Dừng quét
          </button>
        ) : (
          <button className="button secondary" onClick={closeScan}>
            Đóng
          </button>
        )}
        {!running && failed.length > 0 && (
          <button
            className="button secondary"
            disabled={busy || !model || Boolean(modelIncompatibility) || !context.forms.length}
            onClick={() => void start(true)}
          >
            Thử lại câu lỗi / tiếp tục ({failed.length})
          </button>
        )}
        {started && pending.length > 0 && (
          <button
            className="button primary"
            disabled={running || busy || dirtyRuns.size > 0}
            onClick={() => void approveBatch()}
          >
            Duyệt {pending.length} đề xuất
          </button>
        )}
        <button
          className={started ? 'button secondary' : 'button primary'}
          disabled={
            running ||
            busy ||
            !model ||
            Boolean(modelIncompatibility) ||
            !questions.length ||
            !context.forms.length
          }
          onClick={() => void start(false, !started)}
        >
          {started ? (embedded ? 'Quét các câu đã chọn' : 'Quét lại') : 'Xác nhận và quét'}
        </button>
      </div>
    </>
  );
  return embedded ? (
    <section className="classification-workspace" aria-label="Không gian AI phân loại">
      {body}
    </section>
  ) : (
    <Modal
      title="Gán ID tự động"
      subtitle={
        started
          ? 'Kết quả quét · Giáo viên duyệt trước khi áp dụng.'
          : 'Xác nhận để AI phân loại theo mục lục KNTT.'
      }
      onClose={closeScan}
      wide={started}
      className={started ? 'qb-ai-results-dialog' : 'qb-ai-confirm-dialog'}
    >
      {body}
    </Modal>
  );
}
