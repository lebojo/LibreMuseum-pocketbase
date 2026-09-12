/// <reference path="../pb_data/types.d.ts" />

// Foundation: the available languages and the museum identity.
// These two collections are read by the app on every start to configure itself
// (name, logo, colours) - that is what makes the app an empty shell.

migrate(
  (app) => {
    const language = new Collection({
      type: "base",
      name: "language",
      listRule: "",
      viewRule: "",
      // create/update/delete stay null => superusers only.
      fields: [
        {
          type: "text",
          name: "code",
          required: true,
          min: 2,
          max: 10,
          pattern: "^[a-z]{2}(-[A-Z]{2})?$",
          presentable: true,
          help: "BCP 47 code: fr, en, de, pt-BR...",
        },
        {
          type: "text",
          name: "label",
          required: true,
          max: 60,
          presentable: true,
          help: "Name of the language written IN that language (English, Deutsch, Español).",
        },
        { type: "number", name: "sort", onlyInt: true, help: "Display order." },
        {
          type: "bool",
          name: "active",
          help: "Uncheck to hide the language in the app without deleting the translations.",
        },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_language_code` ON `language` (`code`)",
      ],
    });
    app.save(language);

    const museum = new Collection({
      type: "base",
      name: "museum",
      listRule: "",
      viewRule: "",
      fields: [
        { type: "text", name: "name", required: true, max: 120, presentable: true },
        { type: "text", name: "subtitle", max: 200 },
        {
          type: "file",
          name: "logo",
          maxSelect: 1,
          maxSize: 5242880, // 5 MB
          mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
          thumbs: ["120x120f", "512x512f"],
        },
        {
          type: "file",
          name: "cover",
          maxSelect: 1,
          maxSize: 5242880, // 5 MB
          mimeTypes: ["image/png", "image/jpeg", "image/webp"],
          thumbs: ["600x0", "1200x0"],
          help:
            "Image shown at the top of the app's home screen. JPEG or WebP (PNG accepted), " +
            "at least 1200 px on the long side. 5 MB max.",
        },
        {
          type: "text",
          name: "primary_color",
          max: 9,
          pattern: "^#[0-9a-fA-F]{6}$",
          help: "Main colour of the app, in #RRGGBB format.",
        },
        {
          type: "text",
          name: "accent_color",
          max: 9,
          pattern: "^#[0-9a-fA-F]{6}$",
          help: "Accent colour, in #RRGGBB format.",
        },
        {
          type: "relation",
          name: "default_lang",
          required: true,
          collectionId: app.findCollectionByNameOrId("language").id,
          maxSelect: 1,
          cascadeDelete: false,
          help: "Language used when the phone's own language is not translated.",
        },
        {
          type: "number",
          name: "ticket_validity_hours",
          onlyInt: true,
          // Not required: `0` is a legitimate value and a required number field
          // rejects it. Empty or 0 therefore means "never expires", which is
          // also what a museum that has not thought about it gets.
          min: 0,
          help:
            "How many hours a scanned ticket keeps the exhibitions unlocked on the phone. " +
            "Leave empty or 0 so that a scan never expires.",
        },
        { type: "url", name: "website" },
        { type: "email", name: "email" },
        { type: "text", name: "phone", max: 40 },
        { type: "text", name: "address", max: 300 },
        {
          type: "geoPoint",
          name: "location",
          help: "Museum position, for directions from the app.",
        },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
    });
    app.save(museum);
  },
  (app) => {
    // museum first: it references language.
    app.delete(app.findCollectionByNameOrId("museum"));
    app.delete(app.findCollectionByNameOrId("language"));
  },
);
