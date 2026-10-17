import { useState } from 'react';
import pkg from '../../../package.json';
import { useWorkspace, errorText } from '../../app/store';
import { useQuestionBank } from '../question-bank/store';
import { restoreScanJob } from '../question-bank/domain/scanQueue';
import { isDesktop } from '../../database/driver';
import { saveFile } from '../../services/files';
export function DiagnosticsSettings() {
  const workspaceError = useWorkspace((s) => s.error),
    bankError = useQuestionBank((s) => s.error);
  const rawJob = useWorkspace((s) => s.data.settings.moduleState?.classificationJob);
  const bank = useQuestionBank((s) => s.data);
  const job = restoreScanJob(rawJob);
  const [message, setMessage] = useState('');
  const report = {
    version: pkg.version,
    runtime: isDesktop ? 'Tauri desktop' : 'Browser SQLite WASM',
    workspaceError,
    bankError,
    counts: {
      questions: bank.questions.length,
      assets: bank.assets.length,
      unresolvedAssets: bank.assets.filter((a) => a.missing).length,
      runs: bank.classificationRuns.length,
      imports: bank.importJobs.length,
    },
    job,
  };
  return (
    <section className="panel">
      <h2>Chẩn đoán</h2>
      <p>
        {report.runtime} · v{pkg.version}
      </p>
      <p>
        Ngân hàng hiện nạp: {report.counts.questions} câu, {report.counts.runs} lượt phân loại. Tài
        nguyên chưa xác minh: {report.counts.unresolvedAssets}.
      </p>
      {workspaceError && <p role="alert">{workspaceError}</p>}
      {bankError && <p role="alert">{bankError}</p>}
      {rawJob && !job && (
        <p role="alert">
          Không đọc được checkpoint AI. Nội dung gốc được giữ lại; hãy xuất báo cáo và kiểm tra
          trước khi tạo lô mới.
        </p>
      )}
      {job ? (
        <>
          <p>
            Checkpoint gần nhất: {new Date(job.updatedAt).toLocaleString('vi-VN')} ·{' '}
            {job.rows.length} câu.
          </p>
          <details>
            <summary>Trạng thái đã lưu và HTTP diagnostics</summary>
            <ul>
              {job.rows.map((r) => (
                <li key={r.id}>
                  {r.id} · {r.status}
                  {r.diagnostic && <pre>{r.diagnostic}</pre>}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p>Chưa có checkpoint AI hợp lệ.</p>
      )}
      <p>
        Báo cáo chỉ lấy trạng thái cần thiết, không xuất API key, khóa ký hoặc toàn bộ settings.
      </p>
      <button
        className="button secondary"
        onClick={() =>
          void saveFile(
            `TeacherWorkspace-diagnostics-${Date.now()}.json`,
            new TextEncoder().encode(
              JSON.stringify({ ...report, generatedAt: new Date().toISOString() }, null, 2),
            ),
            'application/json',
          )
            .then((saved) => {
              if (saved) setMessage('Đã xuất báo cáo chẩn đoán.');
            })
            .catch((e) => setMessage(errorText(e)))
        }
      >
        Xuất chẩn đoán
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
