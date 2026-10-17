import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from '../../../database/driver';
import { errorText } from '../../../app/store';
import { prepareTikzPreview } from '../domain/tikzPreview';
import { diagnoseTexLog, type TexPreviewSettings } from '../domain/texPreview';
import type { FigureImage } from '../services/pdfFigure';
import { queuedTexCompile } from '../services/texCompileQueue';

export function TikzPreview({ source }: { source: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<{
    source: string;
    revision: number;
    image: FigureImage | null;
    message: string;
  } | null>(null);
  const current = preview?.source === source && preview.revision === revision ? preview : null;
  const image = current?.image;
  const message =
    current?.message ??
    (isDesktop
      ? 'Đang dựng hình TikZ…'
      : 'Hình TikZ hiển thị tự động trong app Windows có TeX Live.');
  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener('teacher-preview-cache-cleared', reload);
    return () => window.removeEventListener('teacher-preview-cache-cleared', reload);
  }, []);
  useEffect(() => {
    if (!isDesktop) return;
    const abort = new AbortController();
    let timer = 0,
      started = false;
    const load = () => {
      if (started) return;
      started = true;
      timer = window.setTimeout(() => {
        void (async () => {
          try {
            const settings = await invoke<TexPreviewSettings>('tex_preview_settings');
            const setup = await invoke<string>('tex_preview_read_setup', { settings });
            abort.signal.throwIfAborted();
            const prepared = prepareTikzPreview(source, setup, settings);
            const key = JSON.stringify([source, setup, settings]);
            const result = await queuedTexCompile(
              { settings, document: prepared.document, question: prepared.question },
              abort.signal,
              key,
            );
            abort.signal.throwIfAborted();
            if (!result.success)
              throw new Error(
                diagnoseTexLog(result.log)[0]?.message ??
                  'Chưa dựng được hình. Mở Biên dịch PDF để xem lỗi.',
              );
            const { pdfFigure } = await import('../services/pdfFigure');
            const rendered = await pdfFigure(result.pdf, abort.signal, key);
            abort.signal.throwIfAborted();
            setPreview({
              source,
              revision,
              image: rendered,
              message: 'Hình TikZ · kết quả biên dịch nguồn hiện tại',
            });
          } catch (error) {
            if (!abort.signal.aborted)
              setPreview({ source, revision, image: null, message: errorText(error) });
          }
        })();
      }, 250);
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) load();
            },
            { rootMargin: '100px' },
          );
    if (observer && host.current) observer.observe(host.current);
    else load();
    return () => {
      abort.abort();
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [source, revision]);
  return (
    <span className="qb-tikz-inline" ref={host}>
      {image ? (
        <img
          alt="Hình TikZ của câu hỏi"
          src={image.url}
          width={Math.round(image.width)}
          height={Math.round(image.height)}
          style={{ width: `${image.width}px`, maxWidth: '100%', height: 'auto' }}
        />
      ) : (
        <span className="qb-tikz-pending">{message}</span>
      )}
    </span>
  );
}
