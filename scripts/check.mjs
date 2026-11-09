// Validates the whole repository:
//   1. every JSON Schema compiles in Ajv strict mode;
//   2. examples/<schema>/valid/* pass and examples/<schema>/invalid/* fail
//      (schema + semantic rules such as path safety);
//   3. the path-safety test vectors agree with the reference implementation.
// Exits with a non-zero status on any failure.

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { impliedOs, validateRegistryKey, validateSavePath } from "./lib/path-rules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let passed = 0;

const ok = () => { passed++; };
const fail = (where, message) => { failures.push(`${relative(root, where)}: ${message}`); };
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Semantic rules that JSON Schema cannot express. Keyed by schema name.
// ---------------------------------------------------------------------------

function profileErrors(profile) {
  const errors = [];
  for (const rule of profile.saves ?? []) {
    for (const path of rule.paths ?? []) {
      const result = validateSavePath(path);
      if (!result.valid) errors.push(`save path "${path}" violates ${result.violations.join(", ")}`);
      const os = impliedOs(path);
      if (os && rule.when?.os && rule.when.os !== os) {
        errors.push(`save path "${path}" implies os "${os}" but rule "${rule.id}" is for "${rule.when.os}"`);
      }
    }
  }
  for (const rule of profile.registry ?? []) {
    for (const key of rule.keys ?? []) {
      const result = validateRegistryKey(key);
      if (!result.valid) errors.push(`registry key "${key}" violates ${result.violations.join(", ")}`);
    }
  }
  return errors;
}

function rootErrors(rootDoc) {
  const errors = [];
  for (const key of [...(rootDoc.rootKeys ?? []), ...(rootDoc.onlineKeys ?? [])]) {
    const raw = Buffer.from(key.publicKey, "base64");
    if (raw.length !== 32) errors.push(`key ${key.keyId}: public key is ${raw.length} bytes, expected 32`);
    const expected = createHash("sha256").update(raw).digest("hex").slice(0, 16);
    if (key.keyId !== expected) errors.push(`key ${key.keyId}: keyId does not match public key (expected ${expected})`);
  }
  if (rootDoc.rootThreshold > (rootDoc.rootKeys ?? []).length) errors.push("rootThreshold exceeds number of root keys");
  return errors;
}

function bundleErrors(bundle) {
  const errors = [];
  const seen = new Set();
  for (const p of bundle.profiles ?? []) {
    if (seen.has(p.id)) errors.push(`duplicate profile id "${p.id}"`);
    seen.add(p.id);
    errors.push(...profileErrors(p).map((e) => `${p.id}: ${e}`));
  }
  return errors;
}

function snapshotErrors(snapshot) {
  const errors = [];
  for (const file of snapshot.files ?? []) {
    // Snapshot paths are concrete, so only syntax/placeholder/traversal rules apply (not P5/P6).
    const violations = validateSavePath(file.path).violations.filter((r) => ["P1", "P2", "P3", "P4"].includes(r));
    if (violations.length > 0) errors.push(`file "${file.path}" violates ${violations.join(", ")}`);
    for (const token of file.path.match(/<[^<>]+>/g)?.slice(1) ?? []) {
      const name = token.slice(1, -1);
      if (!file.bindings?.[name]) errors.push(`file "${file.path}" has no binding for ${token}`);
    }
  }
  for (const reg of snapshot.registry ?? []) {
    const result = validateRegistryKey(reg.key);
    if (!result.valid) errors.push(`registry key "${reg.key}" violates ${result.violations.join(", ")}`);
  }
  return errors;
}

function manifestErrors(manifest) {
  const errors = [];
  const snapshotIds = new Set();
  for (const game of manifest.games ?? []) {
    const isLocal = game.gameId.startsWith("local:");
    if (isLocal && !game.localProfile) errors.push(`${game.gameId}: local games must include localProfile`);
    if (game.localProfile) errors.push(...profileErrors(game.localProfile).map((e) => `${game.gameId}: ${e}`));
    for (const snapshot of game.snapshots ?? []) {
      if (snapshot.gameId !== game.gameId) errors.push(`snapshot ${snapshot.snapshotId} belongs to "${snapshot.gameId}", not "${game.gameId}"`);
      if (snapshotIds.has(snapshot.snapshotId)) errors.push(`duplicate snapshot id ${snapshot.snapshotId}`);
      snapshotIds.add(snapshot.snapshotId);
      errors.push(...snapshotErrors(snapshot).map((e) => `${snapshot.snapshotId}: ${e}`));
    }
  }
  return errors;
}

const semanticRules = {
  "profile.v1": profileErrors,
  "root.v1": rootErrors,
  "bundle.v1": bundleErrors,
  "snapshot.v1": snapshotErrors,
  "manifest.v1": manifestErrors,
};

/** Verifies an Ed25519 signature given a raw 32-byte public key in base64. */
function verifyEd25519(publicKeyB64, message, signatureB64) {
  const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
  const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyB64, "base64")]), format: "der", type: "spki" });
  return cryptoVerify(null, message, key, Buffer.from(signatureB64, "base64"));
}

// ---------------------------------------------------------------------------
// 1. Compile schemas
// ---------------------------------------------------------------------------

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

const schemaFiles = walk(root).filter((f) => basename(dirname(f)) === "schema" && f.endsWith(".schema.json"));
for (const file of schemaFiles) ajv.addSchema(readJson(file));

const validators = new Map();
for (const file of schemaFiles) {
  const name = basename(file, ".schema.json");
  try {
    validators.set(name, { file, validate: ajv.getSchema(readJson(file).$id) });
    ok();
  } catch (error) {
    fail(file, `schema does not compile: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Examples
// ---------------------------------------------------------------------------

for (const [name, { file, validate }] of validators) {
  if (!validate) continue;
  const examplesDir = join(dirname(dirname(file)), "examples", name);
  for (const kind of ["valid", "invalid"]) {
    const dir = join(examplesDir, kind);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const exampleFile = join(dir, entry);
      const doc = readJson(exampleFile);
      const schemaOk = validate(doc);
      const semantic = schemaOk ? (semanticRules[name]?.(doc) ?? []) : [];
      const isValid = schemaOk && semantic.length === 0;
      if (kind === "valid" && !isValid) {
        const details = schemaOk ? semantic : validate.errors.map((e) => `${e.instancePath || "/"} ${e.message}`);
        fail(exampleFile, `expected valid, got:\n    ${details.join("\n    ")}`);
      } else if (kind === "invalid" && isValid) {
        fail(exampleFile, "expected invalid, but it validates");
      } else {
        ok();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Path-safety test vectors
// ---------------------------------------------------------------------------

const vectorsFile = join(root, "profile", "test-vectors", "path-rules.json");
if (existsSync(vectorsFile)) {
  const vectors = readJson(vectorsFile);
  const run = (cases, validator, label) => {
    for (const c of cases) {
      const result = validator(c.input);
      if (result.valid !== c.valid) {
        fail(vectorsFile, `${label} "${c.input}": expected valid=${c.valid}, got violations [${result.violations}]`);
      } else if (!c.valid && result.violations[0] !== c.rule) {
        fail(vectorsFile, `${label} "${c.input}": expected first violation ${c.rule}, got [${result.violations}]`);
      } else {
        ok();
      }
    }
  };
  run(vectors.savePaths, validateSavePath, "save path");
  run(vectors.registryKeys, validateRegistryKey, "registry key");
}

// ---------------------------------------------------------------------------
// 4. Registry signing vectors and the signed root example
// ---------------------------------------------------------------------------

const signingFile = join(root, "registry", "test-vectors", "signing.json");
if (existsSync(signingFile)) {
  const signing = readJson(signingFile);
  const keys = new Map(signing.keys.map((k) => [k.keyId, k.publicKey]));
  for (const c of signing.cases) {
    const valid = verifyEd25519(keys.get(c.keyId), Buffer.from(c.message, "base64"), c.signature);
    if (valid !== c.valid) fail(signingFile, `"${c.description}": expected valid=${c.valid}, got ${valid}`);
    else ok();
  }

  // The signed example must verify over the exact bytes of root.json.
  const rootFile = join(root, "registry", "examples", "root.v1", "valid", "root.json");
  const sigFile = join(root, "registry", "examples", "signature.v1", "valid", "root.json.sig.json");
  const rootBytes = readFileSync(rootFile);
  const rootKeys = new Map(JSON.parse(rootBytes).rootKeys.map((k) => [k.keyId, k.publicKey]));
  for (const s of readJson(sigFile).signatures) {
    if (!rootKeys.has(s.keyId) || !verifyEd25519(rootKeys.get(s.keyId), rootBytes, s.signature)) {
      fail(sigFile, `signature by ${s.keyId} does not verify over root.json (line endings changed?)`);
    } else {
      ok();
    }
  }
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`✗ ${failures.length} failure(s), ${passed} check(s) passed\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${passed} check(s) passed (${schemaFiles.length} schema(s))`);
