import { CurriculumFilter } from './components/CurriculumFilter';
import { LibrarySidebar, type LibraryScope } from './components/LibrarySidebar';
import { SelectionTray } from './components/SelectionTray';
import { SavedExams } from './components/SavedExams';
import { moveSelection, orderedQuestions, questionExcerpt, searchText } from './domain/library';
import { AiIdScan } from './components/AiIdScan';
import { TexLivePreview } from './components/TexLivePreview';
import { uniqueImports } from './domain/importReview';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Layers3,
  SlidersHorizontal,
  ClipboardPaste,
  PanelLeft,
  PanelLeftClose,
  Maximize2,
  Minimize2,
  CheckCheck,
  CircleAlert,
  ArrowUpRight,
  History,
  ChevronLeft,
  ChevronRight,
  Code2,
  BookOpen,
  Copy,
  CopyCheck,
  Eye,
  FilePlus2,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { errorText, useWorkspace } from '../../app/store';
import { readStudioLayout, saveStudioLayout } from '../../app/studioLayout';
import { useVirtualRows } from '../../components/useVirtualRows';
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { getDriver, isDesktop } from '../../database/driver';
import type { BankSearchResult } from './database/search';
import { Modal } from '../../components/Modal';
import { useToasts } from '../../components/feedback';
import { saveFile } from '../../services/files';
import { QuestionEditor } from './components/QuestionEditor';
import { CurriculumManager } from './components/CurriculumManager';
import { QuestionPreview } from './components/QuestionPreview';
import { id6NodePath } from './domain/mathhubCurriculum';
import { activeKnttNodes } from './domain/classificationContext';
import { questionGrade, gradeNumber } from './domain/curriculumPresentation';
import { curriculumPath } from './domain/curriculum';
import { exactQuestionSource } from './domain/normalize';
import { findDuplicateCandidates, type DuplicateCandidate } from './domain/duplicates';
import { createExam, examToLatex } from './domain/exams';
import {
  LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  STATUS_LABELS,
  questionSchema,
  type CurriculumNode,
  type Exam,
  type BankSnapshot,
  type Question,
} from './domain/model';
import { parsedToQuestion, parseExTest } from './domain/parser';
import { flagSourceIdConflicts } from './domain/sourceIdConflicts';
import {
  DEFAULT_TEX_PREVIEW_SETTINGS,
  findUnsupportedLatex,
  type TexPreviewSettings,
  type TexSupportIssue,
  type BatchPreviewItem,
} from './domain/texPreview';
import { useQuestionBank } from './store';
import './questionBank.css';
import './studio.css';

const PAGE_SIZE = 50;

function downloadText(name: string, text: string, mime = 'application/x-tex') {
  return saveFile(name, new TextEncoder().encode(text), mime);
}

function exactDuplicateCandidates(questions: Question[]): DuplicateCandidate[] {
  const groups = new Map<string, Question[]>();
  const output: DuplicateCandidate[] = [];
  for (const question of questions) {
    const group = groups.get(question.contentHash) ?? [];
    for (const previous of group)
      if (exactQuestionSource(previous.rawSource) === exactQuestionSource(question.rawSource))
        output.push({ left: previous, right: question, score: 100, method: 'hash' });
    group.push(question);
    groups.set(question.contentHash, group);
  }
  return output;
}

export default function QuestionBankPage() {
  const data = useQuestionBank((state) => state.data);
  const revision = useQuestionBank((state) => state.revision);
  const loadError = useQuestionBank((state) => state.error);
  const ready = useQuestionBank((state) => state.ready);
  const busy = useQuestionBank((state) => state.busy);
  const selectedId = useQuestionBank((state) => state.selectedId);
  const initialize = useQuestionBank((state) => state.initialize);
  const commit = useQuestionBank((state) => state.commit);
  const select = useQuestionBank((state) => state.select);
  const toast = useToasts((state) => state.push);

  const [aiQuestions, setAiQuestions] = useState<Question[] | null>(null);
  const [texSource, setTexSource] = useState<string | null>(null);
  const [texBatch, setTexBatch] = useState<BatchPreviewItem[] | null>(null);
  const [pendingImport, setPendingImport] = useState<Question[] | null>(null);
  const [importIssues, setImportIssues] = useState<TexSupportIssue[]>([]);
  const [importDeclarationStep, setImportDeclarationStep] = useState(false);
  const [importDeclarationDraft, setImportDeclarationDraft] = useState('');
  const [importTexSettings, setImportTexSettings] = useState<TexPreviewSettings | null>(null);
  const [skipIdentical, setSkipIdentical] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashPage, setTrashPage] = useState(1);
  const [readingFiles, setReadingFiles] = useState(false);
  const [idQuery, setIdQuery] = useState('');
  const [contentQuery, setContentQuery] = useState('');
  const deferredIdQuery = useDeferredValue(idQuery);
  const deferredContentQuery = useDeferredValue(contentQuery);
  const [level, setLevel] = useState('');
  const [type, setType] = useState('');
  const [imageFilter, setImageFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [domainId, setDomainId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [formId, setFormId] = useState('');
  const [editor, setEditor] = useState<Question | 'new' | null>(null);
  const checked = useQuestionBank((s) => s.checkedIds);
  const setChecked = useQuestionBank((s) => s.setChecked);
  const [page, setPage] = useState(1);
  const [detailTab, setDetailTab] = useState<'preview' | 'source' | 'history'>('preview');
  const [scope, setScope] = useState<LibraryScope>('all');
  const [sort, setSort] = useState('updated');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusDetail, setFocusDetail] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [savedExamsOpen, setSavedExamsOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteSource, setPasteSource] = useState('');
  const activeQuestions = useMemo(
    () => data.questions.filter((q) => !q.deletedAt),
    [data.questions],
  );
  const trayQuestions = useMemo(
    () => orderedQuestions(checked, data.questions),
    [checked, data.questions],
  );
  const questionsNeedingId = useMemo(
    () => activeQuestions.filter((question) => !question.displayId && !question.idLocked),
    [activeQuestions],
  );
  function scanQuestionsNeedingId() {
    if (!questionsNeedingId.length) {
      toast('Không còn câu nào cần gán ID.');
      return;
    }
    const batch = questionsNeedingId.slice(0, 1000);
    if (questionsNeedingId.length > batch.length)
      toast(`Đang xử lý 1.000/${questionsNeedingId.length.toLocaleString('vi-VN')} câu cần ID.`);
    setAiQuestions(batch);
  }
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || document.querySelector('dialog[open]')) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('qb-content-search')?.focus();
      }
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, []);
  const layoutRaw = useWorkspace((s) => s.data.settings.moduleState?.studioLayout);
  const [panelWidths, setPanelWidths] = useState(() => readStudioLayout(layoutRaw));
  const studioRef = useRef<HTMLDivElement>(null);
  function panelKeyboard(kind: 'libraryWidth' | 'readerWidth', event: ReactKeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const minimum = kind === 'libraryWidth' ? 170 : 300,
      maximum = kind === 'libraryWidth' ? 300 : 680;
    const value = Math.min(
      maximum,
      Math.max(minimum, panelWidths[kind] + (event.key === 'ArrowRight' ? 20 : -20)),
    );
    setPanelWidths((old) => ({ ...old, [kind]: value }));
    void saveStudioLayout({ [kind]: value }).catch((e) => toast(errorText(e), 'error'));
  }
  function panelPointer(
    kind: 'libraryWidth' | 'readerWidth',
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget,
      start = event.clientX,
      initial = panelWidths[kind];
    const minimum = kind === 'libraryWidth' ? 170 : 300,
      maximum = kind === 'libraryWidth' ? 300 : 680;
    let final = initial;
    handle.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      final = Math.min(
        maximum,
        Math.max(minimum, initial + (kind === 'libraryWidth' ? 1 : -1) * (e.clientX - start)),
      );
      studioRef.current?.style.setProperty(
        kind === 'libraryWidth' ? '--library-width' : '--reader-width',
        `${final}px`,
      );
      handle.setAttribute('aria-valuenow', String(final));
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      setPanelWidths((old) => ({ ...old, [kind]: final }));
      void saveStudioLayout({ [kind]: final }).catch((e) => toast(errorText(e), 'error'));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
  const [zoom, setZoom] = useState(100);
  const reader = useRef<HTMLDivElement>(null);
  useEffect(() => {
    reader.current?.scrollTo({ top: 0 });
  }, [selectedId]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [catalogFilterOpen, setCatalogFilterOpen] = useState(false);
  function clearCurriculumFilter() {
    setGradeId('');
    setDomainId('');
    setChapterId('');
    setLessonId('');
    setFormId('');
  }

  useEffect(() => {
    if (!useQuestionBank.getState().ready) void initialize();
  }, [initialize]);

  useEffect(() => {
    setPage(1);
  }, [
    idQuery,
    contentQuery,
    scope,
    sort,
    level,
    type,
    imageFilter,
    sourceFilter,
    statusFilter,
    reviewFilter,
    gradeId,
    domainId,
    chapterId,
    lessonId,
    formId,
  ]);

  const curriculum = useMemo(
    () => activeKnttNodes(data).sort((left, right) => left.sortOrder - right.sortOrder),
    [data],
  );
  const children = (
    parentId: string | null,
    kind: 'grade' | 'domain' | 'chapter' | 'lesson' | 'form',
  ) => curriculum.filter((node) => node.parentId === parentId && node.kind === kind);
  const grades = children(null, 'grade');
  const domains = children(gradeId || null, 'domain');
  const chapters = children(domainId || null, 'chapter');
  const lessons = children(chapterId || null, 'lesson');
  const forms = children(lessonId || null, 'form');

  const candidates = useMemo(() => {
    const idNeedle = searchText(deferredIdQuery.trim());
    return data.questions
      .filter((question) => {
        if (question.deletedAt) return false;
        if (
          scope === 'review' &&
          !(
            question.status === 'draft' ||
            question.status === 'review' ||
            question.status === 'needs_fix' ||
            !question.classificationCode ||
            question.warnings.length
          )
        )
          return false;
        if (scope === 'approved' && question.status !== 'approved') return false;
        if (scope === 'images' && !question.hasImage) return false;
        const linked =
          (gradeId || domainId || chapterId || lessonId || formId || reviewFilter === 'linked') &&
          !question.gradeNodeId &&
          question.classificationCode
            ? id6NodePath(question.classificationCode, data.curriculumNodes)
            : null;
        return (
          (!idNeedle ||
            searchText(
              `${question.displayId} ${question.classificationCode} ${question.rawSource.slice(0, 180)}`,
            ).includes(idNeedle)) &&
          (!gradeId ||
            questionGrade(question, data.curriculumNodes) ===
              gradeNumber(curriculum.find((n) => n.id === gradeId)?.code ?? '')) &&
          (!domainId || (question.domainNodeId ?? linked?.domainNodeId) === domainId) &&
          (!chapterId || (question.chapterNodeId ?? linked?.chapterNodeId) === chapterId) &&
          (!lessonId || (question.lessonNodeId ?? linked?.lessonNodeId) === lessonId) &&
          (!formId || (question.formNodeId ?? linked?.formNodeId) === formId) &&
          (!level ||
            (Boolean(question.classificationCode || question.gradeNodeId) &&
              question.level === level)) &&
          (!type || question.questionType === type) &&
          (!imageFilter || (imageFilter === 'with' ? question.hasImage : !question.hasImage)) &&
          (!sourceFilter || question.source === sourceFilter) &&
          (!statusFilter || question.status === statusFilter) &&
          (!reviewFilter ||
            (reviewFilter === 'missing'
              ? !question.classificationCode
              : reviewFilter === 'warnings'
                ? question.warnings.length > 0
                : Boolean(question.formNodeId ?? linked?.formNodeId)))
        );
      })
      .sort((left, right) => {
        if (scope === 'recent' || sort === 'updated')
          return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
        if (sort === 'oldest')
          return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
        if (sort === 'id')
          return (
            (left.displayId || left.classificationCode).localeCompare(
              right.displayId || right.classificationCode,
              'vi',
              { numeric: true },
            ) || left.id.localeCompare(right.id)
          );
        return left.usageCount - right.usageCount || right.updatedAt.localeCompare(left.updatedAt);
      });
  }, [
    scope,
    sort,
    data.questions,
    data.curriculumNodes,
    curriculum,
    deferredIdQuery,
    gradeId,
    domainId,
    chapterId,
    lessonId,
    formId,
    level,
    type,
    imageFilter,
    sourceFilter,
    statusFilter,
    reviewFilter,
  ]);

  const [searchResult, setSearchResult] = useState<{
    candidates: Question[];
    query: string;
    page: number;
    revision: number;
    value: BankSearchResult;
  } | null>(null);
  const [searchError, setSearchError] = useState('');
  useEffect(() => {
    if (!ready || busy) return;
    let active = true;
    setSearchError('');
    void getDriver()
      .then((driver) =>
        driver.searchBank({
          query: deferredContentQuery,
          orderedIds: candidates.map((q) => q.id),
          offset: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        }),
      )
      .then((value) => {
        if (!active) return;
        if (value.revision !== revision) {
          setSearchError('Dữ liệu đã đổi ở cửa sổ khác. Hãy tải lại trước khi tiếp tục.');
          return;
        }
        setSearchResult({ candidates, query: deferredContentQuery, page, revision, value });
        const lastPage = Math.max(1, Math.ceil(value.total / PAGE_SIZE));
        if (page > lastPage) setPage(lastPage);
      })
      .catch((error) => {
        if (active) setSearchError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [candidates, deferredContentQuery, page, ready, busy, revision]);
  const currentSearch =
    searchResult &&
    searchResult.candidates === candidates &&
    searchResult.query === deferredContentQuery &&
    searchResult.page === page &&
    searchResult.revision === revision
      ? searchResult.value
      : null;
  const questionById = useMemo(
    () => new Map(data.questions.map((q) => [q.id, q])),
    [data.questions],
  );
  const visible = useMemo(
    () =>
      (currentSearch?.matchedIds ?? []).flatMap((id) => {
        const q = questionById.get(id);
        return q ? [q] : [];
      }),
    [currentSearch, questionById],
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () =>
      (currentSearch?.pageIds ?? []).flatMap((id) => {
        const q = questionById.get(id);
        return q ? [q] : [];
      }),
    [currentSearch, questionById],
  );
  const virtual = useVirtualRows(pageRows);
  const { scrollToIndex } = virtual;
  useEffect(() => {
    scrollToIndex(pageRows.findIndex((q) => q.id === selectedId));
  }, [selectedId, pageRows, scrollToIndex]);
  const selected = visible.find((question) => question.id === selectedId) ?? null;
  const viewedIndex = visible.findIndex((q) => q.id === selectedId);
  function moveViewed(offset: number) {
    const index = viewedIndex < 0 ? 0 : viewedIndex + offset;
    const target = visible[index];
    if (!target) return;
    select(target.id);
    setPage(Math.floor(index / PAGE_SIZE) + 1);
  }
  function chooseAndNext() {
    if (!selected) return;
    setChecked((before) => [...new Set([...before, selected.id])]);
    if (viewedIndex < visible.length - 1) moveViewed(1);
  }
  const selectedId6Path =
    selected && !selected.gradeNodeId
      ? id6NodePath(selected.classificationCode, data.curriculumNodes)
      : null;
  const hasFilters = Boolean(
    idQuery ||
    contentQuery ||
    gradeId ||
    domainId ||
    chapterId ||
    lessonId ||
    formId ||
    level ||
    type ||
    imageFilter ||
    sourceFilter ||
    statusFilter ||
    reviewFilter,
  );
  const allPageChecked =
    pageRows.length > 0 && pageRows.every((question) => checked.includes(question.id));

  function resetFilters() {
    setScope('all');
    setIdQuery('');
    setContentQuery('');
    setGradeId('');
    setDomainId('');
    setChapterId('');
    setLessonId('');
    setFormId('');
    setLevel('');
    setType('');
    setImageFilter('');
    setSourceFilter('');
    setStatusFilter('');
    setReviewFilter('');
  }

  function togglePage(shouldCheck: boolean) {
    const ids = pageRows.map((question) => question.id);
    setChecked((current) =>
      shouldCheck
        ? Array.from(new Set([...current, ...ids]))
        : current.filter((id) => !ids.includes(id)),
    );
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setReadingFiles(true);
    try {
      const imported: Question[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} vượt quá 50 MB.`);
        if (!/\.(tex|txt)$/i.test(file.name))
          throw new Error(`${file.name}: hiện chỉ nhận .tex hoặc .txt.`);
        imported.push(
          ...parseExTest(await file.text()).map((item) =>
            parsedToQuestion(item, file.name, data.curriculumNodes),
          ),
        );
      }
      await reviewImported(imported);
    } catch (error) {
      toast(errorText(error), 'error');
    } finally {
      setReadingFiles(false);
    }
  }

  async function reviewImported(imported: Question[]) {
    if (!imported.length) {
      toast('Không tìm thấy câu hỏi trong file.', 'error');
      return;
    }
    let texSettings = DEFAULT_TEX_PREVIEW_SETTINGS;
    if (isDesktop)
      try {
        texSettings = await invoke<TexPreviewSettings>('tex_preview_settings');
      } catch {
        // Import remains available; compilation will show the native configuration error later.
      }
    const issues = imported
      .flatMap((question) =>
        findUnsupportedLatex(question.rawSource, texSettings.additionalPreamble),
      )
      .filter(
        (issue, index, rows) =>
          rows.findIndex((row) => row.kind === issue.kind && row.token === issue.token) === index,
      );
    const withWarnings = issues.length
      ? imported.map((question) => {
          const questionIssues = findUnsupportedLatex(
            question.rawSource,
            texSettings.additionalPreamble,
          );
          return {
            ...question,
            warnings: [
              ...question.warnings,
              ...questionIssues.map((issue) => `Khai báo LaTeX: ${issue.message}`),
            ],
          };
        })
      : imported;
    setSkipIdentical(true);
    setPendingImport(flagSourceIdConflicts(withWarnings, data.questions));
    setImportTexSettings(texSettings);
    setImportIssues(issues);
    setImportDeclarationStep(issues.length > 0);
    setImportDeclarationDraft(
      issues
        .map((issue) => issue.suggestion)
        .filter((value, index, rows) => rows.indexOf(value) === index)
        .join('\n'),
    );
  }

  async function importPasted() {
    if (!pasteSource.trim()) return;
    setReadingFiles(true);
    try {
      await reviewImported(
        parseExTest(pasteSource).map((item) =>
          parsedToQuestion(item, 'LaTeX đã dán', data.curriculumNodes),
        ),
      );
      setPasteOpen(false);
      setPasteSource('');
    } catch (error) {
      toast(errorText(error), 'error');
    } finally {
      setReadingFiles(false);
    }
  }

  async function saveImportDeclarations() {
    if (!importTexSettings || !isDesktop) {
      setImportDeclarationStep(false);
      return;
    }
    const addition = importDeclarationDraft.trim();
    if (!addition) return;
    try {
      const next = {
        ...importTexSettings,
        additionalPreamble: [importTexSettings.additionalPreamble.trim(), addition]
          .filter(Boolean)
          .join('\n'),
      };
      await invoke('tex_preview_save_settings', { settings: next });
      setImportTexSettings(next);
      setImportDeclarationStep(false);
      toast('Đã lưu khai báo LaTeX bổ sung. Nội dung câu hỏi không bị thay đổi.');
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  const importReview = useMemo(
    () => uniqueImports(pendingImport ?? [], data.questions),
    [pendingImport, data.questions],
  );
  const trash = useMemo(
    () => data.questions.filter((question) => question.deletedAt),
    [data.questions],
  );
  const safeTrashPage = Math.min(trashPage, Math.max(1, Math.ceil(trash.length / PAGE_SIZE)));

  async function confirmImport() {
    if (!pendingImport) return;
    try {
      let count = 0;
      await commit((snapshot) => {
        const rows = skipIdentical
          ? uniqueImports(pendingImport, snapshot.questions).questions
          : pendingImport;
        count = rows.length;
        return {
          ...snapshot,
          questions: [...snapshot.questions, ...rows],
          importJobs: [
            ...snapshot.importJobs,
            {
              id: crypto.randomUUID(),
              sourceName: [...new Set(pendingImport.map((q) => q.source))]
                .join(', ')
                .slice(0, 1000),
              status: 'committed' as const,
              totalCount: pendingImport.length,
              importedCount: rows.length,
              errorJson: JSON.stringify(
                pendingImport
                  .filter((q) => q.warnings.length)
                  .slice(0, 200)
                  .map((q) => ({
                    questionId: q.id,
                    warnings: q.warnings.slice(0, 3).map((w) => w.slice(0, 400)),
                  })),
              ),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        };
      });
      setPendingImport(null);
      toast(`Đã lưu ${count} câu. Câu trùng trong thùng rác có thể khôi phục từ nút Thùng rác.`);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  async function restoreQuestion(id: string) {
    try {
      await commit((snapshot) => ({
        ...snapshot,
        questions: snapshot.questions.map((question) =>
          question.id === id
            ? { ...question, deletedAt: null, updatedAt: new Date().toISOString() }
            : question,
        ),
      }));
      toast('Đã khôi phục câu hỏi, giữ nguyên ID và lịch sử.');
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  async function reportAction(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  async function moveToTrash(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(`Chuyển ${ids.length} câu đã chọn vào thùng rác?`)) return;
    const now = new Date().toISOString();
    await commit((snapshot) => ({
      ...snapshot,
      questions: snapshot.questions.map((question) =>
        ids.includes(question.id) ? { ...question, deletedAt: now } : question,
      ),
    }));
    setChecked((current) => current.filter((id) => !ids.includes(id)));
    if (selectedId && ids.includes(selectedId)) select(null);
    toast(`Đã chuyển ${ids.length} câu vào thùng rác.`);
  }

  async function copyQuestions(ids: string[]) {
    const source = orderedQuestions(ids, data.questions)
      .map((question) => question.rawSource.trim())
      .join('\n\n');
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      toast(`Đã chép mã LaTeX của ${ids.length} câu.`);
    } catch {
      toast('Không thể truy cập bộ nhớ tạm trên thiết bị này.', 'error');
    }
  }

  function compileSelection() {
    const byId = new Map(data.questions.filter((q) => !q.deletedAt).map((q) => [q.id, q]));
    const items = checked.flatMap((id, index) => {
      const question = byId.get(id);
      return question
        ? [
            {
              id,
              source: question.rawSource,
              label: `${index + 1}. ${question.displayId || question.classificationCode || 'Câu nháp'}`,
            },
          ]
        : [];
    });
    if (items.length) setTexBatch(items);
  }

  async function buildExamFromSelection(title: string, duration: number) {
    const questions = orderedQuestions(checked, data.questions);
    if (!questions.length) return;
    const created = createExam(title, duration, questions, String(Date.now()));
    let output: BankSnapshot = data;
    await commit((snapshot) => {
      const now = new Date().toISOString();
      output = {
        ...snapshot,
        exams: [...snapshot.exams, created.exam],
        examItems: [...snapshot.examItems, ...created.items],
        questions: snapshot.questions.map((question) =>
          questions.some((q) => q.id === question.id)
            ? { ...question, idLocked: true, usageCount: question.usageCount + 1, updatedAt: now }
            : question,
        ),
      };
      return output;
    });
    const saved = await downloadText(
      `${title.replace(/[<>:"/\\|?*]/g, '-')}.tex`,
      examToLatex(output, created.exam),
    );
    toast(
      saved
        ? `Đã lưu đề ${questions.length} câu và xuất LaTeX đúng thứ tự.`
        : 'Đã lưu đề trong ngân hàng; anh đã hủy chọn nơi xuất tệp.',
    );
  }

  function chooseScope(next: LibraryScope) {
    setScope(next);
  }

  function chooseNode(node: CurriculumNode) {
    const path: CurriculumNode[] = [];
    let current: CurriculumNode | undefined = node;
    while (current && !path.some((n) => n.id === current?.id)) {
      path.push(current);
      current = data.curriculumNodes.find((n) => n.id === current?.parentId);
    }
    setGradeId(path.find((n) => n.kind === 'grade')?.id ?? '');
    setDomainId(path.find((n) => n.kind === 'domain')?.id ?? '');
    setChapterId(path.find((n) => n.kind === 'chapter')?.id ?? '');
    setLessonId(path.find((n) => n.kind === 'lesson')?.id ?? '');
    setFormId(path.find((n) => n.kind === 'form')?.id ?? '');
  }

  async function markApproved(question: Question) {
    if (question.warnings.length || !question.classificationCode) {
      setEditor(question);
      toast('Kiểm tra ID6 và cảnh báo trong trình sửa trước khi duyệt.');
      return;
    }
    const now = new Date().toISOString();
    await commit((snapshot) => ({
      ...snapshot,
      questions: snapshot.questions.map((q) =>
        q.id === question.id ? { ...q, status: 'approved', updatedAt: now } : q,
      ),
      revisions: [
        ...snapshot.revisions,
        {
          id: crypto.randomUUID(),
          questionId: question.id,
          snapshot: JSON.stringify(question),
          reason: 'Duyệt câu hỏi',
          createdAt: now,
        },
      ],
    }));
    toast('Đã đánh dấu câu hỏi đã duyệt.');
  }

  function scanDuplicates() {
    const rows =
      visible.length > 2000 ? exactDuplicateCandidates(visible) : findDuplicateCandidates(visible);
    setDuplicates(rows);
  }

  function compileSavedExam(exam: Exam) {
    const items = data.examItems
      .filter((item) => item.examId === exam.id)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    try {
      const rows = items.map((item, index) => {
        const question = questionSchema.parse(JSON.parse(item.questionSnapshot));
        return {
          id: item.id,
          label: `${index + 1}. ${question.displayId || question.classificationCode || 'Câu chưa có ID'}`,
          source: question.rawSource,
        };
      });
      if (!rows.length) throw new Error('Đề này chưa có câu hỏi.');
      setSavedExamsOpen(false);
      setTexBatch(rows);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  if (!ready && loadError)
    return (
      <div className="page-loading" role="alert">
        <p>Không mở được ngân hàng: {loadError}</p>
        <button className="button secondary" onClick={() => void initialize()}>
          Thử lại
        </button>
      </div>
    );

  if (!ready)
    return (
      <div className="page-loading">
        <LoaderCircle className="spin" /> Đang mở ngân hàng câu hỏi…
      </div>
    );

  return (
    <div
      ref={studioRef}
      style={
        {
          '--library-width': `${panelWidths.libraryWidth}px`,
          '--reader-width': `${panelWidths.readerWidth}px`,
        } as CSSProperties
      }
      className={`qb-page qb-studio ${!sidebarOpen ? 'sidebar-hidden' : ''} ${focusDetail ? 'detail-focused' : ''}`}
    >
      <header className="qb-studio-header">
        <div className="qb-header-title">
          <div className="qb-header-icon">
            <BookOpen size={23} />
          </div>
          <div>
            <h1>Ngân hàng câu hỏi</h1>
          </div>
        </div>
        <div className="qb-header-actions">
          <button
            className="button primary"
            disabled={busy || !questionsNeedingId.length}
            onClick={scanQuestionsNeedingId}
          >
            <Sparkles size={16} /> AI xử lý ID
            {questionsNeedingId.length > 0 && <b>{questionsNeedingId.length}</b>}
          </button>
          <button
            className={`button secondary qb-tray-trigger ${checked.length ? 'has-items' : ''}`}
            onClick={() => setTrayOpen(true)}
          >
            <Layers3 size={17} /> Khay câu hỏi <b>{checked.length}</b>
          </button>
          <button
            className="button secondary"
            disabled={busy || readingFiles}
            onClick={() => setPasteOpen(true)}
          >
            <ClipboardPaste size={16} /> Dán LaTeX
          </button>
          <label className="button secondary qb-import-button">
            <FilePlus2 size={17} /> Nhập .tex
            <input
              hidden
              multiple
              type="file"
              accept=".tex,.txt"
              disabled={busy || readingFiles}
              onChange={(event) => {
                void importFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
          <button className="button primary" disabled={busy} onClick={() => setEditor('new')}>
            <Plus size={17} /> Thêm câu
          </button>
        </div>
      </header>
      {gradeId && (
        <div className="qb-active-curriculum">
          <BookOpen size={14} />
          <span>
            {curriculumPath(data, formId || lessonId || chapterId || domainId || gradeId)}
          </span>
          <button onClick={() => setCatalogFilterOpen(true)}>Đổi</button>
          <button aria-label="Xóa lọc mục lục" onClick={clearCurriculumFilter}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="qb-studio-body">
        <LibrarySidebar
          questions={activeQuestions}
          scope={scope}
          activeNodeId={formId || lessonId || chapterId || domainId || gradeId}
          trashCount={trash.length}
          onScope={chooseScope}
          onCatalog={() => setCatalogFilterOpen(true)}
          onCurriculum={() => setCurriculumOpen(true)}
          onTrash={() => {
            setTrashPage(1);
            setTrashOpen(true);
          }}
          onFilters={() => setFiltersOpen(true)}
          level={level}
          type={type}
          imageFilter={imageFilter}
          onLevel={setLevel}
          onType={setType}
          onImage={setImageFilter}
          onReset={resetFilters}
          hasFilters={hasFilters}
          taxonomy={[
            { key: 'grade', label: 'Lớp', value: gradeId, rows: grades, disabled: false },
            { key: 'domain', label: 'Nhánh', value: domainId, rows: domains, disabled: !gradeId },
            {
              key: 'chapter',
              label: 'Chương',
              value: chapterId,
              rows: chapters,
              disabled: !domainId,
            },
            { key: 'lesson', label: 'Bài', value: lessonId, rows: lessons, disabled: !chapterId },
            { key: 'form', label: 'Dạng', value: formId, rows: forms, disabled: !lessonId },
          ]}
          onTaxonomy={(key, value) => {
            if (key === 'grade') {
              setGradeId(value);
              setDomainId('');
              setChapterId('');
              setLessonId('');
              setFormId('');
            }
            if (key === 'domain') {
              setDomainId(value);
              setChapterId('');
              setLessonId('');
              setFormId('');
            }
            if (key === 'chapter') {
              setChapterId(value);
              setLessonId('');
              setFormId('');
            }
            if (key === 'lesson') {
              setLessonId(value);
              setFormId('');
            }
            if (key === 'form') setFormId(value);
          }}
          sourceFilter={sourceFilter}
          sources={[...new Set(activeQuestions.map((q) => q.source).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, 'vi'),
          )}
          onSource={setSourceFilter}
        />
        <section className="qb-library-content" aria-label="Kho câu hỏi">
          {sidebarOpen && (
            <button
              className="studio-resize-handle"
              role="separator"
              aria-label="Điều chỉnh độ rộng cây thư viện"
              aria-orientation="vertical"
              aria-valuemin={170}
              aria-valuemax={300}
              aria-valuenow={panelWidths.libraryWidth}
              onPointerDown={(e) => panelPointer('libraryWidth', e)}
              onKeyDown={(e) => panelKeyboard('libraryWidth', e)}
            />
          )}
          <div className="qb-library-toolbar">
            <div className="qb-library-context">
              <button
                className="icon-button"
                aria-label={sidebarOpen ? 'Ẩn cây thư viện' : 'Hiện cây thư viện'}
                title={sidebarOpen ? 'Ẩn cây thư viện' : 'Hiện cây thư viện'}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
              </button>
              <div>
                <h2>
                  {gradeId
                    ? curriculum.find(
                        (n) => n.id === (formId || lessonId || chapterId || domainId || gradeId),
                      )?.name
                    : {
                        all: 'Tất cả câu hỏi',
                        recent: 'Mới cập nhật',
                        review: 'Cần hoàn thiện',
                        approved: 'Đã duyệt',
                        images: 'Có hình vẽ',
                      }[scope]}
                </h2>
                <span>
                  {visible.length.toLocaleString('vi')} câu
                  {hasFilters ? ' theo bộ lọc' : ' trong thư viện'}
                </span>
              </div>
            </div>
            <button
              className={`qb-filter-trigger ${hasFilters ? 'active' : ''}`}
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={16} /> Lọc{hasFilters && <i />}
            </button>
          </div>
          <div className="qb-search-row">
            <label className="content-search">
              <Search size={17} />
              <input
                id="qb-content-search"
                aria-label="Tìm câu hỏi"
                value={contentQuery}
                onChange={(event) => setContentQuery(event.target.value)}
                placeholder="Tìm nội dung, nguồn, nhãn…"
              />
              <kbd>Ctrl K</kbd>
            </label>
            <label className="qb-id-search">
              <Code2 size={15} />
              <input
                aria-label="Tìm ID6"
                value={idQuery}
                onChange={(event) => setIdQuery(event.target.value)}
                placeholder="ID6…"
              />
            </label>
          </div>
          <div className="qb-results-toolbar">
            <label className="qb-page-select">
              <input
                aria-label="Chọn toàn bộ trang"
                type="checkbox"
                checked={allPageChecked}
                onChange={(event) => togglePage(event.target.checked)}
              />{' '}
              Chọn trang
            </label>
            <label className="qb-sort-label">
              Sắp xếp
              <select
                aria-label="Sắp xếp câu hỏi"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="updated">Mới cập nhật</option>
                <option value="oldest">Cũ nhất</option>
                <option value="id">Theo ID6</option>
                <option value="unused">Ít sử dụng</option>
              </select>
            </label>
          </div>
          {checked.length > 0 && (
            <div className="qb-selection-tools" aria-label="Thao tác với câu đã chọn">
              <strong>{checked.length} đã chọn</strong>
              <button
                className="qb-selection-primary"
                disabled={busy}
                aria-label="Gán ID hàng loạt"
                onClick={() => setAiQuestions(trayQuestions)}
              >
                <Sparkles size={14} /> Gán ID
              </button>
              <button
                title="Sắp xếp câu và tạo đề"
                disabled={busy}
                onClick={() => setTrayOpen(true)}
              >
                <Layers3 size={14} /> Tạo đề
              </button>
              <button disabled={busy} aria-label="Biên dịch câu đã chọn" onClick={compileSelection}>
                <Play size={14} /> PDF
              </button>
              <button
                aria-label="Chép LaTeX câu đã chọn"
                title="Chép LaTeX câu đã chọn"
                onClick={() => void copyQuestions(checked)}
              >
                <Copy size={14} />
              </button>
              <button
                className="danger"
                disabled={busy}
                title="Xóa"
                aria-label="Xóa"
                onClick={() => void reportAction(() => moveToTrash(checked))}
              >
                <Trash2 size={14} />
              </button>
              <button title="Bỏ chọn" aria-label="Bỏ chọn" onClick={() => setChecked([])}>
                <X size={14} />
              </button>
            </div>
          )}
          {searchError && <p role="alert">{searchError}</p>}
          {!currentSearch && !searchError && (
            <p className="muted" role="status">
              Đang truy vấn ngân hàng…
            </p>
          )}
          <div
            className="qb-table-wrap"
            ref={virtual.containerRef}
            onScroll={virtual.onScroll}
            aria-busy={!currentSearch && !searchError}
          >
            <table
              className="qb-question-table"
              aria-rowcount={visible.length + 1}
              data-page-row-count={pageRows.length}
            >
              <colgroup>
                <col style={{ width: 38 }} />
                <col />
                <col style={{ width: 94 }} />
              </colgroup>
              <thead>
                <tr>
                  <th aria-label="Chọn câu" />
                  <th>CÂU HỎI</th>
                  <th>MỨC ĐỘ</th>
                </tr>
              </thead>
              <tbody>
                {virtual.paddingTop > 0 && (
                  <tr className="qb-virtual-spacer" aria-hidden="true">
                    <td colSpan={3} style={{ height: virtual.paddingTop }} />
                  </tr>
                )}
                {virtual.rows.map((question, index) => (
                  <tr
                    key={question.id}
                    data-question-id={question.id}
                    aria-rowindex={(safePage - 1) * PAGE_SIZE + virtual.start + index + 2}
                    className={`${selectedId === question.id ? 'active' : ''} ${checked.includes(question.id) ? 'in-tray' : ''}`}
                  >
                    <td>
                      <input
                        aria-label={`Chọn ${question.displayId || question.classificationCode || `câu ${virtual.start + index + 1}`}`}
                        type="checkbox"
                        checked={checked.includes(question.id)}
                        onChange={(event) =>
                          setChecked((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, question.id]))
                              : current.filter((id) => id !== question.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="qb-question-open"
                        onClick={() => select(question.id)}
                        onDoubleClick={() => setEditor(question)}
                      >
                        <span className="qb-row-id">
                          {question.displayId || question.classificationCode || 'CHƯA CÓ ID'}
                          {question.hasImage && <ImageIcon size={13} />}
                        </span>
                        <span className="qb-row-excerpt">
                          {questionExcerpt(question.rawSource) || 'Câu hỏi chưa có nội dung mô tả'}
                        </span>
                        <span className="qb-row-meta">
                          <span className={`qb-type-dot type-${question.questionType}`} />
                          {QUESTION_TYPE_LABELS[question.questionType]}
                          <span>·</span>
                          <span className={`qb-status-text status-${question.status}`}>
                            {STATUS_LABELS[question.status]}
                          </span>
                          {question.warnings.length > 0 && <CircleAlert size={12} />}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span
                        className={`qb-badge level-${question.classificationCode || question.gradeNodeId ? question.level.toLowerCase() : 'unknown'}`}
                      >
                        {question.classificationCode || question.gradeNodeId
                          ? LEVEL_LABELS[question.level]
                          : 'Chưa gắn ID'}
                      </span>
                    </td>
                  </tr>
                ))}
                {virtual.paddingBottom > 0 && (
                  <tr className="qb-virtual-spacer" aria-hidden="true">
                    <td colSpan={3} style={{ height: virtual.paddingBottom }} />
                  </tr>
                )}
              </tbody>
            </table>
            {!pageRows.length && (
              <div className="qb-empty-table">
                <div className="qb-empty-library-icon">
                  <BookOpen size={32} />
                </div>
                <h3>
                  {activeQuestions.length ? 'Chưa có câu phù hợp' : 'Bắt đầu thư viện của anh'}
                </h3>
                <p>
                  {activeQuestions.length
                    ? 'Thử đổi từ khóa hoặc mở rộng bộ lọc.'
                    : 'Nhập bộ câu ex_test hoặc dán mã LaTeX. Câu hỏi, hình vẽ và lời giải được giữ cùng nhau.'}
                </p>
                <button
                  className="button primary"
                  onClick={() => (activeQuestions.length ? resetFilters() : setPasteOpen(true))}
                >
                  {activeQuestions.length ? 'Xóa bộ lọc' : 'Dán LaTeX để bắt đầu'}
                  <ArrowUpRight size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="qb-page-controls">
            <span>
              {visible.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–
              {Math.min(safePage * PAGE_SIZE, visible.length)} / {visible.length} câu
            </span>
            <div>
              <button
                aria-label="Trang trước"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {safePage} / {totalPages}
              </span>
              <button
                aria-label="Trang sau"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
        <aside className="qb-question-detail" aria-label="Chi tiết câu hỏi">
          <button
            className="studio-resize-handle"
            role="separator"
            aria-label="Điều chỉnh độ rộng khung đọc"
            aria-orientation="vertical"
            aria-valuemin={300}
            aria-valuemax={680}
            aria-valuenow={panelWidths.readerWidth}
            onPointerDown={(e) => panelPointer('readerWidth', e)}
            onKeyDown={(e) => panelKeyboard('readerWidth', e)}
          />
          {selected && !selected.deletedAt ? (
            <>
              <div className="qb-detail-toolbar">
                <div className="qb-detail-tabs">
                  <button
                    className={detailTab === 'preview' ? 'active' : ''}
                    onClick={() => setDetailTab('preview')}
                  >
                    <Eye size={14} /> Xem trước
                  </button>
                  <button
                    className={detailTab === 'source' ? 'active' : ''}
                    onClick={() => setDetailTab('source')}
                  >
                    <Code2 size={14} /> Xem code
                  </button>
                  <button
                    className={detailTab === 'history' ? 'active' : ''}
                    onClick={() => setDetailTab('history')}
                  >
                    <History size={14} /> Lịch sử
                  </button>
                </div>
                <div className="qb-detail-buttons">
                  <button disabled={busy} onClick={() => setEditor(selected)}>
                    <Pencil size={14} /> Sửa
                  </button>
                  <button
                    className="qb-id-action"
                    disabled={busy}
                    onClick={() => setAiQuestions([selected])}
                  >
                    <Sparkles size={14} /> Gán ID
                  </button>
                  <button onClick={() => setTexSource(selected.rawSource)}>
                    <Play size={14} /> Biên dịch PDF
                  </button>
                  <button
                    className="copy"
                    aria-label="Chép LaTeX câu đang xem"
                    title="Chép LaTeX câu đang xem"
                    onClick={() => void copyQuestions([selected.id])}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    aria-label={focusDetail ? 'Thoát chế độ tập trung' : 'Mở rộng xem trước'}
                    title={focusDetail ? 'Thoát chế độ tập trung' : 'Mở rộng xem trước'}
                    onClick={() => setFocusDetail(!focusDetail)}
                  >
                    {focusDetail ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{' '}
                    {focusDetail ? 'Thu gọn' : 'Đọc rộng'}
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    aria-label="Xóa câu đang xem"
                    title="Xóa câu đang xem"
                    onClick={() => void reportAction(() => moveToTrash([selected.id]))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="qb-reader-navigation" aria-label="Duyệt câu hỏi">
                <button
                  aria-label="Câu trước"
                  disabled={viewedIndex <= 0}
                  onClick={() => moveViewed(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {viewedIndex + 1} / {visible.length}
                </span>
                <button
                  aria-label="Câu tiếp theo"
                  disabled={viewedIndex >= visible.length - 1}
                  onClick={() => moveViewed(1)}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  className={checked.includes(selected.id) ? 'selected' : ''}
                  onClick={() =>
                    setChecked((before) =>
                      checked.includes(selected.id)
                        ? before.filter((id) => id !== selected.id)
                        : [...before, selected.id],
                    )
                  }
                >
                  {checked.includes(selected.id) ? 'Đã chọn vào khay' : 'Chọn vào khay'}
                </button>
                <button onClick={chooseAndNext}>
                  Chọn & tiếp <ChevronRight size={14} />
                </button>
              </div>
              <div className="qb-detail-identity">
                <strong>
                  {selected.displayId ||
                    (selected.classificationCode
                      ? `${selected.classificationCode} · ID nguồn chưa duyệt`
                      : 'Câu chưa có ID')}
                </strong>
                <span>
                  {selected.source || 'Chưa ghi nguồn'} · {STATUS_LABELS[selected.status]}
                  {data.assets.filter((a) => a.questionId === selected.id && a.missing).length >
                    0 && (
                    <span> · Có tài nguyên chưa xác minh. Kiểm tra đường dẫn trong dự án TeX.</span>
                  )}
                </span>
              </div>
              <div className="qb-detail-meta-row">
                <span className={`qb-badge type-${selected.questionType}`}>
                  {QUESTION_TYPE_LABELS[selected.questionType]}
                </span>
                <span className={`qb-badge level-${selected.level.toLowerCase()}`}>
                  {selected.classificationCode || selected.gradeNodeId
                    ? LEVEL_LABELS[selected.level]
                    : 'Chưa xác định'}
                </span>
                <span className="qb-path-label">
                  {curriculumPath(
                    data,
                    selected.formNodeId ||
                      selected.lessonNodeId ||
                      selectedId6Path?.formNodeId ||
                      null,
                  ) || 'Chưa phân loại'}
                </span>
                <label className="qb-zoom-control">
                  <input
                    aria-label="Cỡ chữ xem trước"
                    type="range"
                    min="85"
                    max="130"
                    step="5"
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                  <button type="button" title="Đặt lại cỡ chữ" onClick={() => setZoom(100)}>
                    {zoom}%
                  </button>
                </label>
              </div>
              {selected.warnings.length > 0 && (
                <details className="qb-question-warnings">
                  <summary>Cần kiểm tra ({selected.warnings.length})</summary>
                  {selected.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </details>
              )}
              <div
                ref={reader}
                className="qb-detail-content"
                style={{ fontSize: `${(16 * zoom) / 100}px` }}
              >
                <div className="qb-paper-heading">
                  <span>NỘI DUNG CÂU HỎI</span>
                  <span>{selected.hasImage ? 'Có hình vẽ' : 'LaTeX'}</span>
                </div>
                {detailTab === 'preview' ? (
                  <QuestionPreview
                    renderTikz={
                      editor === null &&
                      texSource === null &&
                      texBatch === null &&
                      aiQuestions === null
                    }
                    key={selected.id}
                    source={selected.rawSource}
                    answer={selected.answer}
                    solution={selected.solution}
                    onRequestCompile={() => setTexSource(selected.rawSource)}
                  />
                ) : detailTab === 'source' ? (
                  <pre className="qb-source-view">{selected.rawSource}</pre>
                ) : (
                  <div className="qb-revision-list">
                    <h3>Lịch sử câu hỏi</h3>
                    <p>Các bản trước khi sửa được giữ riêng.</p>
                    {data.revisions
                      .filter((rev) => rev.questionId === selected.id)
                      .slice()
                      .reverse()
                      .map((revision) => {
                        let previous: Question | null = null;
                        try {
                          const parsed = questionSchema.safeParse(JSON.parse(revision.snapshot));
                          previous = parsed.success ? parsed.data : null;
                        } catch {
                          /* An invalid snapshot stays readable as metadata. */
                        }
                        return (
                          <article key={revision.id}>
                            <strong>{revision.reason}</strong>
                            <small>{new Date(revision.createdAt).toLocaleString('vi-VN')}</small>
                            {previous && (
                              <>
                                <pre>{previous.rawSource}</pre>
                                <button
                                  className="button secondary"
                                  onClick={() =>
                                    setEditor({
                                      ...selected,
                                      rawSource: previous.rawSource,
                                      answer: previous.answer,
                                      solution: previous.solution,
                                    })
                                  }
                                >
                                  Mở bản cũ để sửa
                                </button>
                              </>
                            )}
                          </article>
                        );
                      })}
                    {!data.revisions.some((rev) => rev.questionId === selected.id) && (
                      <div className="qb-empty-table">
                        <History size={25} />
                        <span>Chưa có phiên bản cũ.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="qb-inspector-footer">
                <span>Đã sửa {new Date(selected.updatedAt).toLocaleDateString('vi-VN')}</span>
                <button
                  disabled={busy || selected.status === 'approved'}
                  onClick={() => void reportAction(() => markApproved(selected))}
                >
                  <CheckCheck size={15} />{' '}
                  {selected.status === 'approved' ? 'Đã duyệt' : 'Đánh dấu đã duyệt'}
                </button>
              </div>
            </>
          ) : (
            <div className="qb-empty-detail">
              <div className="qb-empty-paper">
                <Code2 size={32} />
              </div>
              <strong>Không gian cho từng câu hỏi</strong>
              <span>Chọn một câu để xem đề, đáp án và lời giải.</span>
              <small>Mã nguồn · Bản xem trước · Lịch sử</small>
            </div>
          )}
        </aside>
      </div>
      <footer className="qb-statusbar">
        <span>
          <span className="qb-local-dot" />{' '}
          {busy ? 'Đang lưu thay đổi…' : 'Ngân hàng trên thiết bị'}
        </span>
        <span>{activeQuestions.length} câu</span>
        <button onClick={() => setSavedExamsOpen(true)}>
          <Layers3 size={13} /> Đề đã lưu ({data.exams.length})
        </button>
        <div>
          <button onClick={() => setCurriculumOpen(true)}>
            <BookOpen size={13} /> Cây mục lục
          </button>
          <button title="Quét câu trùng trong kết quả đang lọc" onClick={scanDuplicates}>
            <CopyCheck size={13} /> Quét trùng
          </button>
        </div>
      </footer>
      {savedExamsOpen && (
        <SavedExams
          data={data}
          onClose={() => setSavedExamsOpen(false)}
          onCompile={compileSavedExam}
          onExport={(exam) =>
            void reportAction(async () => {
              const saved = await downloadText(
                `${exam.title.replace(/[<>:"/\\|?*]/g, '-')}.tex`,
                examToLatex(data, exam),
              );
              if (saved) toast('Đã xuất lại đề từ bản chụp đã lưu.');
            })
          }
        />
      )}
      {catalogFilterOpen && (
        <CurriculumFilter
          data={data}
          questions={activeQuestions}
          activeNodeId={formId || lessonId || chapterId || domainId || gradeId}
          onClose={() => setCatalogFilterOpen(false)}
          onApply={(node) => {
            chooseNode(node);
            setCatalogFilterOpen(false);
          }}
          onClear={() => {
            clearCurriculumFilter();
            setCatalogFilterOpen(false);
          }}
        />
      )}
      {filtersOpen && (
        <Modal
          title="Bộ lọc câu hỏi"
          subtitle="Kết hợp chương trình, loại câu và trạng thái dữ liệu."
          onClose={() => setFiltersOpen(false)}
          wide
          className="qb-filters-dialog"
        >
          <div className="modal-body qb-filter-grid">
            {' '}
            <FilterSelect
              label="Lớp"
              value={gradeId}
              placeholder="— Tất cả lớp —"
              rows={grades}
              onChange={(value) => {
                setGradeId(value);
                setDomainId('');
                setChapterId('');
                setLessonId('');
                setFormId('');
              }}
            />
            <FilterSelect
              label="Cấp 2 / Phân môn"
              value={domainId}
              placeholder="— Tất cả —"
              rows={domains}
              disabled={!gradeId}
              onChange={(value) => {
                setDomainId(value);
                setChapterId('');
                setLessonId('');
                setFormId('');
              }}
            />
            <FilterSelect
              label="Chương"
              value={chapterId}
              placeholder="— Tất cả chương —"
              rows={chapters}
              disabled={!domainId}
              onChange={(value) => {
                setChapterId(value);
                setLessonId('');
                setFormId('');
              }}
            />
            <FilterSelect
              label="Bài"
              value={lessonId}
              placeholder="— Tất cả bài —"
              rows={lessons}
              disabled={!chapterId}
              onChange={(value) => {
                setLessonId(value);
                setFormId('');
              }}
            />
            <FilterSelect
              label="Dạng"
              value={formId}
              placeholder="— Tất cả dạng —"
              rows={forms}
              disabled={!lessonId}
              onChange={setFormId}
            />
            <label className="qb-filter-field">
              <span>Mức độ</span>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="">— Tất cả mức độ —</option>
                {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="qb-filter-field">
              <span>Loại câu hỏi</span>
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">— Tất cả loại —</option>
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="qb-filter-field">
              <span>Hình ảnh</span>
              <select value={imageFilter} onChange={(event) => setImageFilter(event.target.value)}>
                <option value="">— Có/Không có hình —</option>
                <option value="with">Có hình</option>
                <option value="without">Không có hình</option>
              </select>
            </label>
            <label className="qb-filter-field">
              <span>Trạng thái duyệt</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">— Tất cả trạng thái —</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="qb-filter-field">
              <span>Kiểm tra dữ liệu</span>
              <select
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value)}
              >
                <option value="">— Tất cả câu —</option>
                <option value="missing">Thiếu ID6</option>
                <option value="linked">Đã gắn cây ID6</option>
                <option value="warnings">Có cảnh báo</option>
              </select>
            </label>
            <button className="qb-reset-button" disabled={!hasFilters} onClick={resetFilters}>
              <RotateCcw size={15} /> Xóa bộ lọc
            </button>
            <div className="qb-filter-count">
              Hiển thị {visible.length.toLocaleString('vi-VN')} câu
            </div>
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setFiltersOpen(false)}>
              Xem {visible.length} câu phù hợp
            </button>
          </div>
        </Modal>
      )}
      {pasteOpen && (
        <Modal
          title="Dán mã LaTeX"
          subtitle="Nhập một câu hoặc nhiều câu trong môi trường ex. Kiểm tra trước khi lưu."
          onClose={() => setPasteOpen(false)}
          wide
        >
          <div className="modal-body">
            <textarea
              className="qb-paste-source"
              aria-label="Mã LaTeX cần nhập"
              spellCheck={false}
              placeholder={'\\begin{ex}\n  Nội dung câu hỏi…\n\\end{ex}'}
              value={pasteSource}
              onChange={(event) => setPasteSource(event.target.value)}
            />
          </div>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setPasteOpen(false)}>
              Để sau
            </button>
            <button
              className="button primary"
              disabled={!pasteSource.trim() || readingFiles}
              onClick={() => void importPasted()}
            >
              Kiểm tra câu hỏi
            </button>
          </div>
        </Modal>
      )}
      {trayOpen && (
        <SelectionTray
          questions={trayQuestions}
          busy={busy}
          onClose={() => setTrayOpen(false)}
          onMove={(id, offset) => setChecked((current) => moveSelection(current, id, offset))}
          onRemove={(id) => setChecked((current) => current.filter((value) => value !== id))}
          onCopy={() => void copyQuestions(checked)}
          onCompile={() => {
            setTrayOpen(false);
            compileSelection();
          }}
          onExport={(title, duration) =>
            reportAction(() => buildExamFromSelection(title, duration))
          }
        />
      )}

      {aiQuestions && <AiIdScan questions={aiQuestions} onClose={() => setAiQuestions(null)} />}
      {curriculumOpen && (
        <Modal
          title="Cây mục lục và phân loại"
          subtitle="Mục lục KNTT Toán 10–12 dùng cho AI; các cây cũ được tách vào chế độ tham khảo."
          onClose={() => setCurriculumOpen(false)}
          wide
          className="qb-curriculum-dialog"
        >
          <div className="modal-body qb-curriculum-dialog-body">
            <CurriculumManager />
          </div>
        </Modal>
      )}
      {texSource !== null && (
        <TexLivePreview source={texSource} onClose={() => setTexSource(null)} />
      )}
      {texBatch !== null && (
        <TexLivePreview
          source={texBatch[0].source}
          items={texBatch}
          onClose={() => setTexBatch(null)}
        />
      )}
      {pendingImport && (
        <Modal
          title={importDeclarationStep ? 'Bổ sung khai báo LaTeX' : 'Kiểm tra trước khi nhập'}
          subtitle={
            importDeclarationStep
              ? 'Phát hiện lệnh hoặc môi trường chưa có trong bộ tích hợp.'
              : 'Giữ nguyên mã LaTeX nguồn; ID6 hợp lệ được liên kết với cây ID6 đang dùng.'
          }
          onClose={() => !busy && setPendingImport(null)}
          wide
        >
          {importDeclarationStep ? (
            <div className="modal-body qb-tex-diagnostics">
              <h3>{importIssues.length} thành phần cần kiểm tra</h3>
              {importIssues.map((issue) => (
                <p key={`${issue.kind}:${issue.token}`}>{issue.message}</p>
              ))}
              <label className="field">
                Khai báo bổ sung
                <textarea
                  rows={10}
                  spellCheck={false}
                  value={importDeclarationDraft}
                  onChange={(event) => setImportDeclarationDraft(event.target.value)}
                />
              </label>
              <p className="muted">
                App không tự đoán số tham số của macro riêng. Hãy dán khai báo gốc nếu phần gợi ý
                mới chỉ là chú thích. Có thể tiếp tục nhập và bổ sung sau trong Cài đặt.
              </p>
            </div>
          ) : (
            <div className="modal-body">
              <p>
                {pendingImport.length} câu ·{' '}
                {pendingImport.filter((q) => q.classificationCode).length} có ID nguồn ·{' '}
                {pendingImport.filter((q) => q.formNodeId).length} đã gắn cây ID6 ·{' '}
                {pendingImport.filter((q) => q.warnings.length).length} cần xem lại.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={skipIdentical}
                  disabled={busy}
                  onChange={(e) => setSkipIdentical(e.target.checked)}
                />{' '}
                Bỏ qua {importReview.skipped} câu có mã LaTeX giống hệt (kể cả trong thùng rác).
              </label>
              <p>
                Sẽ lưu {skipIdentical ? importReview.questions.length : pendingImport.length} câu.
                Hiển thị tối đa 50 câu đầu bên dưới.
              </p>
              <div className="qb-import-review">
                {pendingImport.slice(0, 50).map((q, i) => (
                  <div key={q.id}>
                    <strong>
                      {i + 1}. {q.classificationCode || 'Chưa có ID'} ·{' '}
                      {QUESTION_TYPE_LABELS[q.questionType]}
                    </strong>
                    <small>
                      {q.source} · Đáp án: {q.answer || 'Chưa nhận diện'}
                    </small>
                    {q.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="modal-footer">
            {importDeclarationStep ? (
              <>
                <button className="button secondary" onClick={() => setPendingImport(null)}>
                  Hủy nhập
                </button>
                <button
                  className="button secondary"
                  onClick={() => setImportDeclarationStep(false)}
                >
                  Bỏ qua cảnh báo
                </button>
                <button
                  className="button primary"
                  disabled={isDesktop && !importDeclarationDraft.trim()}
                  onClick={() => void saveImportDeclarations()}
                >
                  {isDesktop ? 'Lưu khai báo và tiếp tục' : 'Tiếp tục kiểm tra'}
                </button>
              </>
            ) : (
              <>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setPendingImport(null)}
                >
                  Hủy nhập
                </button>
                {importIssues.length > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => setImportDeclarationStep(true)}
                  >
                    Xem khai báo thiếu ({importIssues.length})
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={busy || (skipIdentical && !importReview.questions.length)}
                  onClick={() => void confirmImport()}
                >
                  Xác nhận nhập
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      {trashOpen && (
        <Modal
          title="Thùng rác câu hỏi"
          subtitle={`${trash.length} câu có thể khôi phục; không xóa vĩnh viễn.`}
          onClose={() => setTrashOpen(false)}
          wide
        >
          <div className="modal-body qb-import-review">
            {trash.slice((safeTrashPage - 1) * PAGE_SIZE, safeTrashPage * PAGE_SIZE).map((q) => (
              <div key={q.id}>
                <strong>{q.displayId || q.classificationCode || 'Câu chưa có ID'}</strong>
                <small>{q.source}</small>
                <p>{q.rawSource.slice(0, 180)}</p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void restoreQuestion(q.id)}
                >
                  Khôi phục
                </button>
              </div>
            ))}
            {!trash.length && <p>Thùng rác trống.</p>}
          </div>
          <div className="modal-footer">
            <button disabled={safeTrashPage <= 1} onClick={() => setTrashPage(safeTrashPage - 1)}>
              Trang trước
            </button>
            <span>Trang {safeTrashPage}</span>
            <button
              disabled={safeTrashPage * PAGE_SIZE >= trash.length}
              onClick={() => setTrashPage(safeTrashPage + 1)}
            >
              Trang sau
            </button>
          </div>
        </Modal>
      )}
      {editor && (
        <QuestionEditor
          question={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {duplicates !== null && (
        <DuplicateResults
          rows={duplicates}
          scanned={visible.length}
          onClose={() => setDuplicates(null)}
          onOpen={(id) => {
            select(id);
            setDuplicates(null);
          }}
        />
      )}
      {(busy || readingFiles) && (
        <div className="qb-saving">{busy ? 'Đang lưu…' : 'Đang đọc file…'}</div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  rows,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  rows: Array<{ id: string; code: string; name: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="qb-filter-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.code ? `${row.code} · ` : ''}
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DuplicateResults({
  rows,
  scanned,
  onClose,
  onOpen,
}: {
  rows: DuplicateCandidate[];
  scanned: number;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Modal
      title="Quét câu trùng"
      subtitle={`Đã quét ${scanned.toLocaleString('vi-VN')} câu trong kết quả hiện tại.`}
      onClose={onClose}
      wide
    >
      <div className="modal-body qb-duplicate-modal">
        <div className="qb-duplicate-summary">
          <CopyCheck size={20} />
          <strong>{rows.length} cặp nghi trùng</strong>
          <span>Nhấn vào một cặp để mở câu thứ nhất và kiểm tra thủ công.</span>
        </div>
        <div className="qb-duplicate-results">
          {rows.map((pair) => (
            <button key={`${pair.left.id}-${pair.right.id}`} onClick={() => onOpen(pair.left.id)}>
              <b>{pair.score}%</b>
              <span>
                {pair.left.displayId || 'Câu nháp'} ↔ {pair.right.displayId || 'Câu nháp'}
              </span>
              <small>{pair.method === 'hash' ? 'Trùng chính xác' : 'Tương đồng nội dung'}</small>
            </button>
          ))}
          {!rows.length && (
            <div className="qb-empty-table">
              <CopyCheck size={24} />
              <strong>Không phát hiện câu trùng</strong>
            </div>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Đóng
        </button>
      </div>
    </Modal>
  );
}
