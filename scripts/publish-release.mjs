import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { releaseChannel } from './release-channel.mjs';
import { verifyUpdaterArtifact } from './verify-updater-artifact.mjs';

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const { repository: repo } = releaseChannel(config);
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;
const gh = (...args) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const release = JSON.parse(gh('api', `repos/${repo}/releases/tags/${tag}`));
if (!release.draft || release.prerelease)
  throw new Error('Expected an unpublished stable release.');
const dir = mkdtempSync(join(tmpdir(), 'teacher-release-'));
try {
  const manifestAsset = release.assets.find((a) => a.name === 'latest.json' && a.size > 0);
  if (!manifestAsset) throw new Error('Missing updater manifest. Release remains draft.');
  gh('release', 'download', tag, '--repo', repo, '--pattern', 'latest.json', '--dir', dir);
  const manifest = JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8'));
  const target = manifest.platforms?.['windows-x86_64'];
  if (manifest.version !== version || !target?.signature || !target.url)
    throw new Error('Invalid version or Windows x64 platform in manifest.');
  const url = new URL(target.url);
  if (
    url.origin !== 'https://github.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith(`/${repo}/releases/download/${tag}/`)
  )
    throw new Error('Updater URL points to the wrong release.');
  const name = decodeURIComponent(url.pathname.split('/').at(-1));
  const installer = release.assets.find((a) => a.name === name && a.size > 0);
  const signature = release.assets.find((a) => a.name === `${name}.sig` && a.size > 0);
  if (!name.endsWith('.exe') || !installer || !signature)
    throw new Error('Missing NSIS installer/signature. Release remains draft.');
  gh('release', 'download', tag, '--repo', repo, '--pattern', signature.name, '--dir', dir);
  if (readFileSync(join(dir, signature.name), 'utf8').trim() !== target.signature.trim())
    throw new Error('Uploaded signature differs from manifest.');
  if (!Buffer.from(target.signature, 'base64').toString().startsWith('untrusted comment:'))
    throw new Error('Invalid signature encoding.');
  gh('release', 'download', tag, '--repo', repo, '--pattern', name, '--dir', dir);
  verifyUpdaterArtifact(
    readFileSync(join(dir, name)),
    target.signature,
    config.plugins.updater.pubkey,
  );
  // Publishing is the final mutation, after every required asset is present.
  gh('release', 'edit', tag, '--repo', repo, '--draft=false', '--latest');
  console.log(`Published ${tag}; the app can now discover this update.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
