import { createHash, createPublicKey, verify } from 'node:crypto';

// Tauri uses the minisign packet format: algorithm (2), key ID (8), Ed25519 key/signature.
export function verifyUpdaterArtifact(artifact, signature, publicKey) {
  const keyLines = Buffer.from(publicKey.trim(), 'base64').toString('utf8').trim().split(/\r?\n/);
  const lines = Buffer.from(signature.trim(), 'base64').toString('utf8').trim().split(/\r?\n/);
  const key = Buffer.from(keyLines[1] || '', 'base64');
  const packet = Buffer.from(lines[1] || '', 'base64');
  if (
    key.length !== 42 ||
    packet.length !== 74 ||
    lines.length !== 4 ||
    !lines[2].startsWith('trusted comment: ')
  )
    throw new Error('Malformed updater key or signature. Release remains draft.');
  if (!key.subarray(2, 10).equals(packet.subarray(2, 10)))
    throw new Error('Updater signature uses a different signing key. Release remains draft.');
  const algorithm = packet.subarray(0, 2).toString('ascii');
  if (!['Ed', 'ED'].includes(algorithm))
    throw new Error('Unsupported updater signature algorithm.');
  const ed25519 = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]),
    format: 'der',
    type: 'spki',
  });
  const payload =
    algorithm === 'ED' ? createHash('blake2b512').update(artifact).digest() : artifact;
  if (!verify(null, payload, ed25519, packet.subarray(10)))
    throw new Error('Installer signature verification failed. Release remains draft.');
  const trusted = Buffer.from(lines[2].slice('trusted comment: '.length));
  if (
    !verify(
      null,
      Buffer.concat([packet.subarray(10), trusted]),
      ed25519,
      Buffer.from(lines[3], 'base64'),
    )
  )
    throw new Error('Signature trusted comment verification failed. Release remains draft.');
}
