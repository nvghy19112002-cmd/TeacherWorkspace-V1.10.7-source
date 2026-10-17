import { useEffect, useState } from 'react';
import { texCacheStats, clearTexCompileCache } from '../question-bank/services/texCompileQueue';
import { errorText } from '../../app/store';
export function PerformanceSettings() {
  const [stats, setStats] = useState({
    tex: { entries: 0, bytes: 0 },
    figure: { entries: 0, bytes: 0 },
  });
  const [message, setMessage] = useState('');
  async function refresh(clear = false) {
    try {
      const renderer = await import('../question-bank/services/pdfFigure');
      if (clear) {
        clearTexCompileCache();
        renderer.clearFigureCache();
        window.dispatchEvent(new Event('teacher-preview-cache-cleared'));
        setMessage(
          'Đã xóa bộ đệm preview trong phiên. Dữ liệu câu hỏi và file dự án được giữ nguyên.',
        );
      }
      setStats({ tex: texCacheStats(), figure: renderer.figureCacheStats() });
    } catch (error) {
      setMessage(errorText(error));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <section className="panel">
      <h2>Hiệu năng và bộ đệm</h2>
      <p>
        PDF TeX (dung lượng ước lượng): {stats.tex.entries} mục ·{' '}
        {(stats.tex.bytes / 1048576).toFixed(2)} MB.
      </p>
      <p>
        Ảnh preview (dữ liệu mã hóa): {stats.figure.entries} mục ·{' '}
        {(stats.figure.bytes / 1048576).toFixed(2)} MB.
      </p>
      <p>
        Cache được giới hạn theo bộ nhớ và chỉ tồn tại trong phiên. Câu có file ngoài hoặc chế độ dự
        án được biên dịch lại để tránh tái sử dụng tài nguyên đã thay đổi.
      </p>
      <button className="button secondary" onClick={() => void refresh()}>
        Đọc lại thống kê cache
      </button>{' '}
      <button className="button secondary" onClick={() => void refresh(true)}>
        Xóa cache preview
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
