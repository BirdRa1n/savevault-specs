# Path safety rules — v1

These rules stop profiles from reading, and later restoring over, files that are not game data. Three independent layers enforce the **same** rules:

- the Community database, when a contribution is submitted;
- the registry CI, before a profile is published;
- the Desktop, when a profile is loaded.

All implementations **MUST** produce the expected result for every vector in [`test-vectors/path-rules.json`](test-vectors/path-rules.json). The reference implementation is [`scripts/lib/path-rules.mjs`](../scripts/lib/path-rules.mjs).

Each rule has a stable ID. Implementations report violations in rule order, and the first one reported is the one the test vectors expect.

## Save paths

| ID | Rule |
|---|---|
| **P1** | **Syntax.** The path is 1–512 characters long and uses `/` only. It contains no `\`, no control characters, no empty segments (`//`) and no trailing `/`. It does not start with `~` and contains no environment-variable syntax (`%VAR%`, `$VAR`, `${VAR}`). |
| **P2** | **Root placeholder.** The first segment is exactly one known root placeholder. |
| **P3** | **Known placeholders.** Every other placeholder is a known segment placeholder. Root placeholders and stray `<` or `>` characters **MUST NOT** appear after the first segment. |
| **P4** | **No relative segments.** No segment is `.` or `..`. |
| **P5** | **Anchored.** The path has at least one segment after the root. For `user`-scope roots, the **first** segment after the root **MUST** be literal: no globs and no placeholders. For `<base>`, the segments after the root **MUST NOT** all be `**`. |
| **P6** | **Not sensitive.** No contiguous run of segments may match an entry of [`path-denylist.json`](path-denylist.json), compared case-insensitively. A glob segment (`*`, `?`) or `**` counts as matching a denylist element, as long as at least one segment in the run matches literally. |

P5 rejects paths like `<home>/**` or `<winAppData>/*/x.sav`, which would sweep through unrelated programs. P6 is conservative: for example, `<winAppData>/Microsoft/**` is rejected because `**` could reach `Microsoft/Credentials`.

## Registry keys

| ID | Rule |
|---|---|
| **K1** | **Syntax.** The key is 1–256 characters long, `/`-separated, with no `\`, no control characters, no globs (`*`, `?`), no empty segments and no trailing `/`. |
| **K2** | **Scope.** The key starts with `HKCU/Software/`, followed by at least one more segment. `HKCU` is upper-case, and `Software` is compared case-insensitively. |
| **K3** | **No relative segments.** No segment is `.` or `..`. |

## Run-time obligations (Desktop)

The rules above check profiles statically. In addition, the Desktop:

- **MUST** check every **resolved** file against the denylist before reading it. A glob can expand into places the static check could not see.
- **MUST NOT** follow symbolic links or junctions that leave the resolved root directory, either when backing up or when restoring.
- **MUST** restore only to paths produced by resolving the profile on the current machine, and never to paths taken verbatim from a backup.
