/// <reference path="../pb_data/types.d.ts" />

// Core of the model: exhibition -> artworks, each translated into N languages.
//
// Texts and audio live in the `*_translation` collections, not on the artwork
// itself: an audio guide has a DIFFERENT sound file per language, which a plain
// multilingual field could not express.

// 25 MB: a 3-minute audio guide track in 128k MP3 weighs ~3 MB, but museums
// often provide WAV or high-quality MP3.
const AUDIO_MAX_SIZE = 26214400;
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
          maxSize: 10485760,
          mimeTypes: ["image/png", "image/jpeg", "image/webp"],
          thumbs: ["400x300", "1200x0"],
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
      listRule: "published = true && exhibition.published = true",
      viewRule: "published = true && exhibition.published = true",
      fields: [
        {
          type: "relation",
          name: "exhibition",
          required: true,
          collectionId: exhibition.id,
          maxSelect: 1,
          // Deleting an exhibition deletes its artworks, and by cascade their
          // translations. Destructive action: documented in the content guide.
          cascadeDelete: true,
        },
        {
          type: "relation",
          name: "room",
          collectionId: roomId,
          maxSelect: 1,
          // No cascade: deleting a room must not erase the artworks.
          cascadeDelete: false,
        },
        {
          type: "number",
          name: "pos_x",
          min: 0,
          max: 1,
          help: "Horizontal position on the floor map, from 0 (left) to 1 (right).",
        },
        {
          type: "number",
          name: "pos_y",
          min: 0,
          max: 1,
          help: "Vertical position on the floor map, from 0 (top) to 1 (bottom).",
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
          maxSize: 15728640, // 15 MB per image
          mimeTypes: ["image/png", "image/jpeg", "image/webp"],
          thumbs: ["200x200", "800x0", "1600x0"],
          help: "The first image is used as the thumbnail in lists.",
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

    const artworkTranslation = new Collection({
      type: "base",
      name: "artwork_translation",
      listRule: "artwork.published = true && artwork.exhibition.published = true",
      viewRule: "artwork.published = true && artwork.exhibition.published = true",
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
