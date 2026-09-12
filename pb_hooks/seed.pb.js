/// <reference path="../pb_data/types.d.ts" />

// `pocketbase seed` command: fills a fresh instance with a bilingual demo
// museum (2 exhibitions, 10 artworks - one of them a triptych in three pieces -
// floor maps, audio, pages).
//
// It serves two purposes: giving the mobile app something to display from the
// very first launch, and providing a concrete example of how content is
// structured - more telling than documentation for the museum staff.
//
// The command REFUSES to run if exhibitions already exist: on a production
// instance, it therefore cannot overwrite the museum's work.

$app.rootCmd.addCommand(
  new Command({
    use: "seed",
    short: "Fills the instance with the demo museum (refuses if content already exists)",
    silenceUsage: true,
    run: (cmd, args) => {
      const seedDir = `${__hooks}/../seed`;

      const existing = $app.findRecordsByFilter("exhibition", "1=1", "", 1, 0);
      if (existing.length > 0) {
        console.log(
          "Exhibitions already exist: seed cancelled so nothing is overwritten.\n" +
            "To start over in development, delete pb_data/ and rerun the migrations.",
        );
        return;
      }

      const data = JSON.parse(toString($os.readFile(`${seedDir}/content.json`)));

      // Loads a media file from seed/assets/. Returns null when the name is
      // empty, which leaves the file field empty on the PocketBase side.
      const asset = (name) => (name ? $filesystem.fileFromPath(`${seedDir}/assets/${name}`) : null);

      // --- Languages -------------------------------------------------------
      // `en` is already created by the bootstrap migration: we reuse it instead
      // of duplicating it (the unique index on `code` would reject it).
      const langByCode = {};
      data.languages.forEach((l) => {
        let record;
        try {
          record = $app.findFirstRecordByFilter("language", "code = {:code}", { code: l.code });
        } catch (err) {
          record = new Record($app.findCollectionByNameOrId("language"));
        }
        record.set("code", l.code);
        record.set("label", l.label);
        record.set("sort", l.sort);
        record.set("active", l.active);
        $app.save(record);
        langByCode[l.code] = record;
      });

      // Writes a parent's translations into the dedicated collection.
      const saveTranslations = (collectionName, parentField, parentRecord, translations, apply) => {
        Object.keys(translations).forEach((code) => {
          const language = langByCode[code];
          if (!language) return;

          const record = new Record($app.findCollectionByNameOrId(collectionName));
          record.set(parentField, parentRecord.id);
          record.set("language", language.id);
          apply(record, translations[code]);
          $app.save(record);
        });
      };

      // --- Museum ----------------------------------------------------------
      // Singleton created by the bootstrap migration: we update it.
      const museum = $app.findFirstRecordByFilter("museum", "1=1");
      const m = data.museum;
      museum.set("name", m.name);
      museum.set("subtitle", m.subtitle);
      museum.set("logo", asset(m.logo));
      museum.set("cover", asset(m.cover));
      museum.set("primary_color", m.primary_color);
      museum.set("accent_color", m.accent_color);
      museum.set("default_lang", langByCode[m.default_lang].id);
      museum.set("ticket_validity_hours", m.ticket_validity_hours);
      museum.set("website", m.website);
      museum.set("email", m.email);
      museum.set("phone", m.phone);
      museum.set("address", m.address);
      museum.set("location", { lat: m.latitude, lon: m.longitude });
      $app.save(museum);

      // --- Map -------------------------------------------------------------
      const floorByKey = {};
      data.floors.forEach((f) => {
        const record = new Record($app.findCollectionByNameOrId("floor"));
        record.set("name", f.name);
        record.set("level", f.level);
        record.set("map", asset(f.map));
        record.set("sort", f.sort);
        $app.save(record);
        floorByKey[f.key] = record;
      });

      const roomByKey = {};
      data.rooms.forEach((r) => {
        const record = new Record($app.findCollectionByNameOrId("room"));
        record.set("floor", floorByKey[r.floor].id);
        record.set("name", r.name);
        record.set("code", r.code);
        record.set("sort", r.sort);
        $app.save(record);
        roomByKey[r.key] = record;
      });

      // --- Exhibitions -----------------------------------------------------
      const exhibitionByKey = {};
      data.exhibitions.forEach((e) => {
        const record = new Record($app.findCollectionByNameOrId("exhibition"));
        record.set("slug", e.slug);
        record.set("cover", asset(e.cover));
        record.set("color", e.color);
        record.set("is_permanent", e.is_permanent);
        if (e.start_date) record.set("start_date", e.start_date);
        if (e.end_date) record.set("end_date", e.end_date);
        record.set(
          "rooms",
          (e.rooms || []).map((key) => roomByKey[key].id),
        );
        record.set("requires_ticket", e.requires_ticket);
        record.set("unlock_code", e.unlock_code);
        record.set("sort", e.sort);
        record.set("published", e.published);
        $app.save(record);
        exhibitionByKey[e.key] = record;

        saveTranslations("exhibition_translation", "exhibition", record, e.translations, (t, v) => {
          t.set("title", v.title);
          t.set("subtitle", v.subtitle);
          t.set("description", v.description);
          t.set("audio", asset(v.audio));
        });
      });

      // --- Artworks --------------------------------------------------------
      // A work made of several pieces is one artwork for the whole, plus one
      // artwork per element carrying `parent`. Elements are resolved through
      // `artworkByKey`, so a whole work MUST appear BEFORE its elements in
      // content.json: there, the order of the array is a dependency, not
      // presentation.
      const artworkByKey = {};
      data.artworks.forEach((a) => {
        const record = new Record($app.findCollectionByNameOrId("artwork"));
        // Exactly one of the two, as the main.pb.js guard requires: an element
        // follows the exhibition of the work it belongs to.
        if (a.exhibition) record.set("exhibition", exhibitionByKey[a.exhibition].id);
        if (a.parent) record.set("parent", artworkByKey[a.parent].id);
        if (a.room) record.set("room", roomByKey[a.room].id);
        record.set("pos_x", a.pos_x);
        record.set("pos_y", a.pos_y);
        record.set("code", a.code);
        record.set("artist", a.artist);
        record.set("year", a.year);
        record.set("technique", a.technique);
        record.set("inventory_number", a.inventory_number);
        record.set(
          "images",
          (a.images || []).map(asset),
        );
        record.set("sort", a.sort);
        record.set("published", a.published);
        $app.save(record);
        artworkByKey[a.key] = record;

        saveTranslations("artwork_translation", "artwork", record, a.translations, (t, v) => {
          t.set("title", v.title);
          t.set("text", v.text);
          t.set("audio", asset(v.audio));
          t.set("audio_duration", v.audio_duration);
        });
      });

      // --- Pages -----------------------------------------------------------
      data.pages.forEach((p) => {
        const record = new Record($app.findCollectionByNameOrId("page"));
        record.set("slug", p.slug);
        record.set("icon", p.icon);
        record.set("sort", p.sort);
        record.set("published", p.published);
        $app.save(record);

        saveTranslations("page_translation", "page", record, p.translations, (t, v) => {
          t.set("title", v.title);
          t.set("body", v.body);
        });
      });

      const parts = data.artworks.filter((a) => a.parent).length;
      console.log(
        `Seed done: ${data.exhibitions.length} exhibitions, ${data.artworks.length} artworks ` +
          `(of which ${parts} elements of a composite work), ${data.pages.length} pages, ` +
          `${data.languages.length} languages.`,
      );
    },
  }),
);
