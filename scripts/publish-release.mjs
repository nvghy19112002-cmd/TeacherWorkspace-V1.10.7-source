import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { releaseChannel } from './release-channel.mjs';
import { verifyUpdaterArtifact } from './verify-updater-artifact.mjs';

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const { repository: repo } = releaseChannel(config);
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;
const gh = (...args) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const releases = JSON.parse(gh('api', `repos/${repo}/releases?per_page=100`));
const release = releases.find((candidate) => candidate.tag_name === tag);
if (!release) throw new Error(`No release draft found for ${tag}.`);
if (!release.draft || release.prerelease)
  throw new Error('Expected an unpublished stable release.');
const download = (asset) =>
  execFileSync(
    'gh',
    ['api', `repos/${repo}/releases/assets/${asset.id}`, '-H', 'Accept: application/octet-stream'],
    { encoding: null, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
  );

{
  const manifestAsset = release.assets.find((a) => a.name === 'latest.json' && a.size > 0);
  if (!manifestAsset) throw new Error('Missing updater manifest. Release remains draft.');
  const manifest = JSON.parse(download(manifestAsset).toString('utf8'));
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
  const signatureText = download(signature).toString('utf8');
  if (signatureText.trim() !== target.signature.trim())
    throw new Error('Uploaded signature differs from manifest.');
  if (!Buffer.from(target.signature, 'base64').toString().startsWith('untrusted comment:'))
    throw new Error('Invalid signature encoding.');
  gh('release', 'download', tag, '--repo', repo, '--pattern', name, '--dir', dir);
  verifyUpdaterArtifact(
    download(installer),
    target.signature,
    config.plugins.updater.pubkey,
  );
  // Publishing is the final mutation, after every required asset is present.
  gh(
    'api',
    '--method',
    'PATCH',
    `repos/${repo}/releases/${release.id}`,
    '-F',
    'draft=false',
    '-f',
    'make_latest=true',
  );
  console.log(`Published ${tag}; the app can now discover this update.`);
}
