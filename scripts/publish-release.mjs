import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  const installers = release.assets.filter((a) => a.name.endsWith('.exe') && a.size > 0);
  if (installers.length !== 1)
    throw new Error('Expected exactly one NSIS installer. Release remains draft.');
  const installer = installers[0];
  const name = installer.name;
  const signature = release.assets.find((a) => a.name === `${name}.sig` && a.size > 0);
  if (!signature) throw new Error('Missing NSIS installer signature. Release remains draft.');
  const signatureText = download(signature).toString('utf8').trim();
  const canonicalUrl = `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;
  const manifestAsset = release.assets.find((a) => a.name === 'latest.json' && a.size > 0);
  const manifest = manifestAsset
    ? JSON.parse(download(manifestAsset).toString('utf8'))
    : {
        version,
        notes: release.body || `Teacher Workspace ${version}`,
        pub_date: new Date(release.created_at).toISOString(),
        platforms: {},
      };
  const target = manifest.platforms?.['windows-x86_64'];
  if (
    manifest.version !== version ||
    (target && (!target.signature || target.signature.trim() !== signatureText))
  )
    throw new Error('Invalid version or Windows x64 signature in manifest.');
  manifest.platforms['windows-x86_64'] = { signature: signatureText, url: canonicalUrl };
  if (!manifestAsset || target?.url !== canonicalUrl) {
    const dir = mkdtempSync(join(tmpdir(), 'teacher-manifest-'));
    const path = join(dir, 'latest.json');
    try {
      writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
      if (manifestAsset)
        gh(
          'api',
          '--method',
          'PATCH',
          `repos/${repo}/releases/assets/${manifestAsset.id}`,
          '-f',
          'name=latest.previous.json',
        );
      gh(
        'api',
        '--method',
        'POST',
        `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=latest.json`,
        '-H',
        'Content-Type: application/json',
        '--input',
        path,
      );
      if (manifestAsset)
        gh('api', '--method', 'DELETE', `repos/${repo}/releases/assets/${manifestAsset.id}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const finalTarget = manifest.platforms['windows-x86_64'];
  if (!Buffer.from(finalTarget.signature, 'base64').toString().startsWith('untrusted comment:'))
    throw new Error('Invalid signature encoding.');
  verifyUpdaterArtifact(
    download(installer),
    finalTarget.signature,
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
