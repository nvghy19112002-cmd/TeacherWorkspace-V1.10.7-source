import { useState } from 'react';
import { useToasts } from '../../../components/feedback';
import { errorText } from '../../../app/store';
import { useUi } from '../../../app/ui';
import { projectFromExam } from '../../documents/fromExam';
import { saveProject } from '../../documents/storage';
import { FileOutput, FileText, Play } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import type { BankSnapshot, Exam } from '../domain/model';

export function SavedExams({
  data,
  onClose,
  onExport,
  onCompile,
}: {
  data: BankSnapshot;
  onClose: () => void;
  onExport: (exam: Exam) => void;
  onCompile: (exam: Exam) => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToasts((s) => s.push);
  async function sendToVault(exam: Exam) {
    setBusy(true);
    try {
      await saveProject(projectFromExam(data, exam));
      toast('Đã tạo bản sao trong Kho đề.');
      onClose();
      useUi.getState().navigate('documents');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  const exams = data.exams
    .filter((exam) => exam.status !== 'archived')
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Modal
      title="Đề đã lưu"
      subtitle="Mỗi đề giữ bản chụp câu hỏi tại thời điểm tạo, kể cả khi câu trong kho được sửa sau đó."
      onClose={onClose}
      wide
    >
      <div className="modal-body qb-saved-exams">
        {exams.map((exam) => (
          <article key={exam.id}>
            <div className="qb-saved-exam-icon">
              <FileText size={20} />
            </div>
            <div>
              <strong>{exam.title}</strong>
              <p>
                {data.examItems.filter((item) => item.examId === exam.id).length} câu ·{' '}
                {exam.durationMinutes} phút · {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <button
              className="button secondary small"
              disabled={busy}
              onClick={() => void sendToVault(exam)}
            >
              Mở trong Kho đề
            </button>
            <button className="button secondary small" onClick={() => onCompile(exam)}>
              <Play size={14} /> PDF
            </button>
            <button className="button secondary small" onClick={() => onExport(exam)}>
              <FileOutput size={14} /> Xuất .tex
            </button>
          </article>
        ))}
        {!exams.length && (
          <div className="qb-empty-table">
            <FileText size={30} />
            <h3>Chưa có đề được lưu</h3>
            <p>Chọn câu vào khay, sắp xếp rồi bấm Tạo đề .tex.</p>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Đóng
        </button>
      </div>
    </Modal>
  );
}
