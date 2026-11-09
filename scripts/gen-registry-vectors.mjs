// Generates the registry signing test vectors and the signed examples from
// fixed, publicly known TEST seeds. Ed25519 is deterministic, so running this
// script again produces byte-identical output.
//
//   node scripts/gen-registry-vectors.mjs
//
// THE KEYS BELOW ARE FOR TESTS ONLY. Their private seeds are public; nothing
// signed by them may ever be trusted by a real client.

import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// PKCS#8 DER prefix for an Ed25519 private key; the 32-byte seed follows.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function testKey(label) {
  const seed = createHash("sha256").update(`saveforge-test-key:${label}`).digest();
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" });
  const rawPublic = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32);
  return {
    seed,
    privateKey,
    publicKey: rawPublic.toString("base64"),
    keyId: createHash("sha256").update(rawPublic).digest("hex").slice(0, 16),
  };
}

const signBytes = (key, bytes) => sign(null, bytes, key.privateKey).toString("base64");
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
const write = (rel, bytes) => {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
};

const rootKey = testKey("root-1");
const onlineKey = testKey("online-1");
const otherKey = testKey("unrelated");
const pub = (k) => ({ keyId: k.keyId, algorithm: "ed25519", publicKey: k.publicKey });

// --- Signed examples ---------------------------------------------------------

const rootDoc = {
  schemaVersion: 1,
  type: "root",
  version: 1,
  expires: "2028-01-01T00:00:00Z",
  rootThreshold: 1,
  rootKeys: [pub(rootKey)],
  onlineKeys: [{ ...pub(onlineKey), channels: ["*"] }],
};
const rootBytes = json(rootDoc);
write("registry/examples/root.v1/valid/root.json", rootBytes);
write("registry/examples/signature.v1/valid/root.json.sig.json",
  json({ signatures: [{ keyId: rootKey.keyId, signature: signBytes(rootKey, rootBytes) }] }));

// --- Language-neutral vectors -------------------------------------------------

const message = Buffer.from('{"schemaVersion":1,"type":"index","channel":"official","sequence":1}\n', "utf8");
const goodSignature = signBytes(onlineKey, message);
const tampered = Buffer.from(message);
tampered[tampered.length - 3] ^= 0x01;

const vectors = {
  $comment: "Ed25519 verification vectors for registry/SPEC.md. Seeds are PUBLIC TEST VALUES; never trust these keys. Regenerate with scripts/gen-registry-vectors.mjs.",
  version: 1,
  keys: [rootKey, onlineKey, otherKey].map((k, i) => ({
    label: ["root-1", "online-1", "unrelated"][i],
    seed: k.seed.toString("hex"),
    keyId: k.keyId,
    publicKey: k.publicKey,
  })),
  cases: [
    { description: "valid signature", keyId: onlineKey.keyId, message: message.toString("base64"), signature: goodSignature, valid: true },
    { description: "message modified by one bit", keyId: onlineKey.keyId, message: tampered.toString("base64"), signature: goodSignature, valid: false },
    { description: "signature from a different key", keyId: onlineKey.keyId, message: message.toString("base64"), signature: signBytes(otherKey, message), valid: false },
    { description: "root.json example signed by root-1", keyId: rootKey.keyId, message: rootBytes.toString("base64"), signature: signBytes(rootKey, rootBytes), valid: true },
  ],
};
write("registry/test-vectors/signing.json", json(vectors));

console.log(`root key ${rootKey.keyId}, online key ${onlineKey.keyId}`);
