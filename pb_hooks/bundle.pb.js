/// <reference path="../pb_data/types.d.ts" />

// Public API consumed by the mobile app.
//
//   GET /api/app/version  -> { version }        a few bytes
//   GET /api/app/bundle   -> all the content    a few hundred KB
//
// The app calls /version on every launch; it only downloads the bundle again if
// the version changed. That is what lets the app be an empty shell usable
// offline: the content lives on the server, the local copy stays valid as long
// as the version does not move.

routerAdd("GET", "/api/app/version", (e) => {
  const content = require(`${__hooks}/lib/content.js`);

  return e.json(200, { version: content.computeVersion(e.app) });
});

routerAdd("GET", "/api/app/bundle", (e) => {
  const content = require(`${__hooks}/lib/content.js`);

  const version = content.computeVersion(e.app);

  // The app sends back the ETag of the bundle it already has: nothing to transfer.
  if (e.request.header.get("If-None-Match") === `"${version}"`) {
    e.response.header().set("ETag", `"${version}"`);
    return e.noContent(304);
  }

  // In-memory cache shared across VM instances, keyed by version. No explicit
  // invalidation needed: as soon as content changes the version changes, so the
  // key no longer matches and the bundle is rebuilt.
  const store = e.app.store();
  let payload = "";
  if (store.get("bundle:version") === version) {
    payload = store.get("bundle:json");
  }

  if (!payload) {
    payload = JSON.stringify(content.buildBundle(e.app, version));
    store.set("bundle:version", version);
    store.set("bundle:json", payload);
  }

  e.response.header().set("ETag", `"${version}"`);
  // Short, because the museum must see its changes online almost immediately.
  // Revalidation is free anyway thanks to the ETag.
  e.response.header().set("Cache-Control", "public, max-age=60");

  return e.blob(200, "application/json", payload);
});
