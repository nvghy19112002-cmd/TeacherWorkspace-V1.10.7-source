import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign, randomBytes } from 'node:crypto';
import { releaseChannel } from '../scripts/release-channel.mjs';
import { verifyUpdaterArtifact } from '../scripts/verify-updater-artifact.mjs';

const endpoint =
  'https://github.com/nvghy19112002-cmd/TeacherWorkspace-V1.10.7-source/releases/latest/download/latest.json';
const config = (url) => ({ plugins: { updater: { endpoints: [url] } } });
test('release destination follows the configured source repository', () => {
  assert.deepEqual(releaseChannel(config(endpoint)), {
    owner: 'nvghy19112002-cmd',
    name: 'TeacherWorkspace-V1.10.7-source',
    repository: 'nvghy19112002-cmd/TeacherWorkspace-V1.10.7-source',
  });
});
for (const url of [
  endpoint.replace('https:', 'http:'),
  endpoint + '?token=hidden',
  endpoint + '#fragment',
  endpoint.replace('github.com', 'github.com.evil.example'),
  endpoint.replace('github.com', 'user:pass@github.com'),
  endpoint.replace('/latest/', '/tags/v1/'),
]) {
  test(`rejects an invalid release endpoint (${new URL(url).hostname}, ${new URL(url).protocol}, ${new URL(url).pathname})`, () => {
    assert.throws(() => releaseChannel(config(url)));
  });
}
test('rejects ambiguous release channels', () => {
  assert.throws(() =>
    releaseChannel({ plugins: { updater: { endpoints: [endpoint, endpoint] } } }),
  );
});

function fixture(algorithm = 'ED') {
  const pair = generateKeyPairSync('ed25519');
  const id = randomBytes(8);
  const rawKey = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const publicKey = Buffer.from(
    `untrusted comment: test key\n${Buffer.concat([Buffer.from('Ed'), id, rawKey]).toString('base64')}\n`,
  ).toString('base64');
  const artifact = Buffer.from('installer test payload');
  const payload =
    algorithm === 'ED' ? createHash('blake2b512').update(artifact).digest() : artifact;
  const signature = sign(null, payload, pair.privateKey);
  const comment = 'timestamp:1234567890';
  const global = sign(null, Buffer.concat([signature, Buffer.from(comment)]), pair.privateKey);
  const packet = Buffer.concat([Buffer.from(algorithm), id, signature]);
  const encoded = Buffer.from(
    `untrusted comment: test signature\n${packet.toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`,
  ).toString('base64');
  return { artifact, signature: encoded, publicKey };
}
for (const algorithm of ['Ed', 'ED']) {
  test(`verifies ${algorithm} signed installer bytes`, () => {
    const f = fixture(algorithm);
    verifyUpdaterArtifact(f.artifact, f.signature, f.publicKey);
  });
}
test('rejects tampered installer bytes', () => {
  const f = fixture();
  assert.throws(
    () => verifyUpdaterArtifact(Buffer.from('tampered'), f.signature, f.publicKey),
    /signature verification failed/,
  );
});
test('rejects a different signing key', () => {
  const f = fixture();
  assert.throws(
    () => verifyUpdaterArtifact(f.artifact, f.signature, fixture().publicKey),
    /different signing key/,
  );
});
test('rejects tampered trusted comment', () => {
  const f = fixture();
  const changed = Buffer.from(
    Buffer.from(f.signature, 'base64')
      .toString()
      .replace('timestamp:1234567890', 'timestamp:0000000000'),
  ).toString('base64');
  assert.throws(
    () => verifyUpdaterArtifact(f.artifact, changed, f.publicKey),
    /trusted comment verification failed/,
  );
});
test('rejects malformed signatures', () => {
  const f = fixture();
  assert.throws(() => verifyUpdaterArtifact(f.artifact, 'invalid', f.publicKey), /Malformed/);
});
