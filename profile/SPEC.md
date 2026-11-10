# Game profile — v1 (draft)

A **profile** declares where a game keeps its saves and how SaveVault backs them up. Profiles are data only: they never contain executable code.

- Schema: [`schema/profile.v1.schema.json`](schema/profile.v1.schema.json)
- Placeholders: [`placeholders.md`](placeholders.md)
- Path safety: [`path-rules.md`](path-rules.md)
- Mechanisms: [`mechanisms.md`](mechanisms.md)
- Examples: [`examples/profile.v1/`](examples/profile.v1/)

## 1. Formats

Profiles are **authored** as YAML in `savevault-registry` and **distributed** as JSON inside registry bundles. Consumers (the Desktop) read JSON only.

A YAML profile **MUST** convert to JSON that validates against the schema. Authors **MUST NOT** use YAML-only features: anchors, aliases, tags and non-string keys.

## 2. Top-level fields

| Field | Required | Meaning |
|---|---|---|
| `schemaVersion` | yes | Always `1` for this version. |
| `id` | yes | Stable slug. **MUST NOT** be reused for another game, even after deletion. |
| `name` | yes | Display name. |
| `revision` | yes | Starts at 1. The registry **MUST** increment it on every published change. |
| `identifiers` | yes | How to recognize an installation (§3). |
| `saves` / `registry` | at least one | File rules (§4) and Windows registry rules (§5). |
| `exclude` | no | Globs of files never backed up (matching rules in §4.1). |
| `backup` | no | Backup options (§6). |
| `mechanism` | yes | Built-in strategy (§7). |
| `compatibility` | no | `minAppVersion` and informative `gameVersions`. |
| `provenance` | yes | Data origin and license (§8). |

## 3. Identifiers

`steam`, `gog` and `epic` hold store IDs. `executables` and `installDirNames` hold bare file or directory names.

Consumers match installations in this order of confidence:

1. store ID (exact match);
2. executable name (case-insensitive);
3. installation directory name, after normalization (case-folded, with punctuation and spaces removed).

Executables and directory names are case-insensitive on every OS.

## 4. Save rules

Each entry in `saves` has the following fields:

- **`id`:** the logical name of the data. Rules for different platforms that hold the **same** data **SHOULD** share an `id` (for example `progress` for Windows and for Linux). Consumers use it to relate backups across operating systems.
- **`tags`:** `save` (progress) and/or `config` (settings). Users can choose to back up only `save`.
- **`when`:** optional `os` and `store` filters. A rule without `when.os` applies on every OS its placeholders allow (see §4.1). `when.os` names the platform of the **game build**, not the host: a Windows build running through Wine/Proton on Linux matches `windows`, and its Windows placeholders resolve inside the prefix.
- **`paths`:** one or more path templates.

### 4.1 Path templates

- A path is a sequence of segments separated by `/`, and the first segment is a root placeholder (see [`placeholders.md`](placeholders.md)).
- Segments **MAY** contain these globs:
  - `*` matches any run of characters within one segment;
  - `?` matches one character;
  - a whole segment `**` matches zero or more segments.
- `[` and `]` are literal characters.
- Paths **MUST** satisfy every rule in [`path-rules.md`](path-rules.md). Producers and consumers **MUST** both enforce those rules.
- The OS a path applies to:
  - a placeholder with a fixed OS (for example `<winAppData>`) restricts the path to that OS;
  - Windows placeholders also apply inside Wine/Proton prefixes on Linux (see [`placeholders.md`](placeholders.md));
  - if `when.os` contradicts the placeholder's OS, the profile is invalid.
- Matching is case-insensitive on Windows and macOS, and case-sensitive on Linux. Inside a Wine/Proton prefix it is case-insensitive.
- A path that matches a **directory** includes every file below it, recursively. A path that matches a file includes that file.
- Symbolic links, junctions and other reparse points are **never followed or captured**. Consumers skip them, both while walking and when they appear as matches.
- `exclude` patterns use the same glob syntax:
  - A pattern containing `/` is matched against the file's path relative to the root placeholder's directory.
  - A pattern without `/` is matched against the file name at any depth.
  - The OS's case rules apply.

## 5. Registry rules

`registry` entries name Windows registry keys as `HKCU/Software/...`, using `/` as the separator. Only keys under `HKCU/Software` are allowed. Globs are not allowed.

A rule captures the key, all its values and its subkeys. Registry rules are applied on Windows and inside Wine/Proton prefixes (through the prefix's `user.reg`).

## 6. Backup options

| Option | Meaning |
|---|---|
| `requireGameClosed` | If `true`, consumers **MUST** refuse to back up while the game runs. Restores are always refused while the game runs, whatever this value. |
| `processNames` | Process names that indicate the game is running. |
| `cloudSync` | Stores whose cloud sync covers this game, for example `["steam"]`. Consumers use it to apply the user's launcher-cloud policy (prefer launcher / prefer SaveVault / ask). |
| `maxBytes` | Expected upper bound of one backup. Consumers **SHOULD** ask before backing up more. |
| `consistentGroups` | Sets of globs whose matches must be read together, for example a database and its journal. Consumers **MUST** re-read the whole group if any member changes during the read. |

## 7. Mechanism

`mechanism.type` selects a strategy built into the Desktop. The catalog is in [`mechanisms.md`](mechanisms.md).

Readers that do not know a `type` **MUST** skip the whole profile and report that an app update is needed. They **MUST NOT** apply the profile partially.

New mechanisms are added by changing the Desktop code, never by shipping code inside a profile.

## 8. Provenance and licensing

- **`source`:**
  - `savevault` for profiles written for the official registry (`saveforge`, its former name, is still accepted and means the same);
  - `ludusavi` for profiles converted from the Ludusavi manifest;
  - `local` for user-created profiles that are never published.
- **`license`:** an SPDX identifier.
  - Profiles converted from Ludusavi, and profiles derived from them, carry `CC-BY-NC-SA-3.0`, because that data comes from PCGamingWiki.
  - Profiles written from scratch use the registry's own data license.
- **`basedOn.ludusavi`:** links the profile to the upstream entry it replaces or derives from.
- **`contributors`:** credits people as `community:<uuid>` or `github:<login>`.

## 9. Precedence

When several profiles describe the same game, consumers use exactly one of them, in this order: `local` > official registry > `ludusavi` channel.

"Same game" means:
- equal `id`;
- or a `provenance.basedOn.ludusavi` match;
- or a shared store ID.

The chosen profile replaces the others entirely. Profiles are never merged.
