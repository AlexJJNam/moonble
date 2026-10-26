import { generateKeyPairSync } from 'node:crypto';

const keyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = keyPair.publicKey.export({ format: 'jwk' });
const privateJwk = keyPair.privateKey.export({ format: 'jwk' });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(publicJwk.x, 'base64url'),
  Buffer.from(publicJwk.y, 'base64url'),
]).toString('base64url');

console.log(JSON.stringify({ publicKey, privateKey: privateJwk.d }, null, 2));
