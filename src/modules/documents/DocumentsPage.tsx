import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  BookOpen,
  FileText,
  Folder,
  FolderPlus,
  Plus,
  Upload,
  Save,
  Play,
  Trash2,
  Pencil,
  X,
  Download,
  RotateCcw,
  ArrowRight,
  Copy,
  Search,
  StopCircle,
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useToasts } from '../../components/feedback';
import { errorText } from '../../app/store';
import { isDesktop } from '../../database/driver';
import { saveFile } from '../../services/files';
import {
  DEFAULT_TEX_PREVIEW_SETTINGS,
  type TexPreviewSettings,
} from '../question-bank/domain/texPreview';
import {
  descendants,
  moveNode,
  nodePath,
  parseProjectBackup,
  projectBackup,
  restoreNode,
  trashNode,
  validName,
  type DocumentNode,
  type DocumentProject,
} from './model';
import { loadProjects, removeProject, saveProject } from './storage';
import './documents.css';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const editable = (name: string) => /\.(tex|txt|sty|cls|bib|bst|cfg|def|md|csv)$/i.test(name);
export default function DocumentsPage() {
  const toast = useToasts((s) => s.push);
  const [projects, setProjects] = useState<DocumentProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [tabs, setTabs] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [trash, setTrash] = useState(false);
  const [action, setAction] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('10');
  const [category, setCategory] = useState<'review' | 'exam'>('review');
  const [target, setTarget] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState('');
  const [results, setResults] = useState<
    Record<string, { pdf: Uint8Array; log: string; success: boolean }>
  >({});
  const [showPdf, setShowPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const stop = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const project = projects.find((p) => p.id === projectId);
  const selected = project?.nodes.find((n) => n.id === selectedId && !n.deletedAt);
  const result = results[projectId];
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    void loadProjects()
      .then((rows) => {
        setProjects(rows);
        setProjectId(rows[0]?.id ?? '');
        setLoaded(true);
      })
      .catch((e) => {
        setError(errorText(e));
        setLoaded(true);
      });
  }, []);
  useEffect(() => {
    let url = '';
    if (showPdf && result?.success)
      url = URL.createObjectURL(
        new Blob([new Uint8Array(result.pdf)], { type: 'application/pdf' }),
      );
    else if (selected && /\.pdf$/i.test(selected.name))
      url = URL.createObjectURL(
        new Blob([new Uint8Array(selected.bytes)], { type: 'application/pdf' }),
      );
    setPdfUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected, result, showPdf]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  useEffect(() => {
    const guard = () =>
      !dirty || window.confirm('Kho đề còn mã chưa lưu. Rời màn hình và bỏ thay đổi?');
    let released = false;
    void import('../../app/ui').then(({ useUi }) => {
      if (!released) useUi.setState({ navigationGuard: guard });
    });
    return () => {
      released = true;
      void import('../../app/ui').then(({ useUi }) => {
        if (useUi.getState().navigationGuard === guard) useUi.setState({ navigationGuard: null });
      });
    };
  }, [dirty]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function persist(next: DocumentProject) {
    const saved = await saveProject(next);
    setProjects((rows) => {
      const exists = rows.some((p) => p.id === saved.id);
      return exists ? rows.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...rows];
    });
    return saved;
  }
  function switchProject(id: string) {
    if (dirty && !window.confirm('Lưu file trước hoặc bỏ thay đổi để chuyển bộ đề?')) return;
    setDrafts({});
    setProjectId(id);
    setSelectedId('');
    setTabs([]);
    setShowPdf(false);
    setTrash(false);
  }
  function openNode(n: DocumentNode) {
    setShowPdf(false);
    if (n.kind === 'folder') {
      setExpanded((old) => {
        const next = new Set(old);
        if (next.has(n.id)) next.delete(n.id);
        else next.add(n.id);
        return next;
      });
      setSelectedId(n.id);
      return;
    }
    setTabs((old) => (old.includes(n.id) ? old : [...old, n.id]));
    setSelectedId(n.id);
    setShowPdf(false);
  }
  function closeTab(id: string) {
    if (drafts[id] !== undefined && !window.confirm('Bỏ thay đổi chưa lưu của file này?')) return;
    setDrafts((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    setTabs((old) => old.filter((x) => x !== id));
    if (selectedId === id) setSelectedId(tabs.filter((x) => x !== id).at(-1) ?? '');
  }
  async function saveEdits(all = false) {
    if (!project) return;
    const ids = all ? Object.keys(drafts) : [selectedId];
    const next = {
      ...project,
      nodes: project.nodes.map((n) =>
        ids.includes(n.id) && drafts[n.id] !== undefined
          ? { ...n, bytes: encoder.encode(drafts[n.id]) }
          : n,
      ),
    };
    await persist(next);
    setDrafts((old) => Object.fromEntries(Object.entries(old).filter(([id]) => !ids.includes(id))));
    toast('Đã lưu mã nguồn.');
  }
  const shortcut = useRef(saveEdits);
  shortcut.current = saveEdits;
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void runRef.current(() => shortcut.current(e.shiftKey));
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  function begin(kind: string) {
    setAction(kind);
    setName(
      kind === 'project'
        ? 'Bộ đề mới'
        : kind === 'rename-project'
          ? (project?.title ?? '')
          : kind === 'rename'
            ? (selected?.name ?? '')
            : kind === 'folder'
              ? 'Thư mục mới'
              : kind === 'file'
                ? 'bai-tap.tex'
                : '',
    );
    setTarget('');
  }
  async function applyAction() {
    if (action === 'project') {
      const main: DocumentNode = {
        id: crypto.randomUUID(),
        parentId: null,
        name: 'main.tex',
        kind: 'file',
        deletedAt: null,
        bytes: encoder.encode(String.raw`\documentclass[12pt,a4paper]{article}
\usepackage{fontspec}
\setmainfont{Times New Roman}
\usepackage{amsmath,amssymb,tikz}
% Thêm bộ khai báo ex_test của anh tại đây.
\begin{document}
Nội dung đề.
\end{document}`),
      };
      const next: DocumentProject = {
        id: crypto.randomUUID(),
        title: name.trim(),
        grade,
        category,
        year: '2026–2027',
        mainId: main.id,
        engine: 'xelatex',
        nodes: [main],
        updatedAt: new Date().toISOString(),
        revision: 0,
      };
      const saved = await persist(next);
      switchProject(saved.id);
      setTabs([main.id]);
      setSelectedId(main.id);
    } else if (project) {
      if (action === 'rename-project')
        await persist({ ...project, title: name.trim(), grade, category });
      else if (action === 'delete-project') {
        if (dirty && !window.confirm('Xóa bộ đề và bỏ các thay đổi chưa lưu?')) return;
        await removeProject(project);
        setProjects((rows) => rows.filter((p) => p.id !== project.id));
        setProjectId('');
        setSelectedId('');
        setTabs([]);
        setDrafts({});
      } else if (action === 'move' && selected)
        await persist(moveNode(project, selected.id, target || null));
      else if (action === 'rename' && selected) {
        validName(name);
        await persist({
          ...project,
          nodes: project.nodes.map((n) => (n.id === selected.id ? { ...n, name } : n)),
        });
      } else if (action === 'delete' && selected) {
        const affected = descendants(project, selected.id);
        if (
          Object.keys(drafts).some((id) => affected.has(id)) &&
          !window.confirm('File còn thay đổi chưa lưu. Chuyển vào thùng rác và bỏ thay đổi?')
        )
          return;
        await persist(trashNode(project, selected.id));
        const ids = descendants(project, selected.id);
        setTabs((rows) => rows.filter((id) => !ids.has(id)));
        setDrafts((old) => Object.fromEntries(Object.entries(old).filter(([id]) => !ids.has(id))));
        setSelectedId('');
      } else if (action === 'folder' || action === 'file') {
        validName(name);
        const node: DocumentNode = {
          id: crypto.randomUUID(),
          parentId: selected?.kind === 'folder' ? selected.id : (selected?.parentId ?? null),
          name,
          kind: action === 'folder' ? 'folder' : 'file',
          bytes: new Uint8Array(),
          deletedAt: null,
        };
        await persist({ ...project, nodes: [...project.nodes, node] });
        if (node.parentId) setExpanded((old) => new Set([...old, node.parentId!]));
        if (node.kind === 'file') openNode(node);
      } else if (action === 'duplicate' && selected) {
        validName(name);
        const ids = descendants(project, selected.id);
        const mapping = new Map([...ids].map((id) => [id, crypto.randomUUID()]));
        const copied = project.nodes
          .filter((n) => ids.has(n.id) && !n.deletedAt)
          .map((n) => ({
            ...n,
            id: mapping.get(n.id)!,
            name: n.id === selected.id ? name : n.name,
            parentId: n.id === selected.id ? n.parentId : (mapping.get(n.parentId!) ?? null),
            bytes: new Uint8Array(n.bytes),
          }));
        await persist({ ...project, nodes: [...project.nodes, ...copied] });
      }
    }
    setAction('');
  }
  async function importFiles(files: FileList | null) {
    if (!files?.length || !project) return;
    let next = { ...project, nodes: [...project.nodes] };
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} vượt quá 25 MB.`);
      const parts = (file.webkitRelativePath || file.name).split('/');
      let parent: string | null = selected?.kind === 'folder' ? selected.id : null;
      for (const part of parts.slice(0, -1)) {
        validName(part);
        let folder = next.nodes.find(
          (n) =>
            n.parentId === parent && n.name.toLowerCase() === part.toLowerCase() && !n.deletedAt,
        );
        if (folder && folder.kind !== 'folder') throw new Error('Tên thư mục trùng tên file.');
        if (!folder) {
          folder = {
            id: crypto.randomUUID(),
            parentId: parent,
            name: part,
            kind: 'folder',
            bytes: new Uint8Array(),
            deletedAt: null,
          };
          next = { ...next, nodes: [...next.nodes, folder] };
        }
        parent = folder.id;
      }
      next.nodes.push({
        id: crypto.randomUUID(),
        parentId: parent,
        name: parts.at(-1)!,
        kind: 'file',
        bytes: new Uint8Array(await file.arrayBuffer()),
        deletedAt: null,
      });
    }
    await persist(next);
    toast(`Đã nhập ${files.length} file. File trùng tên được báo lỗi, không ghi đè.`);
  }
  async function compileProjects() {
    if (!isDesktop) {
      toast('Biên dịch TeX Live cần ứng dụng Windows.', 'error');
      return;
    }
    if (dirty) {
      toast('Lưu tất cả file đang sửa trước khi biên dịch.', 'error');
      return;
    }
    if (compiling) return;
    const ids = queue.length ? queue : [projectId];
    setCompiling(true);
    stop.current = false;
    for (const [i, id] of ids.entries()) {
      if (stop.current) break;
      const p = projects.find((row) => row.id === id);
      if (!p?.mainId) {
        setCompileStatus(`${p?.title ?? 'Bộ đề'}: chưa chọn main.tex.`);
        continue;
      }
      setCompileStatus(`${i + 1}/${ids.length} · ${p.title}`);
      try {
        const saved = await invoke<TexPreviewSettings>('tex_preview_settings');
        const settings = {
          ...DEFAULT_TEX_PREVIEW_SETTINGS,
          ...saved,
          engine: p.engine,
          executable: saved.engine === p.engine ? saved.executable : '',
        };
        const main = p.nodes.find((n) => n.id === p.mainId)!;
        const result = await invoke<{ success: boolean; pdf: number[]; log: string }>(
          'document_project_compile',
          {
            settings,
            mainPath: nodePath(p, main),
            files: p.nodes
              .filter((n) => n.kind === 'file' && !n.deletedAt)
              .map((n) => ({ path: nodePath(p, n), bytes: Array.from(n.bytes) })),
          },
        );
        setResults((old) => ({
          ...old,
          [id]: { success: result.success, pdf: new Uint8Array(result.pdf), log: result.log },
        }));
        if (id === projectId) setShowPdf(result.success);
      } catch (e) {
        setResults((old) => ({
          ...old,
          [id]: { success: false, pdf: new Uint8Array(), log: errorText(e) },
        }));
      }
    }
    setCompiling(false);
    setCompileStatus(
      stop.current
        ? 'Đã dừng hàng đợi.'
        : 'Đã kết thúc hàng đợi. Xem kết quả riêng của từng bộ đề.',
    );
  }
  function tree(parentId: string | null, depth = 0): React.ReactNode {
    return project?.nodes
      .filter((n) => n.parentId === parentId && !n.deletedAt)
      .sort((a, b) =>
        a.kind === b.kind
          ? a.name.localeCompare(b.name, 'vi', { numeric: true })
          : a.kind === 'folder'
            ? -1
            : 1,
      )
      .map((n) => (
        <div key={n.id}>
          <button
            className={`doc-tree-row ${selectedId === n.id ? 'active' : ''}`}
            style={{ paddingLeft: 12 + depth * 15 }}
            onClick={() => openNode(n)}
            title={nodePath(project, n)}
          >
            {n.kind === 'folder' ? <Folder size={15} /> : <FileText size={15} />}
            <span>{n.name}</span>
            {project.mainId === n.id && <small>MAIN</small>}
          </button>
          {n.kind === 'folder' && expanded.has(n.id) && tree(n.id, depth + 1)}
        </div>
      ));
  }
  let text = '';
  let invalidEncoding = false;
  if (selected && editable(selected.name)) {
    try {
      text = drafts[selected.id] ?? decoder.decode(selected.bytes);
    } catch {
      invalidEncoding = true;
      text = 'File không phải UTF-8. Chuyển mã hóa trước khi sửa.';
    }
  }
  return (
    <div className="doc-page">
      <header className="doc-header">
        <div>
          <span>THƯ VIỆN TÀI LIỆU CÁ NHÂN</span>
          <h1>Kho đề ôn tập & đề thi</h1>
        </div>
        <button
          className="button secondary"
          onClick={() => begin('project')}
          disabled={busy || compiling}
        >
          <Plus size={16} /> Bộ đề mới
        </button>
        <label className="button secondary">
          Nhập backup
          <input
            hidden
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => {
                  if (file.size > 400 * 1024 * 1024) throw new Error('Backup quá lớn.');
                  const p = parseProjectBackup(await file.text());
                  await persist(p);
                  toast('Đã nhập bản sao bộ đề.');
                });
              e.target.value = '';
            }}
          />
        </label>
        <button
          className="button primary"
          disabled={!project || compiling || busy}
          onClick={() => void compileProjects()}
        >
          <Play size={16} /> Biên dịch {queue.length > 1 ? `(${queue.length})` : ''}
        </button>
        {compiling && (
          <button
            className="button secondary"
            onClick={() => {
              stop.current = true;
              void invoke('tex_preview_cancel');
            }}
          >
            <StopCircle size={16} /> Dừng
          </button>
        )}
      </header>
      <div className="doc-workspace">
        <aside className="doc-explorer">
          <label className="doc-search">
            <Search size={15} />
            <input
              aria-label="Tìm bộ đề"
              placeholder="Tìm bộ đề…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="doc-projects">
            {(['review', 'exam'] as const).map((cat) => (
              <section key={cat}>
                <h3>{cat === 'review' ? 'ĐỀ ÔN TẬP' : 'ĐỀ KIỂM TRA / THI'}</h3>
                {projects
                  .filter(
                    (p) =>
                      p.category === cat && p.title.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <div key={p.id} className={`doc-project ${p.id === projectId ? 'active' : ''}`}>
                      <input
                        aria-label={`Xếp hàng ${p.title}`}
                        type="checkbox"
                        checked={queue.includes(p.id)}
                        onChange={(e) =>
                          setQueue((old) =>
                            e.target.checked ? [...old, p.id] : old.filter((id) => id !== p.id),
                          )
                        }
                      />
                      <button onClick={() => switchProject(p.id)}>
                        <BookOpen size={14} />
                        <span>
                          {p.title}
                          <small>
                            Lớp {p.grade} · {p.year}
                          </small>
                        </span>
                      </button>
                    </div>
                  ))}
              </section>
            ))}
          </div>
          <div className="doc-explorer-heading">
            <strong>FILE TRONG BỘ ĐỀ</strong>
            <button
              title="Thêm thư mục"
              aria-label="Thêm thư mục"
              disabled={!project || busy}
              onClick={() => begin('folder')}
            >
              <FolderPlus size={16} />
            </button>
            <button
              title="Thêm file"
              aria-label="Thêm file"
              disabled={!project || busy}
              onClick={() => begin('file')}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="doc-tree">{tree(null)}</div>
          {project && (
            <div className="doc-explorer-footer">
              <button
                onClick={() => {
                  setGrade(project.grade);
                  setCategory(project.category);
                  begin('rename-project');
                }}
              >
                Đổi tên / thông tin bộ đề
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    await saveFile(
                      `${project.title}.json`,
                      encoder.encode(projectBackup(project)),
                      'application/json',
                    );
                  })
                }
              >
                <Download size={14} /> Backup toàn bộ file
              </button>
              <button onClick={() => setTrash(!trash)}>
                <Trash2 size={14} /> Thùng rác ({project.nodes.filter((n) => n.deletedAt).length})
              </button>
              <button onClick={() => begin('delete-project')}>Xóa bộ đề…</button>
            </div>
          )}
        </aside>
        <main className="doc-main">
          {!loaded ? (
            <p>Đang mở Kho đề…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : !project ? (
            <div className="doc-empty">
              <BookOpen size={40} />
              <h2>Tập hợp tài liệu của anh ở một nơi</h2>
              <p>
                Tạo bộ đề rồi nhập PDF, LaTeX hoặc cả thư mục gồm hình và khai báo. App lưu bản sao;
                file gốc trên máy được giữ nguyên.
              </p>
              <button className="button primary" onClick={() => begin('project')}>
                Tạo bộ đề đầu tiên
              </button>
            </div>
          ) : (
            <>
              <div className="doc-toolbar">
                <strong>{project.title}</strong>
                <button
                  className="button small secondary"
                  disabled={busy}
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={14} /> Nhập file
                </button>
                <button
                  className="button small secondary"
                  disabled={busy}
                  onClick={() => folderRef.current?.click()}
                >
                  Nhập thư mục
                </button>
                <input
                  ref={importRef}
                  hidden
                  multiple
                  type="file"
                  onChange={(e) => {
                    const files = e.target.files;
                    void run(() => importFiles(files));
                    e.target.value = '';
                  }}
                />
                <input
                  ref={folderRef}
                  hidden
                  multiple
                  type="file"
                  {...{ webkitdirectory: '' }}
                  onChange={(e) => {
                    const files = e.target.files;
                    void run(() => importFiles(files));
                    e.target.value = '';
                  }}
                />
                <select
                  aria-label="Engine bộ đề"
                  value={project.engine}
                  disabled={busy || compiling}
                  onChange={(e) =>
                    void run(async () => {
                      await persist({ ...project, engine: e.target.value });
                    })
                  }
                >
                  <option value="xelatex">XeLaTeX</option>
                  <option value="pdflatex">pdfLaTeX</option>
                  <option value="lualatex">LuaLaTeX</option>
                </select>
                <button
                  className="button small secondary"
                  disabled={!dirty || busy}
                  onClick={() => void run(() => saveEdits(true))}
                >
                  <Save size={14} /> Lưu tất cả
                </button>
              </div>
              <div className="doc-tabs">
                {tabs.map((id) => {
                  const n = project.nodes.find((row) => row.id === id && !row.deletedAt);
                  return n ? (
                    <div key={id} className={id === selectedId && !showPdf ? 'active' : ''}>
                      <button
                        onClick={() => {
                          setSelectedId(id);
                          setShowPdf(false);
                        }}
                      >
                        {n.name}
                        {drafts[id] !== undefined ? ' •' : ''}
                      </button>
                      <button aria-label={`Đóng ${n.name}`} onClick={() => closeTab(id)}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : null;
                })}
                {result?.success && <button onClick={() => setShowPdf(true)}>PDF biên dịch</button>}
              </div>
              {selected && !showPdf && (
                <div className="doc-file-actions">
                  <span>{nodePath(project, selected)}</span>
                  <button aria-label="Đổi tên file" onClick={() => begin('rename')}>
                    <Pencil size={14} /> Đổi tên
                  </button>
                  <button onClick={() => begin('move')}>
                    <ArrowRight size={14} /> Di chuyển
                  </button>
                  <button
                    onClick={() => {
                      setName(`ban-sao-${selected.name}`);
                      setAction('duplicate');
                    }}
                  >
                    <Copy size={14} /> Nhân bản
                  </button>
                  <button onClick={() => begin('delete')}>
                    <Trash2 size={14} /> Xóa
                  </button>
                  {selected.kind === 'file' && (
                    <button
                      onClick={() =>
                        void run(async () => {
                          await saveFile(
                            selected.name,
                            selected.bytes,
                            /\.pdf$/i.test(selected.name) ? 'application/pdf' : 'application/x-tex',
                          );
                        })
                      }
                    >
                      <Download size={14} /> Xuất file
                    </button>
                  )}
                  {/\.tex$/i.test(selected.name) && (
                    <button
                      onClick={() =>
                        void run(async () => {
                          await persist({ ...project, mainId: selected.id });
                        })
                      }
                    >
                      Đặt làm file chính
                    </button>
                  )}
                </div>
              )}
              <div className="doc-editor">
                {pdfUrl ? (
                  <iframe title="PDF tài liệu" src={pdfUrl} />
                ) : selected?.kind === 'file' && editable(selected.name) ? (
                  <textarea
                    readOnly={invalidEncoding}
                    aria-label="Mã tài liệu LaTeX"
                    spellCheck={false}
                    value={text}
                    onChange={(e) =>
                      setDrafts((old) => ({ ...old, [selected.id]: e.target.value }))
                    }
                  />
                ) : selected?.kind === 'file' && /\.(png|jpe?g|webp|svg)$/i.test(selected.name) ? (
                  <Asset node={selected} />
                ) : (
                  <div className="doc-empty">
                    <FileText size={30} />
                    <p>
                      Chọn file .tex hoặc PDF ở Explorer. File ảnh được xem trực tiếp; các tài
                      nguyên khác được giữ để biên dịch.
                    </p>
                  </div>
                )}
              </div>
              {result && (
                <details className="doc-log" open={!result.success}>
                  <summary>
                    {result.success ? 'Biên dịch thành công' : 'Biên dịch chưa thành công'} · Nhật
                    ký{' '}
                    {result.success && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          void saveFile(`${project.title}.pdf`, result.pdf, 'application/pdf');
                        }}
                      >
                        Lưu PDF
                      </button>
                    )}
                  </summary>
                  <pre>{result.log}</pre>
                </details>
              )}
              <footer className="doc-status">
                {busy ? 'Đang lưu…' : dirty ? 'Có file chưa lưu' : 'Đã lưu trên thiết bị'} · File
                chính: {project.nodes.find((n) => n.id === project.mainId)?.name ?? 'Chưa chọn'}
                <span>{compileStatus || 'Ctrl+S lưu file · Ctrl+Shift+S lưu tất cả'}</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {action && (
        <Modal
          title={
            action === 'project'
              ? 'Tạo bộ đề'
              : action === 'delete-project'
                ? 'Xóa bộ đề'
                : action === 'delete'
                  ? 'Chuyển vào thùng rác'
                  : action === 'move'
                    ? 'Di chuyển file / thư mục'
                    : 'Tên và thông tin'
          }
          onClose={() => setAction('')}
        >
          <div className="modal-body">
            {action === 'delete' || action === 'delete-project' ? (
              <p>
                {action === 'delete-project'
                  ? 'Xóa toàn bộ bộ đề khỏi Kho đề. Xuất backup trước nếu cần giữ lại.'
                  : 'Đưa file và các file con vào thùng rác. Có thể khôi phục.'}
              </p>
            ) : action === 'move' ? (
              <label className="field">
                Thư mục đích
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Thư mục gốc</option>
                  {project?.nodes
                    .filter(
                      (n) =>
                        n.kind === 'folder' &&
                        !n.deletedAt &&
                        (!selected || !descendants(project, selected.id).has(n.id)),
                    )
                    .map((n) => (
                      <option value={n.id} key={n.id}>
                        {nodePath(project, n)}
                      </option>
                    ))}
                </select>
                <small>Đường dẫn trong LaTeX cần được kiểm tra sau khi di chuyển.</small>
              </label>
            ) : (
              <label className="field">
                Tên
                <input
                  aria-label="Tên mục"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={160}
                />
                {action === 'rename' && (
                  <small>App không tự sửa các lệnh input/includegraphics tham chiếu tên cũ.</small>
                )}
              </label>
            )}
            {(action === 'project' || action === 'rename-project') && (
              <div className="form-grid">
                <label className="field">
                  Lớp
                  <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                    {['10', '11', '12', '6', '7', '8', '9', 'Khác'].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Nhóm
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'review' | 'exam')}
                  >
                    <option value="review">Ôn tập</option>
                    <option value="exam">Kiểm tra / Thi</option>
                  </select>
                </label>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => setAction('')}>
              Hủy
            </button>
            <button
              className="button primary"
              disabled={
                busy || (!name.trim() && !['delete', 'delete-project', 'move'].includes(action))
              }
              onClick={() => void run(applyAction)}
            >
              Xác nhận
            </button>
          </div>
        </Modal>
      )}
      {trash && project && (
        <Modal title="Thùng rác tài liệu" onClose={() => setTrash(false)}>
          <div className="modal-body">
            {project.nodes
              .filter((n) => n.deletedAt)
              .map((n) => (
                <div className="doc-trash" key={n.id}>
                  <span>{nodePath(project, n)}</span>
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await persist(restoreNode(project, n.id));
                      })
                    }
                  >
                    <RotateCcw size={14} /> Khôi phục
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function Asset({ node }: { node: DocumentNode }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(node.bytes)], {
        type: /\.svg$/i.test(node.name)
          ? 'image/svg+xml'
          : /\.png$/i.test(node.name)
            ? 'image/png'
            : /\.webp$/i.test(node.name)
              ? 'image/webp'
              : 'image/jpeg',
      }),
    );
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [node]);
  return <img className="doc-asset" src={url} alt={node.name} />;
}
