import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function releaseChannel(config) {
  const endpoints = config.plugins?.updater?.endpoints;
  if (!Array.isArray(endpoints) || endpoints.length !== 1)
    throw new Error('Configure exactly one stable GitHub updater endpoint.');
  const url = new URL(endpoints[0]);
  const match = /^\/([^/]+)\/([^/]+)\/releases\/latest\/download\/latest\.json$/.exec(url.pathname);
  if (
    url.origin !== 'https://github.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !match ||
    !/^[\w.-]+$/.test(match[1]) ||
    !/^[\w.-]+$/.test(match[2])
  )
    throw new Error(
      'Use a stable https://github.com/OWNER/REPO/releases/latest/download/latest.json endpoint.',
    );
  return { owner: match[1], name: match[2], repository: `${match[1]}/${match[2]}` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const channel = releaseChannel(JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `owner=${channel.owner}\nname=${channel.name}\nrepository=${channel.repository}\n`,
    );
  console.log(`Updater release destination: ${channel.repository}`);
}
