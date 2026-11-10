# savevault-specs

Normative specifications and JSON Schemas shared by every SaveVault component (Desktop, Registry, Community and API).

If two components exchange data, the contract lives here, not in either component. Consumers pin a tagged version of this repository.

| Area | What it defines | Status |
|---|---|---|
| [`common/`](common/) | Shared definitions (hashes, IDs, timestamps, template paths) | Draft v1 |
| [`profile/`](profile/SPEC.md) | Game profiles: where saves live and how to back them up | Draft v1 |
| [`registry/`](registry/SPEC.md) | Signed distribution of profiles (`root.json`, `index.json`, bundles) | Draft v1 |
| [`vault/`](vault/SPEC.md) | On-disk layout of the local backup vault and snapshot files | Draft v1 |
| [`gamesave/`](gamesave/SPEC.md) | The portable `.gamesave` export format | Draft v1 |

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Layout of each area

```
<area>/
  SPEC.md                      normative text
  schema/<name>.vN.schema.json JSON Schema (draft 2020-12)
  examples/<name>.vN/valid/    documents that MUST validate
  examples/<name>.vN/invalid/  documents that MUST be rejected
  test-vectors/                language-neutral conformance data
```

## Validating

Requires Node.js 20 or newer.

```bash
npm ci
```

```bash
npm run check
```

`npm run check` does three things:
- compiles every schema in strict mode;
- checks every example against its schema;
- runs the path-safety conformance vectors against the reference implementation in `scripts/lib/`.

## Versioning

See [VERSIONING.md](VERSIONING.md). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Profile *data* published in registries carries its own license, declared per profile in `provenance.license` (see `profile/SPEC.md` §8).
