# Instructions for AI agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [VERSIONING.md](VERSIONING.md) first. Mandatory rules:

- This repository is normative. Every change updates SPEC.md, schema, examples (valid and invalid), test vectors when relevant, and CHANGELOG.md together.
- Never make a breaking change to an existing `vN` schema; create `vN+1`.
- Run `npm run check` before committing; it must pass.
- Commit after every meaningful unit of work, grouping only related files, so history stays traceable.
- Commit messages in **English**, Conventional Commits with the area as scope (`feat(profile): …`, `docs(registry): …`), imperative mood, subject ≤ 72 chars, written like a professional human developer.
- **Never** add `Co-Authored-By: Claude …` or any other AI attribution trailer to commits or pull requests.
- Specs and schemas are written in English; talk to the maintainer in Brazilian Portuguese (pt-BR).
