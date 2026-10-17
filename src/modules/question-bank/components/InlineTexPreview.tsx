import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from '../../../database/driver';
import { errorText } from '../../../app/store';
import { diagnoseTexLog, prepareTexPreview, type TexPreviewSettings } from '../domain/texPreview';

interface Result { success: boolean; pdf: number[]; log: string }

/** Compile only the selected complex question; dispose stale PDFs on navigation. */
export function InlineTexPreview({ source, onOpenCompiler }: {
  source: string;
  onOpenCompiler: () => void;
}) {
  const [pdf, setPdf] = useState('');
  const [message, setMessage] = useState('Đang biên dịch bằng TeX Live…');
  const [log, setLog] = useState('');
  useEffect(() => {
    if (!isDesktop) {
      setMessage('Xem trước bố cục, hình TikZ và ảnh cần TeX Live trong ứng dụng Windows.');
      return;
    }
    let disposed = false;
    let url = '';
    let compiling = false;
    setPdf('');
    setLog('');
    setMessage('Đang biên dịch bằng TeX Live…');
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const settings = await invoke<TexPreviewSettings>('tex_preview_settings');
          const setup = await invoke<string>('tex_preview_read_setup', { settings });
          if (disposed) return;
          const prepared = prepareTexPreview(source, setup, {
            integrated: settings.mode !== 'project',
            additionalPreamble: settings.additionalPreamble,
          });
          compiling = true;
          const result = await invoke<Result>('tex_preview_compile', {
            settings,
            document: prepared.document,
            question: prepared.question,
          });
          compiling = false;
          if (disposed) return;
          if (!result.success) {
            setLog(result.log);
            setMessage(diagnoseTexLog(result.log)[0]?.message ?? 'Câu này chưa biên dịch được. Mở Biên dịch để xem lỗi và bổ sung khai báo.');
            return;
          }
          url = URL.createObjectURL(new Blob([new Uint8Array(result.pdf)], { type: 'application/pdf' }));
          setPdf(url);
          setMessage('Đã biên dịch bằng TeX Live · PDF hiển thị đúng TikZ và bố cục LaTeX.');
        } catch (error) {
          if (!disposed) setMessage(errorText(error));
        }
      })();
    }, 300);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      if (compiling) void invoke('tex_preview_cancel').catch(() => undefined);
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  return (
    <div className="qb-inline-tex">
      <div className="qb-inline-tex-toolbar">
        <span role="status">{message}</span>
        <button className="button small secondary" onClick={onOpenCompiler}>
          {pdf ? 'Mở PDF / Lưu' : 'Biên dịch chi tiết'}
        </button>
      </div>
      {pdf ? (
        <iframe title="Bản xem trước LaTeX và TikZ" src={pdf} className="qb-inline-tex-pdf" />
      ) : (
        <p className="muted">Mã LaTeX gốc được giữ nguyên. Nếu câu cần khai báo riêng, mở Biên dịch chi tiết để xem nhật ký và bổ sung.</p>
      )}
      {log && <details><summary>Xem nhật ký lỗi</summary><pre className="qb-tex-log">{log}</pre></details>}
    </div>
  );
}
