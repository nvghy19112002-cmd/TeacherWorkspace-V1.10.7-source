import { useCallback, useEffect, useRef, useState } from 'react';
export function useVirtualRows<T extends { id: string }>(rows: T[], rowHeight = 96) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 480 });
  const identity = rows.map((r) => r.id).join('|');
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () =>
      setViewport({ top: element.scrollTop, height: element.clientHeight || 480 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    setViewport((old) => ({ ...old, top: 0 }));
  }, [identity]);
  const virtualized = rows.length > 24;
  const start = virtualized ? Math.max(0, Math.floor(viewport.top / rowHeight) - 4) : 0;
  const end = virtualized
    ? Math.min(rows.length, Math.ceil((viewport.top + viewport.height) / rowHeight) + 4)
    : rows.length;
  const scrollToIndex = useCallback(
    (index: number) => {
      const element = containerRef.current;
      if (!element || index < 0) return;
      const top = index * rowHeight,
        bottom = top + rowHeight;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (bottom > element.scrollTop + element.clientHeight)
        element.scrollTop = bottom - element.clientHeight;
      setViewport({ top: element.scrollTop, height: element.clientHeight || 480 });
    },
    [rowHeight],
  );
  return {
    containerRef,
    start,
    virtualized,
    rows: rows.slice(start, end),
    paddingTop: start * rowHeight,
    paddingBottom: Math.max(0, (rows.length - end) * rowHeight),
    scrollToIndex,
    onScroll: () => {
      const element = containerRef.current;
      if (element) setViewport({ top: element.scrollTop, height: element.clientHeight || 480 });
    },
  };
}
