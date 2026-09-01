# AGENTS.md

Instructions for agents working on the LibreMuseum backend.

## The project in one sentence

A PocketBase server feeding an **empty shell** mobile app: texts, audio guides, images, maps,
museum name and colours all come from here, so that the museum can update its content without
going through the App Store again.

See `README.md` for installation and `docs/CONTENT-GUIDE.md` for the guide aimed at the museum's
(non-technical) staff.

## Commits

**A single line, never a body.** No description, no bullet list, no `Co-Authored-By`, no link.
The message stands on its own.

[Conventional Commits](https://www.conventionalcommits.org) format, description in the
imperative, no trailing period:

```
<type>(<optional scope>): <description>
```

```
feat: expose the content bundle for the mobile app
fix(bundle): make the version sensitive to deletions
docs: document content entry for the museum
chore(docker): pin PocketBase to 0.39.10
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
Breaking change: `feat!:` or `fix!:`.

One commit = one coherent change. Split rather than lump together.

## Commands

```bash
./scripts/dev.sh              # working database, :8090
./scripts/dev.sh --seed       # ERASES pb_data/ then reseeds - destructive
./scripts/test.sh             # disposable database in .test-data/, :8091
./bin/pocketbase migrate create "name"  --dir=./pb_data --migrationsDir=./pb_migrations
./bin/pocketbase superuser upsert mail password --dir=./pb_data
```

**Anything that is hard to undo goes through `scripts/test.sh`**: a migration to try, content to
break on purpose, the behaviour of a blank database. It recreates `.test-data/` from scratch,
never touches `pb_data/`, and provides a known admin account (`test@example.org` /
`testtest1234`). The port differs, so both instances can run side by side.

Checking a change:

```bash
curl -s localhost:8090/api/app/bundle | jq
curl -s localhost:8090/api/app/version
```

## PocketBase traps verified on this project

These four points cost time; do not rediscover them.

**Default paths are relative to the BINARY, not to the current directory.** Without explicit
`--dir`, `--hooksDir` and `--migrationsDir`, PocketBase looks for `bin/pb_data` and silently
starts with no schema and no hooks. `scripts/dev.sh` and the `Dockerfile` pass all three — keep
them on every new command.

**A `required` `number` field rejects the value `0`.** That is why `floor.level` is not required:
otherwise the ground floor would be impossible to enter. Same care for any new numeric field
where `0` is a legitimate value.

**Handlers cannot see the scope of the file surrounding them.** Every hook runs in an isolated
VM. Shared logic lives in `pb_hooks/lib/` and is loaded with `require()` **inside** the handler.
Only `*.pb.js` files are loaded as hooks, hence `lib/content.js` without the `.pb`.

**`app.newQuery()` does not exist on the app object exposed to JS.** Use `app.db().newQuery()`.

## Invariants not to break

**The schema lives in `pb_migrations/`, never edited by hand in production.** That is what makes
it possible to rebuild another museum's instance identically. In dev, a change made from the
dashboard automatically generates the migration file: commit it.

**Every new content collection must be added to `CONTENT_TABLES` in `pb_hooks/lib/content.js`.**
That list computes the version fingerprint. A forgotten collection = changes the apps will never
see, with no error to signal it.

**The fingerprint combines `COUNT(*)` and `MAX(updated)`.** The counter is what makes it
sensitive to deletions; a date comparison alone would leave a withdrawn artwork in the apps
forever. Do not "simplify" that computation.

**The bundle is a public contract with the mobile app.** Renaming or removing a field breaks
already installed apps, which nobody can force to update. Add fields, do not take them away.

**Media URLs are relative** (`/api/files/...`), so that a domain change does not expire the
bundles cached on phones.

**`published = false` must stay invisible** everywhere: in the collections' API rules as well as
in the bundle filtering. It is the museum's safety net for preparing an exhibition.

**The ticket lock is an honesty barrier, not a protection.** `exhibition.unlock_code` is compared
on the device, so it is served like any other field: the artworks of a paying exhibition stay
readable through the public API, as they must be for an app with no visitor account. The flag is
`requires_ticket` and not `free` because a PocketBase boolean is false by default: unchecked has
to mean "nothing changes".

**One single `museum` record per instance**, guaranteed by `pb_hooks/main.pb.js`, which also
refuses its deletion.

**No visitor account.** The app is anonymous and read-only; the default `users` collection is
deleted by a migration. Do not recreate it without a real need.

## Constraints

**PocketBase is pre-1.0**, with no backwards-compatibility guarantee. The version is pinned in
`.env.example`, `Dockerfile` and `scripts/dev.sh` — all three must stay aligned. Any version bump
is tested by replaying the migrations on a blank database.

**The museum is maintained by non-developers.** For every field added, fill in `help` in plain
language without jargon, and ask whether the content guide needs updating. A field nobody knows
how to fill in is useless.
