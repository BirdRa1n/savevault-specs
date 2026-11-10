# Changelog

All notable changes to the SaveVault specifications are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the repository uses SemVer (see [VERSIONING.md](VERSIONING.md)).

## [Unreleased]

### Changed
- The project is now called **SaveVault** (formerly SaveForge):
  - `.gamesave` writers use the media type `application/vnd.savevault.gamesave+zip` and the manifest `format` `savevault.gamesave`. Readers also accept the former `saveforge` values.
  - The profile provenance `source` `savevault` replaces `saveforge`, which stays valid as an alias.
  - Schema `$id`s move to `savevault.github.io/savevault-specs`.
  - The test key seed label (`saveforge-test-key`) is unchanged, so the test keys and vectors keep their values.

### Clarified
- `profile`: `<storeUserId>` for Steam covers both the 32-bit account ID and the 64-bit SteamID.
- `profile`: directory matches are recursive, symbolic links are never followed or captured, and `exclude` matching rules are defined.

### Added
- Repository structure, contribution rules and validation tooling (`npm run check`).
- `common`: shared definitions (hashes, UUIDs, timestamps, slugs, template paths, OS and store enums).
- `profile` v1 draft: schema, specification, placeholders, mechanisms catalog (`standard`, `latest-n`, `store-user-scoped`), path-safety rules P1–P6 / K1–K3 with conformance vectors and a reference implementation.
- `registry` v1 draft: root metadata with key rotation, channel indexes (anti-rollback sequence, expiry, revocation), bundles with license notices, detached Ed25519 signatures, signing test vectors from deterministic test keys.
- `vault` v1 draft: content-addressed layout, crash-safe write order, snapshot documents (template paths with placeholder bindings, typed registry values), restore, retention, garbage collection and verification rules.
- `gamesave` v1 draft: ZIP container rules, manifest embedding vault snapshots, full and incremental exports, mandatory reader validation (zip-slip and decompression-bomb protection), idempotent import.
