# Changelog

All notable changes to the SaveForge specifications are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the repository uses SemVer (see [VERSIONING.md](VERSIONING.md)).

## [Unreleased]

### Added
- Repository structure, contribution rules and validation tooling (`npm run check`).
- `common`: shared definitions (hashes, UUIDs, timestamps, slugs, template paths, OS and store enums).
- `profile` v1 draft: schema, specification, placeholders, mechanisms catalog (`standard`, `latest-n`, `store-user-scoped`), path-safety rules P1–P6 / K1–K3 with conformance vectors and a reference implementation.
- `registry` v1 draft: root metadata with key rotation, channel indexes (anti-rollback sequence, expiry, revocation), bundles with license notices, detached Ed25519 signatures, signing test vectors from deterministic test keys.
