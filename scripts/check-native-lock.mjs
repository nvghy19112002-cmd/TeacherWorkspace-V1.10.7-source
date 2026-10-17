import { readFileSync } from 'node:fs';
const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const cargo = read('src-tauri/Cargo.toml');
const lock = read('src-tauri/Cargo.lock');
const pkg = JSON.parse(read('package.json'));
const npmLock = JSON.parse(read('package-lock.json'));
const packages = lock
  .split('[[package]]')
  .slice(1)
  .map((block) => ({
    name: /^name = "([^"]+)"/m.exec(block)?.[1],
    version: /^version = "([^"]+)"/m.exec(block)?.[1],
  }));
const requireVersion = (name, version) => {
  if (!packages.some((p) => p.name === name && p.version === version))
    throw new Error(
      `Cargo.lock does not contain ${name} ${version}. Use the complete source package.`,
    );
};
requireVersion('teacher-workspace', pkg.version);
for (const match of cargo.matchAll(
  /^(tauri(?:-[\w-]+)?)\s*=\s*(?:\{\s*version\s*=\s*)?"=([^"]+)"/gm,
))
  requireVersion(match[1], match[2]);
if (packages.some((p) => p.name === 'zip' && p.version?.startsWith('2.')))
  throw new Error('Unsupported zip 2 dependency found in Cargo.lock.');
const api = npmLock.packages['node_modules/@tauri-apps/api'].version;
const native = packages.find((p) => p.name === 'tauri')?.version;
if (api.split('.').slice(0, 2).join('.') !== native?.split('.').slice(0, 2).join('.'))
  throw new Error(`Tauri API ${api} does not match native ${native}.`);
console.log(`Native dependency lock verified for Teacher Workspace ${pkg.version}.`);
