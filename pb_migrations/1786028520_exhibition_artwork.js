/// <reference path="../pb_data/types.d.ts" />

// Core of the model: exhibition -> artworks, each translated into N languages.
// An artwork may also group other artworks through `parent`, for a work made of
// several pieces - see the second `app.save(artwork)` below.
//
// Texts and audio live in the `*_translation` collections, not on the artwork
// itself: an audio guide has a DIFFERENT sound file per language, which a plain
// multilingual field could not express.

// 25 MB: a 3-minute audio guide track in 128k MP3 weighs ~3 MB, but museums
// often provide WAV or high-quality MP3.
const AUDIO_MAX_SIZE = 26214400;

// 5 MB: every photograph reaches the app through thumbnails capped at 1600 px,
// so beyond that the extra weight only slows down the upload over the museum's
// connection. The floor map is the exception, see the `map` migration: it is a
// scan displayed at full size for the visitor to zoom into.
const IMAGE_MAX_SIZE = 5242880;
const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
];

migrate(
  (app) => {
    const languageId = app.findCollectionByNameOrId("language").id;
    const roomId = app.findCollectionByNameOrId("room").id;

    const exhibition = new Collection({
      type: "base",
      name: "exhibition",
      // Unpublished content is invisible to the public API: it stays editable
      // in the dashboard without being exposed to visitors.
      listRule: "published = true",
      viewRule: "published = true",
      fields: [
        {
          type: "text",
          name: "slug",
          required: true,
          max: 80,
          pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
          presentable: true,
          help: "Stable identifier in lowercase-with-dashes. Do not change it once published.",
        },
        {
          type: "file",
          name: "cover",
          maxSelect: 1,
          maxSize: IMAGE_MAX_SIZE,
          mimeTypes: ["image/png", "image/jpeg", "image/webp"],
          thumbs: ["400x300", "1200x0"],
          help:
            "Image announcing the exhibition in the app. JPEG or WebP (PNG accepted), " +
            "at least 1200 px on the long side. 5 MB max.",
        },
        {
          type: "text",
          name: "color",
          max: 9,
          // Same format and same validation as `museum.primary_color`: one
          // single notation to explain to the staff. Optional on purpose - left
          // empty, the app falls back to the museum's `accent_color`, so a
          // museum that does not want to think about colours has nothing to
          // fill in. It is what lets a temporary exhibition carry the graphic
          // identity of its poster without an app update.
          pattern: "^#[0-9a-fA-F]{6}$",
          help: "Colour of the exhibition, in #RRGGBB format. Empty = the museum's accent colour.",
        },
        {
          type: "bool",
          name: "is_permanent",
          help: "Permanent collection: the start and end dates are then ignored.",
        },
        { type: "date", name: "start_date" },
        { type: "date", name: "end_date" },
        {
          type: "relation",
          name: "rooms",
          collectionId: roomId,
          maxSelect: 20,
          cascadeDelete: false,
          help: "Rooms occupied by the exhibition.",
        },
        // Paying exhibitions: the app shows the description, then locks the
        // artworks behind a code the visitor scans from the ticket sold at the
        // desk. These two read as part of the exhibition, before `sort` and
        // `published` which close every content form.
        //
        // The flag is `requires_ticket`, not `free`. A PocketBase boolean is
        // false by default and cannot be otherwise: a `free` checkbox would
        // turn every exhibition into a paying one until someone remembers to
        // tick it. Unchecked must mean "nothing changes", so the checkbox says
        // what it adds.
        //
        // The lock is an honesty barrier, not a copy protection: the artworks
        // stay readable through the public REST API, as they must be for the
        // app to work without an account. It stops a visitor from browsing
        // instead of buying a ticket; it does not stop someone determined.
        {
          type: "bool",
          name: "requires_ticket",
          help:
            "Tick this if a ticket is needed to see the artworks. The app then shows only the " +
            "description of the exhibition, and asks the visitor to scan the code below.",
        },
        {
          type: "text",
          name: "unlock_code",
          max: 64,
          help:
            "Code to unlock: the text to put in the QR code printed on the ticket. Choose whatever " +
            "you like (e.g. \"MONET2026\"). Scanning it opens this exhibition on the visitor's phone.",
        },
        { type: "number", name: "sort", onlyInt: true },
        { type: "bool", name: "published" },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_exhibition_slug` ON `exhibition` (`slug`)",
      ],
    });
    app.save(exhibition);

    const artwork = new Collection({
      type: "base",
      name: "artwork",
      // Rules and the `parent` index are set after the first save, below: they
      // name a field that does not exist yet at this point.
      fields: [
        {
          type: "relation",
          name: "exhibition",
          // NOT required: an element of a composite work carries `parent`
          // instead. The main.pb.js hook enforces that exactly one of the two is
          // filled in - a record with neither would save without complaint, then
          // show up nowhere, with nothing on the form to explain why.
          collectionId: exhibition.id,
          maxSelect: 1,
          // Deleting an exhibition deletes its artworks, and by cascade their
          // translations. Destructive action: documented in the content guide.
          cascadeDelete: true,
          help:
            "The exhibition this artwork belongs to. Leave it empty for an element of a " +
            "composite work: such an element is attached through `parent` instead, and " +
            "follows the exhibition of the whole work.",
        },
        {
          type: "relation",
          name: "room",
          collectionId: roomId,
          maxSelect: 1,
          // No cascade: deleting a room must not erase the artworks.
          cascadeDelete: false,
          help: "The room where it hangs. Only for a whole work: an element follows the work it belongs to.",
        },
        {
          type: "number",
          name: "pos_x",
          min: 0,
          max: 1,
          help:
            "Horizontal position on the floor map, from 0 (left) to 1 (right). " +
            "Only for a whole work: an element is not placed separately.",
        },
        {
          type: "number",
          name: "pos_y",
          min: 0,
          max: 1,
          help:
            "Vertical position on the floor map, from 0 (top) to 1 (bottom). " +
            "Only for a whole work: an element is not placed separately.",
        },
        {
          type: "text",
          name: "code",
          max: 10,
          pattern: "^[0-9A-Z]*$",
          presentable: true,
          help: "Number shown on the label, which the visitor types in the app (e.g. \"12\").",
        },
        { type: "text", name: "artist", max: 160, presentable: true },
        {
          type: "text",
          name: "year",
          max: 60,
          help: "Free text: \"1889\", \"around 1500\", \"18th century\".",
        },
        { type: "text", name: "technique", max: 200 },
        { type: "text", name: "inventory_number", max: 60 },
        {
          type: "file",
          name: "images",
          maxSelect: 10,
          maxSize: IMAGE_MAX_SIZE,
          mimeTypes: ["image/png", "image/jpeg", "image/webp"],
          thumbs: ["200x200", "800x0", "1600x0"],
          // The staff photograph the artworks themselves, with what they have
          // on hand: either a phone shot too small to fill a screen, or a 40 MP
          // archival scan the uploader rejects. The format and the size are
          // enforced by `mimeTypes` and `maxSize`, but unless the field says so
          // the answer arrives only as an error message - or two months later
          // as a blurry app.
          //
          // 1600 px is the largest thumbnail generated here: below that, the
          // app enlarges the photo and it shows on a full-screen view. Above
          // ~2400 px nothing is gained, since every size served comes from the
          // thumbnails.
          help:
            "The first image is used as the thumbnail in lists: put the overall photo first, not a detail. " +
            "JPEG or WebP preferred (PNG accepted), at least 1600 px on the long side, 2400 px is plenty. 5 MB max per image.",
        },
        { type: "number", name: "sort", onlyInt: true },
        { type: "bool", name: "published" },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        // Partial index: `code` is optional, and without the WHERE every
        // artwork with no code would collide on the empty string.
        "CREATE UNIQUE INDEX `idx_artwork_code` ON `artwork` (`code`) WHERE `code` != ''",
        "CREATE INDEX `idx_artwork_exhibition` ON `artwork` (`exhibition`)",
        "CREATE INDEX `idx_artwork_room` ON `artwork` (`room`)",
      ],
    });
    app.save(artwork);

    // A work made of several pieces - a polyptych, a collage - is ONE artwork
    // for the whole, plus one artwork per element pointing at it through
    // `parent`. The element carries its own artist, year and texts, which is the
    // whole point: those differ from one panel to the next.
    //
    // This relation points at `artwork` itself, so it cannot be declared in the
    // definition above: `artwork.id` does not exist before the first save. Hence
    // the second save - do NOT merge them back into one.
    artwork.fields.addAt(
      2,
      new RelationField({
        name: "parent",
        collectionId: artwork.id,
        maxSelect: 1,
        // Deleting a whole work deletes its elements, and by cascade their
        // translations. Same reasoning, and same warning in the content guide,
        // as exhibition -> artwork above.
        cascadeDelete: true,
        help:
          "Leave empty for an ordinary artwork. Fill it in only for one element of a work " +
          "made of several pieces (a polyptych, a collage): point it at the whole work, " +
          "the one that carries the room and the position on the map.",
      }),
    );

    // Depth is capped at one level by the main.pb.js hook, and these rules are
    // why: a filter cannot express an arbitrary depth, it would take
    // `parent.parent.parent...` without end. So a root depends on its
    // exhibition, an element on its root - which depends on its own exhibition.
    // Unpublishing a whole work therefore hides every element with it.
    const artworkRule =
      "published = true && (" +
      "(parent = '' && exhibition.published = true) || " +
      "(parent.published = true && parent.exhibition.published = true))";
    artwork.listRule = artworkRule;
    artwork.viewRule = artworkRule;

    artwork.indexes = artwork.indexes.concat([
      "CREATE INDEX `idx_artwork_parent` ON `artwork` (`parent`)",
    ]);

    app.save(artwork);

    const exhibitionTranslation = new Collection({
      type: "base",
      name: "exhibition_translation",
      listRule: "exhibition.published = true",
      viewRule: "exhibition.published = true",
      fields: [
        {
          type: "relation",
          name: "exhibition",
          required: true,
          collectionId: exhibition.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          type: "relation",
          name: "language",
          required: true,
          collectionId: languageId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { type: "text", name: "title", required: true, max: 200, presentable: true },
        { type: "text", name: "subtitle", max: 300 },
        { type: "editor", name: "description", maxSize: 200000 },
        {
          type: "file",
          name: "audio",
          maxSelect: 1,
          maxSize: AUDIO_MAX_SIZE,
          mimeTypes: AUDIO_MIME_TYPES,
          help: "Audio introduction to the exhibition, in this language.",
        },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_exhibition_translation_unique` ON `exhibition_translation` (`exhibition`, `language`)",
      ],
    });
    app.save(exhibitionTranslation);

    const translationRule =
      "artwork.published = true && (" +
      "(artwork.parent = '' && artwork.exhibition.published = true) || " +
      "(artwork.parent.published = true && artwork.parent.exhibition.published = true))";

    const artworkTranslation = new Collection({
      type: "base",
      name: "artwork_translation",
      // Same two branches as the `artwork` rules above, one level down: a
      // translation is visible exactly when its artwork is.
      listRule: translationRule,
      viewRule: translationRule,
      fields: [
        {
          type: "relation",
          name: "artwork",
          required: true,
          collectionId: artwork.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          type: "relation",
          name: "language",
          required: true,
          collectionId: languageId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { type: "text", name: "title", required: true, max: 200, presentable: true },
        {
          type: "editor",
          name: "text",
          maxSize: 500000,
          help: "The long text shown on the artwork page.",
        },
        {
          type: "file",
          name: "audio",
          maxSelect: 1,
          maxSize: AUDIO_MAX_SIZE,
          mimeTypes: AUDIO_MIME_TYPES,
          help: "Audio guide track for this artwork, in this language.",
        },
        {
          type: "number",
          name: "audio_duration",
          onlyInt: true,
          min: 0,
          help: "Duration in seconds. Shown before playback; optional.",
        },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_artwork_translation_unique` ON `artwork_translation` (`artwork`, `language`)",
      ],
    });
    app.save(artworkTranslation);
  },
  (app) => {
    // Reverse order of the dependencies.
    app.delete(app.findCollectionByNameOrId("artwork_translation"));
    app.delete(app.findCollectionByNameOrId("exhibition_translation"));
    app.delete(app.findCollectionByNameOrId("artwork"));
    app.delete(app.findCollectionByNameOrId("exhibition"));
  },
);
