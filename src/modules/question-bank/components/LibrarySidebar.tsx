import {
  BookOpen,
  CheckCheck,
  CircleAlert,
  Clock3,
  ImageIcon,
  Layers3,
  LibraryBig,
  ListFilter,
  Trash2,
} from 'lucide-react';
import {
  LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  type Question,
  type CurriculumNode,
} from '../domain/model';

export type LibraryScope = 'all' | 'recent' | 'review' | 'approved' | 'images';

export function LibrarySidebar({
  questions,
  scope,
  activeNodeId,
  trashCount,
  onScope,
  onCatalog,
  onCurriculum,
  onTrash,
  onFilters,
  level,
  type,
  imageFilter,
  onLevel,
  onType,
  onImage,
  onReset,
  hasFilters,
  taxonomy,
  onTaxonomy,
  sourceFilter,
  sources,
  onSource,
}: {
  questions: Question[];
  scope: LibraryScope;
  activeNodeId: string;
  trashCount: number;
  onScope: (scope: LibraryScope) => void;
  onCatalog: () => void;
  onCurriculum: () => void;
  onTrash: () => void;
  onFilters: () => void;
  level: string;
  type: string;
  imageFilter: string;
  hasFilters: boolean;
  onLevel: (v: string) => void;
  onType: (v: string) => void;
  onImage: (v: string) => void;
  onReset: () => void;
  taxonomy: Array<{
    key: string;
    label: string;
    value: string;
    rows: CurriculumNode[];
    disabled: boolean;
  }>;
  onTaxonomy: (key: string, value: string) => void;
  sourceFilter: string;
  sources: string[];
  onSource: (value: string) => void;
}) {
  const items = [
    { id: 'all' as const, label: 'Tất cả câu hỏi', icon: LibraryBig, count: questions.length },
    { id: 'recent' as const, label: 'Mới cập nhật', icon: Clock3, count: null },
    {
      id: 'review' as const,
      label: 'Cần hoàn thiện',
      icon: CircleAlert,
      count: questions.filter(
        (q) =>
          q.status === 'draft' ||
          q.status === 'review' ||
          q.status === 'needs_fix' ||
          !q.classificationCode ||
          q.warnings.length,
      ).length,
    },
    {
      id: 'approved' as const,
      label: 'Đã duyệt',
      icon: CheckCheck,
      count: questions.filter((q) => q.status === 'approved').length,
    },
    {
      id: 'images' as const,
      label: 'Có hình vẽ',
      icon: ImageIcon,
      count: questions.filter((q) => q.hasImage).length,
    },
  ];
  return (
    <aside className="qb-library-sidebar" aria-label="Thư viện câu hỏi">
      <div className="qb-sidebar-heading">
        <span>THƯ VIỆN CỦA TÔI</span>
        <Layers3 size={15} />
      </div>
      <label className="qb-scope-select">
        Nhóm câu hỏi
        <select
          aria-label="Nhóm câu hỏi"
          value={scope}
          onChange={(e) => onScope(e.target.value as LibraryScope)}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {item.count === null ? '' : ` (${item.count.toLocaleString('vi')})`}
            </option>
          ))}
        </select>
      </label>
      <div className="qb-sidebar-heading">
        <span>MỤC LỤC KNTT · TOÁN</span>
        <button aria-label="Quản lý cây mục lục" title="Quản lý cây mục lục" onClick={onCurriculum}>
          <BookOpen size={15} />
        </button>
      </div>
      <button className={`qb-catalog-trigger ${activeNodeId ? 'active' : ''}`} onClick={onCatalog}>
        <BookOpen size={17} />
        <span>
          Lọc theo mục lục<small>{activeNodeId ? 'Đang lọc theo KNTT' : 'Lớp 10 · 11 · 12'}</small>
        </span>
      </button>
      <div className="qb-inline-filters" aria-label="Bộ lọc nhanh">
        {taxonomy.map((field) => (
          <label key={field.key}>
            {field.label}
            <select
              aria-label={`Lọc nhanh ${field.label.toLowerCase()}`}
              title={field.rows.find((n) => n.id === field.value)?.name}
              disabled={field.disabled}
              value={field.value}
              onChange={(e) => onTaxonomy(field.key, e.target.value)}
            >
              <option value="">Tất cả {field.label.toLowerCase()}</option>
              {field.rows.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Mức độ
          <select
            aria-label="Lọc nhanh mức độ"
            value={level}
            onChange={(e) => onLevel(e.target.value)}
          >
            <option value="">Tất cả mức độ</option>
            {Object.entries(LEVEL_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Loại câu
          <select
            aria-label="Lọc nhanh loại câu"
            value={type}
            onChange={(e) => onType(e.target.value)}
          >
            <option value="">Tất cả loại câu</option>
            {Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hình vẽ
          <select
            aria-label="Lọc nhanh hình vẽ"
            value={imageFilter}
            onChange={(e) => onImage(e.target.value)}
          >
            <option value="">Có / Không có hình</option>
            <option value="with">Có hình vẽ</option>
            <option value="without">Không có hình vẽ</option>
          </select>
        </label>
        <label>
          Nguồn nhập
          <select
            aria-label="Lọc nhanh nguồn nhập"
            value={sourceFilter}
            onChange={(e) => onSource(e.target.value)}
          >
            <option value="">Tất cả nguồn</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button className="qb-reset-filters" onClick={onReset}>
            Xóa tất cả bộ lọc
          </button>
        )}
      </div>
      <div className="qb-sidebar-bottom">
        <button onClick={onFilters}>
          <ListFilter size={16} /> Bộ lọc chi tiết
        </button>
        <button onClick={onTrash}>
          <Trash2 size={16} /> Thùng rác ({trashCount})
        </button>
        <div>
          <span className="qb-local-dot" /> Ngân hàng riêng trên thiết bị
        </div>
      </div>
    </aside>
  );
}
