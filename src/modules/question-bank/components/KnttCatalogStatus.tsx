import { useMemo } from 'react';
import { classificationContext } from '../domain/classificationContext';
import { gradeNumber } from '../domain/curriculumPresentation';
import type { BankSnapshot } from '../domain/model';

export function KnttCatalogStatus({ data }: { data: BankSnapshot }) {
  const context = useMemo(() => classificationContext(data), [data]);
  return (
    <div className="qb-kntt-catalog" aria-label="Danh mục KNTT dùng cho AI">
      <strong>Danh mục KNTT dùng cho AI</strong>
      <p>
        AI đối chiếu đúng cây lớp → nhánh → chương → bài → dạng đang hiển thị. Số bài giữ xuyên suốt
        từng lớp theo danh mục KNTT đã cung cấp.
      </p>
      <div className="qb-kntt-grades">
        {context.nodes
          .filter((n) => n.kind === 'grade')
          .sort((a, b) => Number(a.code) - Number(b.code))
          .map((g) => {
            const scoped = classificationContext(data, g.id);
            return (
              <div key={g.id}>
                <strong>Lớp {gradeNumber(g.code)}</strong>
                <span>
                  {scoped.nodes.filter((n) => n.kind === 'chapter').length} chương ·{' '}
                  {scoped.nodes.filter((n) => n.kind === 'lesson').length} bài
                </span>
                <small>
                  {scoped.forms.length} dạng · {scoped.missingLessons.length} bài chưa có dạng
                </small>
              </div>
            );
          })}
      </div>
      <p>
        Dạng bài là danh mục giáo viên thiết lập, không phải mục lục SGK. Khi bài phù hợp chưa có
        dạng, AI phải báo thiếu; không chọn sang bài khác để đủ ID. Các cây cũ chỉ dùng để tra cứu.
      </p>
    </div>
  );
}
