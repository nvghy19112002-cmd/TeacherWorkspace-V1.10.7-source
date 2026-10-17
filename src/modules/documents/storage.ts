import { validateProject, type DocumentProject } from './model';
let connection: Promise<IDBDatabase> | undefined;
function db() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('teacher-workspace-document-vault', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
  });
  return connection;
}
export async function loadProjects(): Promise<DocumentProject[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('projects').objectStore('projects').getAll();
    request.onsuccess = () => {
      try {
        request.result.forEach(validateProject);
        resolve(
          request.result.sort((a: DocumentProject, b: DocumentProject) =>
            b.updatedAt.localeCompare(a.updatedAt),
          ),
        );
      } catch (e) {
        reject(e);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
export async function saveProject(project: DocumentProject): Promise<DocumentProject> {
  validateProject(project);
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    const check = store.get(project.id);
    const next = {
      ...project,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    let conflict = false;
    check.onsuccess = () => {
      if ((check.result?.revision ?? 0) !== project.revision) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(next);
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = () =>
      reject(
        new Error(
          conflict ? 'Dự án đã đổi ở cửa sổ khác. Mở lại trước khi sửa.' : 'Không lưu được Kho đề.',
        ),
      );
    tx.onerror = () => reject(tx.error);
  });
}
export async function removeProject(project: DocumentProject) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    const request = store.get(project.id);
    request.onsuccess = () => {
      if (request.result?.revision !== project.revision) {
        tx.abort();
        return;
      }
      store.delete(project.id);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error('Không xóa được dự án; dữ liệu đã thay đổi.'));
    tx.onerror = () => reject(tx.error);
  });
}
