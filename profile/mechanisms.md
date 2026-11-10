# Backup mechanisms — v1

A mechanism is a backup strategy **implemented in the Desktop**. A profile picks one with `mechanism.type` and configures it with `mechanism.params`.

Adding a mechanism is a code change in `savevault-desktop`, reviewed like any other code. The new mechanism is documented here and gets a branch in the schema's `mechanism` definition. A "new mechanism" contribution in the Community is a request for that work, not a payload.

| `type` | Since app | Purpose | `params` |
|---|---|---|---|
| `standard` | 0.1.0 | Back up every file matched by the save rules. | none (**MUST** be omitted) |
| `latest-n` | 0.2.0 | Games that create one file or directory per save (timestamped or numbered slots). Only the `n` most recent matches of each path are kept. | `n` (1–100, required), `sortBy` (`mtime` default, or `name`) |
| `store-user-scoped` | 0.2.0 | Saves stored per store account (`<storeUserId>`). When restoring to a different account, the user is asked to map source accounts to target accounts. | `store` (`steam`, `epic` or `gog`, required) |

## Behavior shared by all mechanisms

- Registry rules, `exclude`, `tags` and every field in `backup` apply regardless of the mechanism.
- Size limits (`backup.maxBytes`) and consistent multi-file reads (`backup.consistentGroups`) are backup **options**, not mechanisms, so they combine with any type.

## Unknown types

A consumer that does not implement `mechanism.type` **MUST** skip the profile and tell the user an update is required. A newer profile that only uses known types but sets `compatibility.minAppVersion` above the running version **MUST** also be skipped.
