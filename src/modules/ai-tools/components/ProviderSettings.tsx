import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { isDesktop } from '../../../database/driver';
import { useWorkspace, errorText } from '../../../app/store';
import { useToasts } from '../../../components/feedback';
import { deleteKey, readKey, storeKey } from '../services/credentials';
import './providerSettings.css';
import { testGeminiModel } from '../services/aiProvider';
import { geminiProvider } from '../services/aiProvider';
import { saveAiState } from '../services/state';
import { AiRequestError } from '../services/requestManager';
import { saveModuleSetting } from '../../../services/moduleSettings';
import {
  readModelChecks,
  structuredTextModelReason,
  verifiedModel,
} from '../domain/modelCapabilities';
import { modelNameSchema } from '../domain/model';
import { readKeyPool, saveKeyPool, type KeyMeta, type KeyPool } from '../domain/keyPool';

const STATUS: Record<KeyMeta['status'], string> = {
  unchecked: 'Chưa kiểm tra',
  active: 'Key hợp lệ',
  auth_error: 'Lỗi xác thực',
  quota: 'Hết hạn mức',
  network_error: 'Lỗi mạng',
};

function statusFromError(error: unknown): KeyMeta['status'] {
  const text = errorText(error).toLocaleLowerCase('vi');
  if (text.includes('hạn mức') || text.includes('quá nhiều')) return 'quota';
  if (text.includes('không hợp lệ') || text.includes('không có quyền')) return 'auth_error';
  return 'network_error';
}

export function ProviderSettings({
  model,
  compact = false,
  view = 'all',
}: {
  model: string;
  compact?: boolean;
  view?: 'all' | 'keys' | 'models';
}) {
  const checksRaw = useWorkspace((s) => s.data.settings.moduleState?.aiModelChecks);
  const raw = useWorkspace((state) => state.data.settings.moduleState?.aiKeyPool);
  const pool = useMemo(() => readKeyPool(raw), [raw]);
  const [draft, setDraft] = useState('');
  const [label, setLabel] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [name, setName] = useState(model);
  const [models, setModels] = useState<string[]>([]);
  const [bulk, setBulk] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [diagnosticDetails, setDiagnosticDetails] = useState('');
  const [busyModel, setBusyModel] = useState(false);
  const [catalogKey, setCatalogKey] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const toast = useToasts((state) => state.push);
  const modelIncompatibility = name.trim() ? structuredTextModelReason(name.trim()) : null;

  useEffect(() => {
    let active = true;
    if (pool.keys.length) return () => undefined;
    void readKey('default').then(async (legacy) => {
      if (!active || !legacy) return;
      const meta: KeyMeta = {
        id: 'default',
        label: 'Key V1.3',
        masked: `••••${legacy.slice(-4)}`,
        priority: 0,
        enabled: true,
        status: 'unchecked',
        lastCheckedAt: null,
      };
      await saveKeyPool(() => ({
        version: 1,
        automatic: false,
        activeId: 'default',
        keys: [meta],
      }));
    });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [pool.keys.length]);

  useEffect(() => () => controller.current?.abort(), []);

  async function update(recipe: (current: KeyPool) => KeyPool) {
    try {
      await saveKeyPool(recipe);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  }

  async function add() {
    const clean = draft.trim();
    if (!clean) return;
    setBusyId('new');
    let storedId = '';
    let committed = false;
    try {
      if (pool.keys.length >= 100) throw new Error('Tối đa 100 key.');
      const existing = await Promise.all(pool.keys.map((k) => readKey(k.id)));
      if (existing.includes(clean)) throw new Error('Key này đã có trong danh sách.');
      const id = crypto.randomUUID();
      await storeKey(clean, id);
      storedId = id;
      const meta: KeyMeta = {
        id,
        label: label.trim() || `Gemini #${pool.keys.length + 1}`,
        masked: `••••${clean.slice(-4)}`,
        priority: pool.keys.length,
        enabled: true,
        status: 'unchecked',
        lastCheckedAt: null,
      };
      await saveKeyPool((current) => ({
        ...current,
        activeId: current.activeId ?? id,
        keys: [...current.keys, meta],
      }));
      committed = true;
      setDraft('');
      setLabel('');
      toast('Đã lưu API key an toàn.');
    } catch (error) {
      if (storedId && !committed) await deleteKey(storedId).catch(() => undefined);
      toast(errorText(error), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function addBulk() {
    const values = [
      ...new Set(
        bulk
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (!values.length) return;
    if (values.some((k) => k.length < 10 || k.length > 300 || /\s/.test(k))) {
      setDiagnostic('Có key không hợp lệ. Mỗi dòng chỉ chứa một API key.');
      return;
    }
    setBusyId('bulk');
    setDiagnostic('');
    const stored: string[] = [];
    let committed = false;
    try {
      const existing = new Set(await Promise.all(pool.keys.map((k) => readKey(k.id))));
      const fresh = values.filter((k) => !existing.has(k));
      if (pool.keys.length + fresh.length > 100) throw new Error('Tối đa 100 key.');
      const metas: KeyMeta[] = [];
      for (const key of fresh) {
        const id = crypto.randomUUID();
        await storeKey(key, id);
        stored.push(id);
        metas.push({
          id,
          label: `Gemini #${pool.keys.length + metas.length + 1}`,
          masked: `••••${key.slice(-4)}`,
          priority: pool.keys.length + metas.length,
          enabled: true,
          status: 'unchecked',
          lastCheckedAt: null,
        });
      }
      await saveKeyPool((current) => ({
        ...current,
        activeId: current.activeId ?? metas[0]?.id ?? null,
        keys: [...current.keys, ...metas],
      }));
      committed = true;
      setBulk('');
      setDiagnostic(
        `Đã thêm ${metas.length} key; bỏ qua ${values.length - metas.length} key trùng.`,
      );
    } catch (error) {
      if (!committed) await Promise.all(stored.map((id) => deleteKey(id).catch(() => undefined)));
      setDiagnostic(errorText(error));
      setDiagnosticDetails(error instanceof AiRequestError ? error.diagnostic : '');
    } finally {
      setBusyId(null);
    }
  }

  async function loadModels() {
    const meta =
      pool.keys.find((k) => k.id === pool.activeId && k.enabled) ??
      pool.keys.find((k) => k.enabled);
    if (!meta) {
      setDiagnostic('Chưa có key đang bật.');
      return;
    }
    await test(meta);
  }

  async function probeModel() {
    const meta =
      pool.keys.find((k) => k.id === pool.activeId && k.enabled) ??
      pool.keys.find((k) => k.enabled);
    if (!meta) {
      setDiagnostic('Chưa có key đang bật.');
      return;
    }
    setBusyModel(true);
    setDiagnostic('Đang thử model với một yêu cầu JSON ngắn…');
    setDiagnosticDetails('');
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      await saveModuleSetting(
        'aiModelChecks',
        JSON.stringify(
          [
            ...readModelChecks(
              useWorkspace.getState().data.settings.moduleState?.aiModelChecks,
            ).filter((c) => !(c.model === name.trim() && c.keyId === meta.id)),
            {
              model: name.trim(),
              keyId: meta.id,
              checkedAt: new Date().toISOString(),
              structuredOutput: false,
            },
          ].slice(-100),
        ),
      );
      await testGeminiModel(name.trim(), await readKey(meta.id), controller.current.signal);
      const current = useWorkspace.getState().data.settings.moduleState?.aiModelChecks;
      await saveModuleSetting(
        'aiModelChecks',
        JSON.stringify(
          [
            ...readModelChecks(current).filter(
              (c) => !(c.model === name.trim() && c.keyId === meta.id),
            ),
            {
              model: name.trim(),
              keyId: meta.id,
              checkedAt: new Date().toISOString(),
              structuredOutput: true,
            },
          ].slice(-100),
        ),
      );
      setDiagnostic(`${name.trim()}: gọi thành công và nhận được JSON hợp lệ.`);
    } catch (error) {
      setDiagnostic(errorText(error));
      setDiagnosticDetails(error instanceof AiRequestError ? error.diagnostic : '');
    } finally {
      setBusyModel(false);
    }
  }

  async function remove(meta: KeyMeta) {
    if (!window.confirm(`Xóa ${meta.label}? API key sẽ bị xóa khỏi kho khóa an toàn.`)) return;
    setBusyId(meta.id);
    try {
      await deleteKey(meta.id);
      await saveKeyPool((current) => {
        const keys = current.keys
          .filter((item) => item.id !== meta.id)
          .map((item, index) => ({ ...item, priority: index }));
        return {
          ...current,
          keys,
          activeId: current.activeId === meta.id ? (keys[0]?.id ?? null) : current.activeId,
        };
      });
      setRevealed((value) => {
        const next = { ...value };
        delete next[meta.id];
        return next;
      });
      toast('Đã xóa API key.');
    } catch (error) {
      toast(errorText(error), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function test(meta: KeyMeta) {
    setBusyId(meta.id);
    controller.current = new AbortController();
    try {
      const list = await geminiProvider.testConnection(
        await readKey(meta.id),
        controller.current.signal,
      );
      setModels(list);
      setCatalogKey(meta.id);
      setDiagnostic(
        `Đã tải ${list.length} model cho ${meta.label}. Đây là kiểm tra danh sách; dùng Thử model để kiểm tra gọi JSON.`,
      );
      await saveKeyPool((current) => ({
        ...current,
        keys: current.keys.map((item) =>
          item.id === meta.id
            ? { ...item, status: 'active', lastCheckedAt: new Date().toISOString() }
            : item,
        ),
      }));
      toast(`${meta.label}: kết nối thành công, ${list.length} model.`);
    } catch (error) {
      await saveKeyPool((current) => ({
        ...current,
        keys: current.keys.map((item) =>
          item.id === meta.id
            ? { ...item, status: statusFromError(error), lastCheckedAt: new Date().toISOString() }
            : item,
        ),
      }));
      setDiagnostic(errorText(error));
      setDiagnosticDetails(error instanceof AiRequestError ? error.diagnostic : '');
      toast(errorText(error), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pool.keys.length) return;
    await update((current) => {
      const keys = [...current.keys];
      [keys[index], keys[target]] = [keys[target], keys[index]];
      return { ...current, keys: keys.map((item, priority) => ({ ...item, priority })) };
    });
  }

  return (
    <section className={`ai-settings key-pool ${compact ? 'compact' : ''}`}>
      <h2>{view === 'models' ? 'Model và structured output' : 'Gemini API key'}</h2>
      <p>
        {isDesktop
          ? 'Key được lưu trong Windows Credential Manager và không nằm trong backup.'
          : 'Bản trình duyệt chỉ giữ key trong phiên hiện tại.'}
      </p>
      {view !== 'models' && (
        <>
          <div className="key-add-row">
            <input
              type="text"
              value={label}
              maxLength={100}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Nhãn, ví dụ: Key chính"
            />
            <input
              type="password"
              value={draft}
              maxLength={300}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập Gemini API key"
            />
            <button
              className="button primary"
              disabled={!draft.trim() || busyId !== null}
              onClick={() => void add()}
            >
              <Plus size={16} /> Thêm key
            </button>
          </div>
          <details className="key-bulk">
            <summary>Nhập nhiều API key</summary>
            <label htmlFor="bulk-api-keys">Mỗi dòng một key</label>
            <textarea
              id="bulk-api-keys"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={4}
              autoComplete="off"
              spellCheck={false}
              placeholder="Dán các API key tại đây"
            />
            <button
              className="button secondary"
              disabled={!bulk.trim() || busyId !== null}
              onClick={() => void addBulk()}
            >
              Thêm danh sách key
            </button>
          </details>
          <div className="key-list">
            {pool.keys.length === 0 && <div className="qb-empty-inline">Chưa có API key.</div>}
            {pool.keys.map((meta, index) => (
              <div className="key-row" key={meta.id}>
                <input
                  type="radio"
                  name="active-api-key"
                  checked={pool.activeId === meta.id}
                  onChange={() => void update((current) => ({ ...current, activeId: meta.id }))}
                  aria-label={`Dùng ${meta.label}`}
                />
                <input
                  type="checkbox"
                  aria-label={`Bật ${meta.label}`}
                  checked={meta.enabled}
                  onChange={(e) =>
                    void update((current) => ({
                      ...current,
                      keys: current.keys.map((k) =>
                        k.id === meta.id ? { ...k, enabled: e.target.checked } : k,
                      ),
                    }))
                  }
                />
                <span className="key-number">#{index + 1}</span>
                <input
                  value={meta.label}
                  maxLength={100}
                  onChange={(event) => {
                    const value = event.target.value;
                    void update((current) => ({
                      ...current,
                      keys: current.keys.map((item) =>
                        item.id === meta.id ? { ...item, label: value || meta.label } : item,
                      ),
                    }));
                  }}
                />
                <code>{revealed[meta.id] || meta.masked}</code>
                <span className={`key-status ${meta.status}`}>{STATUS[meta.status]}</span>
                <button
                  className="icon-button"
                  title={revealed[meta.id] ? 'Ẩn key' : 'Hiện key'}
                  onClick={() =>
                    void (async () => {
                      if (revealed[meta.id]) {
                        setRevealed((value) => ({ ...value, [meta.id]: '' }));
                      } else {
                        const value = await readKey(meta.id);
                        setRevealed((current) => ({ ...current, [meta.id]: value }));
                      }
                    })()
                  }
                >
                  {revealed[meta.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  className="icon-button"
                  title="Đưa lên"
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  title="Đưa xuống"
                  disabled={index === pool.keys.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-button"
                  title="Kiểm tra"
                  disabled={busyId !== null}
                  onClick={() => void test(meta)}
                >
                  <RefreshCw className={busyId === meta.id ? 'spin' : ''} size={16} />
                </button>
                <button
                  className="icon-button danger-text"
                  title="Xóa key"
                  disabled={busyId !== null}
                  onClick={() => void remove(meta)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <p className="muted">
            Khi provider giới hạn tần suất hoặc hết quota, hệ thống chờ hoặc dừng lô và giữ tiến
            trình. Không tự đổi key để né hạn mức.
          </p>
          <label className="key-rotation">
            Cách dùng key
            <select
              aria-label="Cách dùng key"
              value={pool.rotation ?? 'priority'}
              onChange={(e) =>
                void update((current) => ({
                  ...current,
                  rotation: e.target.value as 'priority' | 'round_robin',
                }))
              }
            >
              <option value="priority">Ưu tiên key đang chọn</option>
              <option value="round_robin">Luân phiên mỗi yêu cầu</option>
            </select>
          </label>
        </>
      )}
      {view !== 'keys' && (
        <>
          <div className="key-model-row">
            <label>
              Model dùng chung
              <select
                aria-label="Model dùng chung"
                value={name}
                onChange={(e) => setName(e.target.value)}
              >
                <option value="">Chọn model từ API</option>
                {name && !models.includes(name) && (
                  <option value={name}>{name} · chưa đối chiếu danh sách</option>
                )}
                {models.map((item) => (
                  <option key={item} value={item}>
                    {item} ·{' '}
                    {verifiedModel(checksRaw, item, pool.activeId ?? '')
                      ? 'đã thử JSON'
                      : 'chưa thử structured output'}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button secondary"
              disabled={busyId !== null || busyModel}
              onClick={() => void loadModels()}
            >
              <RefreshCw size={15} /> Tải model
            </button>
            <button
              className="button secondary"
              disabled={
                !name.trim() || Boolean(modelIncompatibility) || busyModel || busyId !== null
              }
              onClick={() => void probeModel()}
            >
              Thử model
            </button>
            <button
              className="button primary"
              disabled={!name.trim() || Boolean(modelIncompatibility)}
              onClick={() =>
                void (async () => {
                  try {
                    const value = modelNameSchema.parse(name);
                    await saveAiState((state) => ({ ...state, model: value }));
                    toast('Đã lưu model.');
                  } catch (error) {
                    setDiagnostic(errorText(error));
                    setDiagnosticDetails(error instanceof AiRequestError ? error.diagnostic : '');
                  }
                })()
              }
            >
              Lưu model
            </button>
          </div>
          {modelIncompatibility && (
            <p className="ai-error" role="alert">
              {modelIncompatibility} Hãy tải danh sách và chọn model văn bản.
            </p>
          )}
          {catalogKey && catalogKey !== pool.activeId && (
            <p className="ai-error">Danh sách thuộc key khác. Tải lại model cho key đang chọn.</p>
          )}
          <details className="key-manual">
            <summary>Nhập mã model thủ công</summary>
            <input
              aria-label="Mã model thủ công"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </details>
        </>
      )}
      {diagnosticDetails && (
        <details>
          <summary>Diagnostics</summary>
          <pre className="key-diagnostic-details">{diagnosticDetails}</pre>
        </details>
      )}
      {diagnostic && (
        <p className="key-diagnostic" role="status">
          {diagnostic}
        </p>
      )}
      <small>
        Thử model gửi một yêu cầu JSON ngắn, có thể tính phí API. Danh sách model được lấy trực tiếp
        từ Google, không giới hạn số phiên bản.
      </small>
      <small>
        Chỉ gửi nội dung khi anh xác nhận chạy AI. Yêu cầu có thể phát sinh phí theo tài khoản API.
      </small>
    </section>
  );
}
