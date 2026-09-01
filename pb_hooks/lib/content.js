/// <reference path="../../pb_data/types.d.ts" />

// Logic shared between the bundle.pb.js handlers.
//
// This file does NOT end in `.pb.js`, so it is not loaded as a hook: it is only
// `require()`d from inside the handlers. That is mandatory - every PocketBase
// handler runs in an isolated VM instance and cannot see the scope of the file
// surrounding it.

// Every table whose change must invalidate the app's cache.
// Add any new content collection here, otherwise the app will never see its
// changes.
const CONTENT_TABLES = [
  "museum",
  "language",
  "floor",
  "room",
  "exhibition",
  "artwork",
  "exhibition_translation",
  "artwork_translation",
  "page",
  "page_translation",
];

// Relative path: the app prefixes it with its own base URL. A domain change
// therefore does not expire the bundles already cached on phones.
function fileUrl(collectionName, recordId, filename) {
  if (!filename) return "";
  return "/api/files/" + collectionName + "/" + recordId + "/" + filename;
}

function fileUrls(collectionName, recordId, filenames) {
  return (filenames || []).map(function (f) {
    return fileUrl(collectionName, recordId, f);
  });
}

// PocketBase serialises its dates as "2026-09-15 00:00:00.000Z" (space, not T).
// The bundle is a contract we define for the app: we emit ISO 8601, which every
// client can read without a custom format.
function dateString(record, field) {
  const value = record.getDateTime(field);
  return value.isZero() ? "" : value.string().replace(" ", "T");
}

/**
 * Fingerprint of the content state.
 *
 * Combines COUNT(*) and MAX(updated) of every table. The counter is what makes
 * the fingerprint sensitive to DELETIONS: a date comparison alone would not
 * move when a record disappears, and the app would keep an artwork withdrawn by
 * the museum forever.
 */
function computeVersion(app) {
  const selects = [];
  const shape = {};
  CONTENT_TABLES.forEach(function (table, i) {
    selects.push(
      "(SELECT COUNT(*) || '/' || COALESCE(MAX(updated), '-') FROM {{" +
        table +
        "}}) AS t" +
        i,
    );
    shape["t" + i] = "";
  });

  const row = new DynamicModel(shape);
  app.db().newQuery("SELECT " + selects.join(", ")).one(row);

  const fingerprint = CONTENT_TABLES.map(function (_, i) {
    return row["t" + i];
  }).join("|");

  // 16 characters: plenty for an ETag, and short in the logs.
  return $security.sha256(fingerprint).substring(0, 16);
}

/**
 * Groups translation records by parent id, indexed by language code.
 *
 * Returns { parentId: { "fr": {...}, "en": {...} } }.
 */
function groupTranslations(records, parentField, langCodeById, mapFn) {
  const out = {};
  records.forEach(function (record) {
    const langCode = langCodeById[record.getString("language")];
    // Language disabled or deleted: translation ignored.
    if (!langCode) return;

    const parentId = record.getString(parentField);
    if (!out[parentId]) out[parentId] = {};
    out[parentId][langCode] = mapFn(record);
  });
  return out;
}

/**
 * Builds the museum's entire text content into a single object.
 *
 * Media files are not included: only their URLs are. The app downloads them on
 * demand and caches them itself, which keeps this bundle in the range of a few
 * hundred KB even for a large museum.
 */
function buildBundle(app, version) {
  // --- Languages ------------------------------------------------------------
  const languages = app.findRecordsByFilter("language", "active = true", "sort,code", 200, 0);
  const langCodeById = {};
  languages.forEach(function (l) {
    langCodeById[l.id] = l.getString("code");
  });

  // --- Museum --------------------------------------------------------------
  // Singleton guaranteed by the main.pb.js hook, but we stay defensive: a
  // database emptied by hand must not bring the endpoint down with a 500.
  const museumRecords = app.findRecordsByFilter("museum", "1=1", "created", 1, 0);
  let museum = null;
  if (museumRecords.length > 0) {
    const m = museumRecords[0];
    const location = m.getRaw("location") || {};
    museum = {
      id: m.id,
      name: m.getString("name"),
      subtitle: m.getString("subtitle"),
      logo: fileUrl("museum", m.id, m.getString("logo")),
      cover: fileUrl("museum", m.id, m.getString("cover")),
      primary_color: m.getString("primary_color"),
      accent_color: m.getString("accent_color"),
      default_lang: langCodeById[m.getString("default_lang")] || "",
      ticket_validity_hours: m.getInt("ticket_validity_hours"),
      website: m.getString("website"),
      email: m.getString("email"),
      phone: m.getString("phone"),
      address: m.getString("address"),
      latitude: location.lat || 0,
      longitude: location.lon || 0,
    };
  }

  // --- Map -----------------------------------------------------------------
  const floors = app.findRecordsByFilter("floor", "1=1", "level", 100, 0).map(function (f) {
    return {
      id: f.id,
      name: f.getString("name"),
      level: f.getInt("level"),
      map: fileUrl("floor", f.id, f.getString("map")),
      sort: f.getInt("sort"),
    };
  });

  const rooms = app.findRecordsByFilter("room", "1=1", "sort,name", 500, 0).map(function (r) {
    return {
      id: r.id,
      floor: r.getString("floor"),
      name: r.getString("name"),
      code: r.getString("code"),
      sort: r.getInt("sort"),
    };
  });

  // --- Translations ---------------------------------------------------------
  // Loaded in bulk then grouped in memory: one query per type rather than one
  // per artwork.
  const exhibitionTranslations = groupTranslations(
    app.findRecordsByFilter("exhibition_translation", "1=1", "created", 2000, 0),
    "exhibition",
    langCodeById,
    function (t) {
      return {
        title: t.getString("title"),
        subtitle: t.getString("subtitle"),
        description: t.getString("description"),
        audio: fileUrl("exhibition_translation", t.id, t.getString("audio")),
      };
    },
  );

  const artworkTranslations = groupTranslations(
    app.findRecordsByFilter("artwork_translation", "1=1", "created", 20000, 0),
    "artwork",
    langCodeById,
    function (t) {
      return {
        title: t.getString("title"),
        text: t.getString("text"),
        audio: fileUrl("artwork_translation", t.id, t.getString("audio")),
        audio_duration: t.getInt("audio_duration"),
      };
    },
  );

  const pageTranslations = groupTranslations(
    app.findRecordsByFilter("page_translation", "1=1", "created", 500, 0),
    "page",
    langCodeById,
    function (t) {
      return {
        title: t.getString("title"),
        body: t.getString("body"),
      };
    },
  );

  // --- Editorial content ---------------------------------------------------
  // `published = false` is filtered here as in the API rules: the museum must be
  // able to prepare an exhibition without visitors seeing it.
  const exhibitions = app
    .findRecordsByFilter("exhibition", "published = true", "sort,slug", 500, 0)
    .map(function (e) {
      return {
        id: e.id,
        slug: e.getString("slug"),
        cover: fileUrl("exhibition", e.id, e.getString("cover")),
        color: e.getString("color"),
        is_permanent: e.getBool("is_permanent"),
        start_date: dateString(e, "start_date"),
        end_date: dateString(e, "end_date"),
        rooms: e.getStringSlice("rooms"),
        requires_ticket: e.getBool("requires_ticket"),
        unlock_code: e.getString("unlock_code"),
        sort: e.getInt("sort"),
        translations: exhibitionTranslations[e.id] || {},
      };
    });

  const artworks = app
    .findRecordsByFilter(
      "artwork",
      "published = true && exhibition.published = true",
      "sort,code",
      10000,
      0,
    )
    .map(function (a) {
      return {
        id: a.id,
        exhibition: a.getString("exhibition"),
        room: a.getString("room"),
        pos_x: a.getFloat("pos_x"),
        pos_y: a.getFloat("pos_y"),
        code: a.getString("code"),
        artist: a.getString("artist"),
        year: a.getString("year"),
        technique: a.getString("technique"),
        inventory_number: a.getString("inventory_number"),
        images: fileUrls("artwork", a.id, a.getStringSlice("images")),
        sort: a.getInt("sort"),
        translations: artworkTranslations[a.id] || {},
      };
    });

  const pages = app
    .findRecordsByFilter("page", "published = true", "sort,slug", 200, 0)
    .map(function (p) {
      return {
        id: p.id,
        slug: p.getString("slug"),
        icon: p.getString("icon"),
        sort: p.getInt("sort"),
        translations: pageTranslations[p.id] || {},
      };
    });

  return {
    version: version,
    generated_at: new Date().toISOString(),
    museum: museum,
    languages: languages.map(function (l) {
      return {
        code: l.getString("code"),
        label: l.getString("label"),
        sort: l.getInt("sort"),
      };
    }),
    floors: floors,
    rooms: rooms,
    exhibitions: exhibitions,
    artworks: artworks,
    pages: pages,
  };
}

module.exports = {
  CONTENT_TABLES: CONTENT_TABLES,
  computeVersion: computeVersion,
  buildBundle: buildBundle,
};
