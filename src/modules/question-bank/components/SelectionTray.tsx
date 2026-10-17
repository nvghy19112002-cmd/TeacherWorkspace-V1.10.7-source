import { useState } from 'react';
import { ArrowDown, ArrowUp, Code2, FileOutput, Layers3, Play, X } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import { QUESTION_TYPE_LABELS, type Question } from '../domain/model';
import { questionExcerpt } from '../domain/library';

export function SelectionTray({
  questions,
  busy,
  onClose,
  onMove,
  onRemove,
  onCopy,
  onCompile,
  onExport,
}: {
  questions: Question[];
  busy: boolean;
  onClose: () => void;
  onMove: (id: string, offset: number) => void;
  onRemove: (id: string) => void;
  onCopy: () => void;
  onCompile: () => void;
  onExport: (title: string, duration: number) => Promise<void>;
}) {
  const [title, setTitle] = useState('Phiếu bài tập');
  const [duration, setDuration] = useState('45');
  const [exporting, setExporting] = useState(false);
  const valid =
    title.trim().length > 0 &&
    title.trim().length <= 200 &&
    Number.isInteger(Number(duration)) &&
    Number(duration) > 0 &&
    Number(duration) <= 1440;
  return (
    <Modal
      title="Khay câu hỏi"
      subtitle="Sắp xếp một lần. Sao chép, biên dịch và xuất đề theo cùng thứ tự."
      onClose={() => !exporting && onClose()}
      wide
      className="qb-tray-dialog"
    >
      <div className="modal-body qb-tray-body">
        <div className="qb-tray-summary">
          <Layers3 size={22} />
          <div>
            <strong>{questions.length} câu đã chọn</strong>
            <span>Thứ tự trong khay là thứ tự trong đề.</span>
          </div>
        </div>
        <div className="qb-tray-list">
          {questions.map((question, index) => (
            <article key={question.id}>
              <b className="qb-tray-number">{index + 1}</b>
              <div>
                <strong>{question.displayId || question.classificationCode || 'Chưa có ID'}</strong>
                <span>{QUESTION_TYPE_LABELS[question.questionType]}</span>
                <p>{questionExcerpt(question.rawSource)}</p>
              </div>
              <div className="qb-tray-row-actions">
                <button
                  className="icon-button"
                  aria-label={`Đưa câu ${index + 1} lên`}
                  disabled={exporting || index === 0}
                  onClick={() => onMove(question.id, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Đưa câu ${index + 1} xuống`}
                  disabled={exporting || index === questions.length - 1}
                  onClick={() => onMove(question.id, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Bỏ câu ${index + 1} khỏi khay`}
                  disabled={exporting}
                  onClick={() => onRemove(question.id)}
                >
                  <X size={16} />
                </button>
              </div>
            </article>
          ))}
          {!questions.length && (
            <div className="qb-empty-table">
              <Layers3 size={28} />
              <strong>Khay đang trống</strong>
              <p>Tích chọn câu trong thư viện để đưa vào đây.</p>
            </div>
          )}
        </div>
        <div className="qb-tray-form">
          <label className="field">
            Tên đề / phiếu
            <input
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            Thời gian (phút)
            <input
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </label>
        </div>
        <p className="muted">
          Tạo đề lưu một bản chụp nội dung, khóa ID câu đã dùng và xuất mã câu ex_test. Dùng với bộ
          khai báo LaTeX của anh.
        </p>
      </div>
      <div className="modal-footer">
        <button
          className="button secondary"
          disabled={!questions.length || exporting}
          onClick={onCopy}
        >
          <Code2 size={16} /> Chép mã theo thứ tự
        </button>
        <button
          className="button secondary"
          disabled={!questions.length || exporting}
          onClick={onCompile}
        >
          <Play size={16} /> Biên dịch PDF
        </button>
        <button
          className="button primary"
          disabled={!valid || !questions.length || busy || exporting}
          onClick={() => {
            setExporting(true);
            void onExport(title.trim(), Number(duration)).finally(() => setExporting(false));
          }}
        >
          <FileOutput size={16} /> {exporting ? 'Đang xuất…' : 'Tạo đề .tex'}
        </button>
      </div>
    </Modal>
  );
}
