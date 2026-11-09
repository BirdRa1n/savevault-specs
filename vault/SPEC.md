# Local vault — v1 (draft)

The **vault** is where the Desktop stores backups. It is content-addressed: each distinct file content is stored once, and snapshots refer to it by hash. That gives incremental backups and deduplication for free. Every file in the vault is immutable once written, which also makes the vault safe to keep in a synced folder or to upload to object storage (Phase 6).

- Schemas: [`vault.v1`](schema/vault.v1.schema.json), [`snapshot.v1`](schema/snapshot.v1.schema.json)
- Examples: [`examples/`](examples/)

## 1. Layout

```
<vault>/
  vault.json                              vault descriptor (vault.v1)
  blobs/sha256/<hh>/<sha256>.zst          file contents
  snapshots/<gameId>/<snapshotId>.json    snapshot documents (snapshot.v1)
  tmp/                                    in-progress writes; may be emptied at any time
  locks/writer.lock                       single-writer lock
```

- `<sha256>` is the lower-case hex SHA-256 of the **original, uncompressed** content, and `<hh>` is its first two characters.
- The `.zst` suffix means the file is one zstd frame of the original bytes.
- In `<gameId>`, the `:` of `local:<uuid>` is written as `_` on disk, giving `local_<uuid>`, because `:` is not valid in Windows file names.

The vault **MUST NOT** contain the Desktop's SQLite index. The index lives in the application data directory and can always be rebuilt by reading `snapshots/`.

## 2. Writing a snapshot

Writers **MUST** follow this order, so that a crash at any point leaves the vault valid:

1. Take `locks/writer.lock`, which records the process ID, host and start time. A lock whose process no longer exists on the same host is stale and **MAY** be taken over.
2. For each file:
   - read it while hashing;
   - if the hash is new, compress it into `tmp/`, `fsync` it and rename it into `blobs/`;
   - re-check size and mtime after reading. If they changed, re-read the file, up to 3 times. If it still changes, set `consistency: "inconsistent"`.
3. Write the snapshot JSON to `tmp/`, `fsync` it, then rename it into `snapshots/<gameId>/`.
4. Release the lock.

A crash before step 3 leaves only orphan blobs, and garbage collection removes them. A snapshot file therefore **never** references a blob that does not exist.

Snapshots are immutable. The only permitted change is to the `pinned` and `label` fields, and that change is made by writing the full document again (write to `tmp/` and rename).

## 3. Snapshot semantics

- **`path`:** a concrete file in template form. It starts with the root placeholder the profile used, has no globs, and keeps **segment** placeholders (`<storeUserId>`, …) whose source-machine values are in `bindings`. On restore, placeholders are re-resolved **on the target machine**. Store-account bindings can be remapped by the user (mechanism `store-user-scoped`).
- **`ruleId`:** links each file to the profile rule that matched it. Rules for different OSes share ids, which is how cross-platform restores relate files.
- **`parentId`:** the previous snapshot of the same game on the same machine. Two snapshots with the same parent form diverging histories (relevant for sync).
- **`kind`:**
  - `manual`;
  - `auto`, with a `trigger`;
  - `pre-restore`: taken automatically before every restore, so the restore can be undone;
  - `import`: snapshots that came from a `.gamesave`.
- **Registry values:**
  - `REG_QWORD` values are decimal strings;
  - `REG_BINARY` values are base64;
  - an empty `name` means the key's default value.

## 4. Restoring

Restoring is defined here because it consumes snapshots. Restorers **MUST**:

1. refuse while the game is running;
2. apply the user's launcher-cloud policy when the profile declares `backup.cloudSync`;
3. take a `pre-restore` snapshot of the current state;
4. resolve every `path` on the current machine and skip files whose root placeholder cannot be resolved;
5. check each target against the path-safety run-time obligations (profile/path-rules.md);
6. write the files into a staging directory on the same volume, verify each SHA-256, then move them into place with renames;
7. on any failure, leave the existing files untouched.

## 5. Retention and garbage collection

- Retention policies choose which snapshots to delete. They **MUST NOT** delete `pinned` snapshots, or the newest `pre-restore` snapshot of a game.
- Garbage collection is mark-and-sweep:
  1. take the writer lock;
  2. mark every `sha256` referenced by any snapshot;
  3. delete unmarked blobs older than 1 hour, to protect blobs from an in-flight write by a crashed writer whose lock was taken over.

## 6. Verification

A verification pass reads every blob, decompresses it and compares its hash with its file name. Blobs that do not match are reported as corrupted, together with every snapshot that references them. Corrupted blobs are never silently deleted.
