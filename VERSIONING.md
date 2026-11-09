# Versioning policy

## Schema versions

Each document type has its own integer major version, carried in the file name (`profile.v1.schema.json`) and in the document itself (`schemaVersion` or `formatVersion`).

- **Additive change:** a new optional field, a new enum value that readers can safely ignore, or a relaxed constraint. The change is made in place in `vN` and listed in the changelog. Readers **MUST** ignore unknown optional fields only where the spec marks an object as extensible. Everywhere else, a new field means a new minor revision of this repository.
- **Breaking change:** removing or renaming a field, changing its meaning, tightening a constraint, or adding a new required field. These changes produce `vN+1` as a new file, and `vN` is kept unchanged. Producers **SHOULD** keep emitting `vN` until consumers support `vN+1`.

A new enum value is only additive when the spec defines how readers treat unknown values. An example is the mechanism `type`: profiles with an unknown type are skipped with a warning.

## Repository releases

The repository is tagged with SemVer (`v0.1.0`, `v1.0.0`, …):

| Change | Tag bump |
|---|---|
| Editorial fixes | patch |
| Additive changes to any schema | minor |
| A new schema major version (`vN+1`) | minor (old versions remain) |
| Removal of a schema version | major |

Until `v1.0.0`, every area is a **draft** and may change without a new schema major version. Consumers pin an exact tag.
