# Contributing to LibreMuseum — pocketbase

Thanks for your interest. This repository holds the PocketBase server; the iOS app consuming it
lives in [LibreMuseum-iOS](https://github.com/lebojo/LibreMuseum-iOS), with its own guidelines.

The server is an **empty shell feeder**: it ships no business logic beyond serving the museum's
content. The museum name, its logo, its palette, its exhibitions and its audio guides all come
from here, so that the museum can update its content without going through the App Store again.
That constraint governs nearly every rule below.

## Getting started

```bash
./scripts/dev.sh --seed   # PocketBase on :8090, bilingual demo museum
```

The script downloads the PocketBase binary if it is missing, applies the migrations, seeds the
demo museum and serves on http://127.0.0.1:8090. Then create an administration account:

```bash
./bin/pocketbase superuser upsert you@example.org your-password --dir=./pb_data
```

For anything that is hard to undo — trying a migration, breaking content on purpose — use the
disposable test instance instead:

```bash
./scripts/test.sh   # PocketBase on :8091, fresh database, known admin (test@example.org / testtest1234)
```

It recreates `.test-data/` from scratch on every run and never touches `pb_data/`.

Check the API:

```bash
curl -s localhost:8090/api/app/bundle | jq
curl -s localhost:8090/api/app/version
```

## Layout

```
pb_migrations/    Versioned schema. Applied automatically at startup.
pb_hooks/         Server logic in JS, hot-reloaded.
  main.pb.js        Guard for the "museum" singleton
  bundle.pb.js      /api/app/version and /api/app/bundle endpoints
  seed.pb.js        `pocketbase seed` command
  lib/content.js    Bundle building and version computation
seed/             Demo museum (content.json + generated media in assets/)
scripts/          dev.sh (working database), test.sh (disposable database)
docs/             Documentation for the museum staff
```

## Code style

Everything is written in English: code, comments, documentation, commit messages.

**Comments explain why, not what.** Describe a trap, a deliberate choice or a non-obvious
constraint — not a restatement of the code. The PocketBase traps that have already cost time
are documented in `AGENTS.md`.

**Every new field must have a `help` string**, written in plain language without jargon. The
museum staff fill in the dashboard directly; a field nobody understands is a field that stays
empty.

## Rules not to break

These invariants are not preferences; breaking them breaks the product.

**The schema lives in `pb_migrations/`, never edited by hand in production.** That is what
makes it possible to rebuild another museum's instance identically. In development, a schema
change made through the dashboard generates a migration file automatically: commit it.

**Every new content collection must be added to `CONTENT_TABLES` in
`pb_hooks/lib/content.js`.** That list computes the version fingerprint. A forgotten collection
means changes the apps will never see, with no error to signal it.

**`published = false` must stay invisible everywhere**: in the collection API rules (in the
migration) and in the bundle filter in `buildBundle`. It is the museum's safety net for
preparing an exhibition without visitors seeing it.

**The bundle is a public contract with the mobile app.** Renaming or removing a field breaks
already installed apps that nobody can force to update. Add fields; do not take them away.

**Media URLs in the bundle are relative** (`/api/files/…`). A domain change must not expire
the bundles already cached on phones.

**A `required` `number` field rejects the value `0`.** Do not add `required` to a numeric
field where `0` is a legitimate value (e.g. `floor.level` for the ground floor).

**One single `museum` record per instance.** The hook in `main.pb.js` enforces this. Do not
remove that guard.

`AGENTS.md` covers the rest — all four verified PocketBase traps and the reasoning behind every
architectural decision.

## Commits

**A single line, never a body.** No description, no bullet list, no `Co-Authored-By`, no link.
The message stands on its own.

[Conventional Commits](https://www.conventionalcommits.org) format, description in the
imperative, no trailing period:

```
feat: expose the content bundle for the mobile app
fix(bundle): make the version sensitive to deletions
docs: document content entry for the museum
chore(docker): pin PocketBase to 0.39.10
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
Breaking change: `feat!:` or `fix!:`.

One commit = one coherent change. Split rather than lump together.

## Pull requests

Work on a branch, never directly on `main`. Before opening the PR:

- `./scripts/test.sh` starts cleanly from a blank database and the bundle is valid
  (`curl -s localhost:8091/api/app/bundle | jq` returns no error);
- every new field has a `help` string;
- a new content collection is listed in `CONTENT_TABLES`;
- if you changed the schema, the migration file is committed alongside the hook changes.

Describe the **why** in the PR: the *what* is readable in the diff. If you change a behaviour
documented in `AGENTS.md`, update that file in the same batch.

## Reporting a problem

Open an issue stating the PocketBase version (visible in `./bin/pocketbase --version`), the
migration that fails if applicable, and the raw response if the issue is an API error
(`curl -s localhost:8090/api/app/bundle`). A display problem in the app often comes from the
bundle: check it with `jq` before concluding the issue is on the app side.

## AI-assisted contributions

They are welcome. `AGENTS.md` is written for that — point your agent at it. You remain
responsible for the code you propose: read it, run it through `./scripts/test.sh`, and make
sure it follows the rules above, in particular the bundle contract and the `published` filter.
