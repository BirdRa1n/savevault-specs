// Validates the whole repository:
//   1. every JSON Schema compiles in Ajv strict mode;
//   2. examples/<schema>/valid/* pass and examples/<schema>/invalid/* fail
//      (schema + semantic rules such as path safety);
//   3. the path-safety test vectors agree with the reference implementation.
// Exits with a non-zero status on any failure.

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

const semanticRules = {
  "profile.v1": profileErrors,
  "bundle.v1": (bundle) => (bundle.profiles ?? []).flatMap((p) => profileErrors(p).map((e) => `${p.id}: ${e}`)),
};

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

if (failures.length > 0) {
  console.error(`✗ ${failures.length} failure(s), ${passed} check(s) passed\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${passed} check(s) passed (${schemaFiles.length} schema(s))`);
