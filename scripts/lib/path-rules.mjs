// Reference implementation of the profile path-safety rules.
// Normative text: profile/path-rules.md. Conformance data: profile/test-vectors/path-rules.json.
// Other implementations (C++ in the Desktop, SQL in the API) MUST agree with this one on every vector.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const placeholders = JSON.parse(readFileSync(join(here, "../../profile/placeholders.json"), "utf8"));
const denylist = JSON.parse(readFileSync(join(here, "../../profile/path-denylist.json"), "utf8"));

const rootNames = new Set(placeholders.root.map((p) => p.name));
const segmentNames = new Set(placeholders.segment.map((p) => p.name));
const userScopeRoots = new Set(placeholders.root.filter((p) => p.scope === "user").map((p) => p.name));

const MAX_PATH_LENGTH = 512;
const PLACEHOLDER_RE = /<[^<>]*>/g;

const isGlob = (segment) => segment.includes("*") || segment.includes("?");
const hasPlaceholder = (segment) => /<[^<>]*>/.test(segment);

/** Converts a single-segment glob (`*`, `?`) to an anchored, case-insensitive RegExp. */
function segmentGlobToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`, "i");
}

/** Whether a path segment (literal, glob or `**`) can match the literal name `target`. */
function segmentCanMatch(segment, target) {
  if (segment === "**") return true;
  if (hasPlaceholder(segment)) return false;
  if (isGlob(segment)) return segmentGlobToRegExp(segment).test(target);
  return segment.toLowerCase() === target.toLowerCase();
}

/**
 * True when a contiguous window of `segments` can match `sequence` and at least one
 * element of the window matches literally (so `<home>/Games/**` is not flagged for `.ssh`).
 */
function matchesSequence(segments, sequence) {
  for (let start = 0; start + sequence.length <= segments.length; start++) {
    let ok = true;
    let literalHit = false;
    for (let i = 0; i < sequence.length; i++) {
      const seg = segments[start + i];
      if (!segmentCanMatch(seg, sequence[i])) { ok = false; break; }
      if (!isGlob(seg) && !hasPlaceholder(seg)) literalHit = true;
    }
    if (ok && literalHit) return true;
  }
  return false;
}

/**
 * Validates a profile save path.
 * @param {string} path
 * @returns {{ valid: boolean, violations: string[] }} violation rule IDs in check order
 */
export function validateSavePath(path) {
  const violations = [];
  const add = (rule) => { if (!violations.includes(rule)) violations.push(rule); };

  // P1 — syntax
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) {
    return { valid: false, violations: ["P1"] };
  }
  if (/[\\\u0000-\u001f]/.test(path) || path.endsWith("/") || path.includes("//") ||
      path.startsWith("~") || /%[^%]+%/.test(path) || /\$(\{|[A-Za-z_])/.test(path)) {
    add("P1");
  }

  const segments = path.split("/");
  const [first, ...rest] = segments;

  // P2 — must start with a root placeholder occupying the whole first segment
  const rootName = /^<([^<>]+)>$/.exec(first)?.[1];
  if (!rootName || !rootNames.has(rootName)) add("P2");

  // P3 — every placeholder must be known; root placeholders only as the first segment
  for (const segment of rest) {
    for (const token of segment.match(PLACEHOLDER_RE) ?? []) {
      const name = token.slice(1, -1);
      if (!segmentNames.has(name)) add("P3");
    }
    if (/[<>]/.test(segment.replace(PLACEHOLDER_RE, ""))) add("P3");
  }

  // P4 — no relative segments
  if (rest.some((s) => s === "." || s === "..")) add("P4");

  // P5 — must be anchored below the root
  if (rest.length === 0) {
    add("P5");
  } else if (rootName && userScopeRoots.has(rootName)) {
    if (isGlob(rest[0]) || hasPlaceholder(rest[0])) add("P5");
  } else if (rest.every((s) => s === "**")) {
    add("P5");
  }

  // P6 — sensitive locations
  if (denylist.sequences.some((sequence) => matchesSequence(rest, sequence))) add("P6");

  return { valid: violations.length === 0, violations };
}

/**
 * Validates a Windows registry key reference.
 * @param {string} key
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateRegistryKey(key) {
  const violations = [];
  if (typeof key !== "string" || key.length === 0 || key.length > 256 ||
      /[\\\u0000-\u001f*?]/.test(key) || key.endsWith("/") || key.includes("//")) {
    violations.push("K1");
  }
  const segments = typeof key === "string" ? key.split("/") : [];
  if (segments.length < 3 || segments[0] !== "HKCU" || segments[1].toLowerCase() !== "software") {
    violations.push("K2");
  }
  if (segments.some((s) => s === "." || s === "..")) violations.push("K3");
  return { valid: violations.length === 0, violations };
}

/** Effective operating system implied by a path's root placeholder, or null if OS-neutral. */
export function impliedOs(path) {
  const rootName = /^<([^<>]+)>/.exec(path)?.[1];
  return placeholders.root.find((p) => p.name === rootName)?.os ?? null;
}
