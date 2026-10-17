import { useEffect, useState } from 'react';
import { useUi } from '../../app/ui';
import { useQuestionBank } from './store';
import { AiIdScan } from './components/AiIdScan';
export default function ClassificationWorkspace() {
  const data = useQuestionBank((s) => s.data),
    ready = useQuestionBank((s) => s.ready),
    error = useQuestionBank((s) => s.error);
  const checked = useQuestionBank((s) => s.checkedIds);
  const [mode, setMode] = useState('selected');
  useEffect(() => {
    void useQuestionBank.getState().initialize();
  }, []);
  if (!ready)
    return <div className="page-loading">{error || 'Đang mở ngân hàng và tiến trình AI…'}</div>;
  const selected = new Set(checked);
  const questions = data.questions.filter(
    (q) =>
      !q.deletedAt &&
      (mode === 'selected'
        ? selected.has(q.id)
        : mode === 'review'
          ? q.status !== 'approved' && !q.idLocked
          : true),
  );
  return (
    <div className="classification-page">
      <header className="classification-page-heading">
        <div>
          <div className="eyebrow">ACADEMIC DESKTOP STUDIO</div>
          <h1>AI phân loại câu hỏi</h1>
          <p>AI đề xuất → giáo viên đối chiếu → duyệt ID. Không tự áp dụng kết quả.</p>
        </div>
        <label className="field">
          Câu cần quét
          <select
            aria-label="Danh sách câu quét AI"
            value={mode}
            onChange={(e) => {
              if (useUi.getState().navigationGuard?.() !== false) setMode(e.target.value);
            }}
          >
            <option value="selected">Đang chọn trong ngân hàng ({checked.length})</option>
            <option value="review">Câu chưa duyệt, chưa khóa</option>
            <option value="all">Toàn bộ câu chưa xóa</option>
          </select>
        </label>
      </header>
      {!questions.length && (
        <p className="panel">Chọn câu trong ngân hàng hoặc đổi danh sách câu cần quét ở trên.</p>
      )}
      {questions.length > 1000 && (
        <p role="alert">
          Lựa chọn có {questions.length} câu. Mỗi lô tối đa 1.000 câu; hãy chọn một nhóm nhỏ hơn
          trong ngân hàng.
        </p>
      )}
      <AiIdScan
        key={mode}
        questions={questions}
        embedded
        onClose={() => useUi.getState().navigate('question-bank')}
      />
    </div>
  );
}
