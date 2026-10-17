import { pricesSchema } from '../../ai-tools/domain/usageCost';
import { readAiState } from '../../ai-tools/services/state';
import { useEffect, useRef, useState } from 'react';
import { useWorkspace, errorText } from '../../../app/store';
import { saveModuleSetting } from '../../../services/moduleSettings';
import { useQuestionBank } from '../store';
import { CLASSIFICATION_PROMPT_VERSION } from '../domain/classification';
import {
  readPromptLibrary,
  defaultClassificationPrompt,
  addPromptVersion,
  type ClassificationPromptVersion,
} from '../domain/classificationPrompts';
import { classifyQuestionOnline } from '../services/classificationProvider';
import {
  readModelChecks,
  verifiedModel,
  readFallbackModels,
} from '../../ai-tools/domain/modelCapabilities';
import { readKeyPool } from '../../ai-tools/domain/keyPool';
import { AiRequestError } from '../../ai-tools/services/requestManager';

type TestResult = Awaited<ReturnType<typeof classifyQuestionOnline>>;
export function ClassificationPrompts() {
  const settings = useWorkspace((s) => s.data.settings);
  const pool = readKeyPool(settings.moduleState?.aiKeyPool);
  const verified = readModelChecks(settings.moduleState?.aiModelChecks).filter((c) =>
    verifiedModel(settings.moduleState?.aiModelChecks, c.model, pool.activeId ?? ''),
  );
  const fallbacks = readFallbackModels(settings.moduleState?.classificationFallbacks);
  const raw = useWorkspace((s) => s.data.settings.moduleState?.classificationPrompts);
  const data = useQuestionBank((s) => s.data);
  const library = readPromptLibrary(raw);
  const versions = [defaultClassificationPrompt, ...library.versions];
  const currentModel = readAiState(settings.moduleState?.aiTools).model;
  const [inputPrice, setInputPrice] = useState('');
  const [outputPrice, setOutputPrice] = useState('');
  const [name, setName] = useState('Phiên bản đối chiếu mới');
  const [instruction, setInstruction] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [compareId, setCompareId] = useState(defaultClassificationPrompt.id);
  const [results, setResults] = useState<{ name: string; response: TestResult }[]>([]);
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    void useQuestionBank
      .getState()
      .initialize()
      .catch((e) => setError(errorText(e)));
    return () => controller.current?.abort();
  }, []);
  async function save() {
    try {
      await saveModuleSetting(
        'classificationPrompts',
        JSON.stringify(addPromptVersion(raw, name, instruction)),
      );
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function select(id: string) {
    try {
      await saveModuleSetting(
        'classificationPrompts',
        JSON.stringify({ ...library, activeId: id }),
      );
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function test(compare: boolean) {
    const question = data.questions.find((q) => q.id === questionId && !q.deletedAt);
    if (!question || busy) return;
    if (
      !window.confirm(
        `Gửi câu đã chọn tới Gemini để thử ${compare ? 'hai phiên bản prompt' : 'một phiên bản prompt'}? Yêu cầu và các lần retry có thể phát sinh phí. Không tự áp dụng ID.`,
      )
    )
      return;
    const prompts: ClassificationPromptVersion[] = [
      versions.find((v) => v.id === library.activeId)!,
    ];
    if (compare) prompts.push(versions.find((v) => v.id === compareId)!);
    controller.current = new AbortController();
    setBusy(true);
    setError('');
    setDiagnostic('');
    setResults([]);
    try {
      for (const prompt of prompts) {
        const response = await classifyQuestionOnline(
          data,
          question,
          controller.current.signal,
          '',
          { prompt },
        );
        setResults((old) => [...old, { name: prompt.name, response }]);
      }
    } catch (e) {
      setError(
        controller.current.signal.aborted
          ? 'Đã dừng phép thử; các kết quả đã nhận vẫn được giữ.'
          : errorText(e),
      );
      if (e instanceof AiRequestError) setDiagnostic(e.diagnostic);
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  return (
    <section className="panel classification-prompts">
      <h2>Prompt phân loại ngân hàng</h2>
      <p>
        Engine {CLASSIFICATION_PROMPT_VERSION}. System instruction, kiểm định ID và JSON schema luôn
        được giữ cố định. Hướng dẫn bổ sung không thay thế các quy tắc này.
      </p>
      <label className="field">
        Phiên bản đang dùng
        <select
          aria-label="Phiên bản prompt phân loại"
          value={library.activeId}
          disabled={busy}
          onChange={(e) => void select(e.target.value)}
        >
          {versions.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name} · {v.id}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Xem hướng dẫn phiên bản hiện tại</summary>
        <p style={{ whiteSpace: 'pre-wrap' }}>
          {versions.find((v) => v.id === library.activeId)?.instruction}
        </p>
      </details>
      <label className="field">
        Tên phiên bản mới
        <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        Hướng dẫn bổ sung
        <textarea
          aria-label="Hướng dẫn prompt phân loại"
          value={instruction}
          maxLength={5000}
          rows={6}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </label>
      <button
        className="button primary"
        disabled={busy || !name.trim() || !instruction.trim()}
        onClick={() => void save()}
      >
        Lưu phiên bản mới
      </button>{' '}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void select(defaultClassificationPrompt.id)}
      >
        Khôi phục prompt mặc định
      </button>
      <h3>Model dự phòng</h3>
      <p>
        Chỉ chuyển sau lỗi dịch vụ tạm thời, trên cùng key, tới model đã thử JSON thành công với key
        đang chọn trong 30 ngày. Không chuyển model/key để né quota.
      </p>
      <select
        aria-label="Model phân loại dự phòng"
        value={fallbacks[0] ?? ''}
        disabled={busy}
        onChange={(e) =>
          void saveModuleSetting(
            'classificationFallbacks',
            JSON.stringify(e.target.value ? [e.target.value] : []),
          ).catch((e) => setError(errorText(e)))
        }
      >
        <option value="">Không dùng model dự phòng</option>
        {verified.map((c) => (
          <option key={c.model} value={c.model}>
            {c.model}
          </option>
        ))}
      </select>
      <h3>Ước tính chi phí</h3>
      <p>
        Đơn giá USD / một triệu token, do anh nhập theo bảng giá model. Chỉ tính token provider báo
        cáo; không phải hóa đơn và không gồm lượt lỗi không có usage.
      </p>
      <label className="field">
        Giá token đầu vào
        <input
          aria-label="Giá token đầu vào"
          type="number"
          min="0"
          step="any"
          value={inputPrice}
          onChange={(e) => setInputPrice(e.target.value)}
        />
      </label>
      <label className="field">
        Giá token đầu ra
        <input
          aria-label="Giá token đầu ra"
          type="number"
          min="0"
          step="any"
          value={outputPrice}
          onChange={(e) => setOutputPrice(e.target.value)}
        />
      </label>
      <button
        className="button secondary"
        disabled={!currentModel || !inputPrice.trim() || !outputPrice.trim()}
        onClick={() =>
          void (async () => {
            try {
              const prices = pricesSchema.parse({
                ...JSON.parse(settings.moduleState?.classificationPrices || '{}'),
                [currentModel]: {
                  inputPerMillion: Number(inputPrice),
                  outputPerMillion: Number(outputPrice),
                },
              });
              await saveModuleSetting('classificationPrices', JSON.stringify(prices));
              setError('');
            } catch (e) {
              setError(errorText(e));
            }
          })()
        }
      >
        Lưu đơn giá cho {currentModel || 'model đang chọn'}
      </button>
      <h3>Thử và so sánh trên một câu</h3>
      <p>
        Không ghi đề xuất vào ngân hàng và không đổi mã câu. JSON hợp lệ không chứng minh phân loại
        đúng; cần tập nhãn chuẩn do giáo viên xác nhận.
      </p>
      <label className="field">
        Câu thử
        <select
          aria-label="Câu thử prompt"
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
          disabled={busy}
        >
          <option value="">Chọn câu trong ngân hàng</option>
          {data.questions
            .filter((q) => !q.deletedAt)
            .slice(0, 1000)
            .map((q) => (
              <option key={q.id} value={q.id}>
                {q.displayId || q.rawSource.slice(0, 80)}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        Phiên bản để so sánh
        <select
          aria-label="Prompt đối chiếu"
          value={compareId}
          disabled={busy}
          onChange={(e) => setCompareId(e.target.value)}
        >
          {versions.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button secondary"
        disabled={busy || !questionId}
        onClick={() => void test(false)}
      >
        Thử một câu
      </button>{' '}
      <button
        className="button secondary"
        disabled={busy || !questionId || compareId === library.activeId}
        onClick={() => void test(true)}
      >
        So sánh hai phiên bản
      </button>{' '}
      {busy && (
        <button className="button secondary" onClick={() => controller.current?.abort()}>
          Dừng phép thử
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {diagnostic && (
        <details>
          <summary>Diagnostics</summary>
          <pre>{diagnostic}</pre>
        </details>
      )}
      <div className="qb-ai-review-grid">
        {results.map(({ name, response }, index) => (
          <section key={index}>
            <h4>{name}</h4>
            <p>
              {response.result.proposedClassificationCode || 'Chưa đủ mã'} ·{' '}
              {Math.round(response.result.confidence * 100)}% AI tự đánh giá
            </p>
            <p>{response.result.reasoningSummary}</p>
            <p>
              Token: {response.usage?.totalTokenCount ?? 'provider không báo cáo'} · Chi phí: chưa
              có đơn giá để tính.
            </p>
            <details>
              <summary>Kết quả JSON và ngữ cảnh truy xuất</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(response, null, 2)}</pre>
            </details>
          </section>
        ))}
      </div>
    </section>
  );
}
