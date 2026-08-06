/// <reference path="../pb_data/types.d.ts" />

// Free-form pages of the shell: practical information, prices, accessibility,
// legal notices. The museum can add or remove them without an app update - they
// appear automatically in the Settings screen.

migrate(
  (app) => {
    const page = new Collection({
      type: "base",
      name: "page",
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
          help: "Stable identifier in lowercase-with-dashes (e.g. \"practical-information\").",
        },
        {
          type: "text",
          name: "icon",
          max: 60,
          help: "SF Symbols icon name used by the iOS app (e.g. \"info.circle\").",
        },
        { type: "number", name: "sort", onlyInt: true },
        { type: "bool", name: "published" },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_page_slug` ON `page` (`slug`)"],
    });
    app.save(page);

    const pageTranslation = new Collection({
      type: "base",
      name: "page_translation",
      listRule: "page.published = true",
      viewRule: "page.published = true",
      fields: [
        {
          type: "relation",
          name: "page",
          required: true,
          collectionId: page.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          type: "relation",
          name: "language",
          required: true,
          collectionId: app.findCollectionByNameOrId("language").id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { type: "text", name: "title", required: true, max: 200, presentable: true },
        { type: "editor", name: "body", maxSize: 500000 },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_page_translation_unique` ON `page_translation` (`page`, `language`)",
      ],
    });
    app.save(pageTranslation);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("page_translation"));
    app.delete(app.findCollectionByNameOrId("page"));
  },
);
