# LibreMuseum — pocketbase

Content server for the LibreMuseum mobile app, built on [PocketBase](https://pocketbase.io).

The mobile app is an **empty shell**: it contains no text, no image, no audio guide. Everything
comes from this server, including the museum name, its logo and its colours. Direct consequence:
**the museum changes its content without going through the App Store**. The developers' work is
limited to installing this server once, then publishing the app once.

## What the server exposes

| Endpoint | Purpose |
| --- | --- |
| `GET /api/app/version` | Fingerprint of the content state. Called on every app launch. |
| `GET /api/app/bundle` | All the text content in a single JSON, with the media URLs. |
| `GET /api/files/…` | Images and audio, with thumbnails on the fly (`?thumb=400x0`). |
| `GET /api/collections/…` | Standard PocketBase REST API, read-only and public. |
| `/_/` | Administration dashboard — this is where the museum staff work. |

The app compares `version` with the one of its local copy and only downloads the bundle again if
it changed; the endpoint also handles `If-None-Match` and answers `304`. Media, on the other
hand, are downloaded on demand and cached by the phone. As long as the server runs, the app runs
— and offline, it displays its latest copy.

## Running locally

```bash
./scripts/dev.sh --seed   # blank database + bilingual demo museum
```

The script downloads the PocketBase binary, applies the migrations and serves on
http://127.0.0.1:8090. Then create an administration account:

```bash
./bin/pocketbase superuser upsert you@example.org your-password --dir=./pb_data
```

> `--dir` is essential: PocketBase resolves its default paths relative to the **binary**, so it
> would look for `bin/pb_data`. `scripts/dev.sh` already passes the right paths.

Then open http://127.0.0.1:8090/_/ for the dashboard, or check the API:

```bash
curl -s localhost:8090/api/app/bundle | jq
```

Subsequent runs: `./scripts/dev.sh` (without `--seed`, which erases `pb_data/`).

## Testing without risking your dev database

```bash
./scripts/test.sh
```

Brings up a disposable instance on port **8091**: fresh database in `.test-data/`, demo content,
and an administration account already created (`test@example.org` / `testtest1234`).

`pb_data/` is never touched, and the ports differ: dev and test run at the same time. The test
database is recreated from scratch on every run, but stays on disk after shutdown so it can be
inspected.

It is the right tool for anything hard to undo: trying a migration, breaking content on purpose,
checking the behaviour of a blank database, or pointing the mobile app at clean data.

## Deploying

```bash
cp .env.example .env    # fill in DOMAIN and ACME_EMAIL
docker compose up -d
```

Caddy obtains and renews the TLS certificate automatically. Create the first administration
account:

```bash
docker compose exec pocketbase pocketbase superuser upsert team@museum.org password --dir=/pb/pb_data
```

Then, **in the dashboard settings**, enable automatic backups to S3. A museum's content
represents weeks of manual entry: that is the real operational risk, well before a server
failure.

The `pb_data` volume holds the database and every uploaded file. It is the only state to back up.

## Repository layout

```
pb_migrations/    Versioned schema. Applied automatically at startup.
pb_hooks/         Server logic in JS, hot-reloaded.
  main.pb.js        Guard for the "museum" singleton
  bundle.pb.js      /api/app/version and /api/app/bundle endpoints
  seed.pb.js        `pocketbase seed` command
  lib/content.js    Bundle building and version computation
seed/             Demo museum (content + generated media)
scripts/          dev.sh (working database), test.sh (disposable database)
docs/             Documentation for the museum staff
  getting-started.html  Illustrated walkthrough, opens in a browser
  CONTENT-GUIDE.md      Field-by-field reference
```

## Evolving the schema

The schema is **not** edited by hand in production. It lives in `pb_migrations/`, which
guarantees that a fresh instance — another museum — rebuilds identically.

```bash
./bin/pocketbase migrate create "add_field_x"
```

Edit the generated file, then restart the server. In development, changing a collection from the
dashboard automatically generates the corresponding migration file: remember to commit it.

If you add a **content collection**, add it to `CONTENT_TABLES` in `pb_hooks/lib/content.js` as
well, otherwise its changes will not move the version and the apps will never see them.

## Good to know

**PocketBase is at v0.39, pre-1.0**: backwards compatibility is not guaranteed. The version is
pinned in `.env` and the `Dockerfile`. Bump it deliberately, after replaying the migrations on a
test database.

**No granular roles.** The museum staff sign in with `_superusers` accounts, which can also
modify the schema. That is acceptable for a small, trusted team; beyond that, it is better to
limit the number of accounts than to hope for a separation PocketBase does not offer.

**No visitor account.** The app is anonymous and read-only. The `users` collection created by
default by PocketBase is deleted by a migration, so as not to leave an open sign-up API with no
purpose.

## License

MIT — see [LICENSE](LICENSE). [PocketBase](https://github.com/pocketbase/pocketbase), on which
the server is built, is under the same licence. The demo media in `seed/assets/` are generated
for this repository and are covered by it.
