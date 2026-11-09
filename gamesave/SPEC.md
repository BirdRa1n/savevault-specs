# `.gamesave` export format — v1 (draft)

A `.gamesave` file carries snapshots of one or more games between machines. It is a ZIP archive, so anyone can open and inspect it with standard tools. Its manifest embeds the same snapshot documents the vault stores, so exporting and importing need no conversion.

- Schema: [`manifest.v1`](schema/manifest.v1.schema.json) (embeds [`vault/snapshot.v1`](../vault/schema/snapshot.v1.schema.json))
- Examples: [`examples/manifest.v1/`](examples/manifest.v1/)

## 1. Container

A `.gamesave` file is a ZIP archive (APPNOTE 6.3.x, ZIP64 allowed) with these entries:

| Entry | Compression | Content |
|---|---|---|
| `mimetype` | **stored** | Exactly `application/vnd.saveforge.gamesave+zip`, without a trailing newline. It **MUST** be the first entry. |
| `manifest.json` | deflate | UTF-8 JSON valid against `manifest.v1`. |
| `manifest.json.sha256` | stored or deflate | 64 lower-case hex characters, the SHA-256 of the exact `manifest.json` bytes, optionally followed by one `\n`. |
| `blobs/<sha256>` | deflate or stored | Original bytes of a file whose SHA-256 is `<sha256>`. One entry per distinct content. |

No other entries are allowed, except an optional `README.txt` for humans.

- **File extension:** `.gamesave`.
- **Media type:** `application/vnd.saveforge.gamesave+zip`.

## 2. Writing

- Every `sha256` referenced by any snapshot **MUST** have a `blobs/` entry, except in incremental exports (§4).
- Writers **SHOULD** use deflate, and **SHOULD** store entries that would not shrink, such as already-compressed saves.
- After writing, the exporter **SHOULD** reopen the archive and verify it (§3) before reporting success.
- `source.placeholders` contains the user's name. Exporters **SHOULD** offer to omit it.

## 3. Reading and validation

Before importing anything, a reader **MUST** check all of the following and reject the whole archive if any check fails:

1. `mimetype` is the first entry, is stored, and has the exact content above.
2. Entry names:
   - are relative and use `/`;
   - contain no `..` segment, no `\`, no drive letters and no leading `/`;
   - are unique when compared case-insensitively.
3. No entry is encrypted, a symbolic link or a device file.
4. Resource limits hold. Readers are protected against decompression bombs by stopping as soon as a limit is exceeded:
   - the total uncompressed size stays within a configurable limit, 16 GiB by default;
   - no entry has a compression ratio above 1000:1.
5. `manifest.json.sha256` matches, and `manifest.json` validates against the schema and the semantic rules:
   - snapshot `gameId`s match their game;
   - snapshot IDs are unique;
   - path-safety rules P1–P4 apply to every file path;
   - `local:` games carry `localProfile`.
6. Every `blobs/<sha256>` entry hashes to its name.

## 4. Incremental exports

`mode: "incremental"` with `baseExportId` omits blobs that the base export already contains. To import an incremental export, the reader **MUST** first confirm that every missing blob is present in its vault, normally because the base was imported earlier. If any blob is missing, the reader **MUST** refuse the import and name the base export required.

## 5. Importing

Importing **never** restores. Imported snapshots are written to the vault with their original `snapshotId` and contents:

- their `kind` is kept;
- a snapshot whose ID already exists in the vault is skipped (imports are idempotent);
- the user then restores explicitly, through the normal restore procedure (vault/SPEC.md §4).

`source.placeholders` is informative only. Readers **MUST NOT** use it to decide where files go.

## 6. Compatibility

Readers **MUST** reject archives whose `formatVersion` is higher than they support, and say which app version is needed. Within version 1, the manifest has no extension points. A new field means a new revision of the schema in this repository (see VERSIONING.md).
