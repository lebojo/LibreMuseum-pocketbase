/// <reference path="../pb_data/types.d.ts" />

// Minimal bootstrap, not demo content (that one lives in seed/).
//
// The app always expects a `museum` and at least one language: without them,
// the first start would return an incomplete bundle and the app would have
// nothing to display. We therefore guarantee that a fresh instance is
// immediately valid, with values the museum will replace in the dashboard.

migrate(
  (app) => {
    const languageCollection = app.findCollectionByNameOrId("language");
    const english = new Record(languageCollection);
    english.set("code", "en");
    english.set("label", "English");
    english.set("sort", 0);
    english.set("active", true);
    app.save(english);

    const museum = new Record(app.findCollectionByNameOrId("museum"));
    museum.set("name", "My museum");
    museum.set("primary_color", "#1B1B1F");
    museum.set("accent_color", "#B8860B");
    museum.set("default_lang", english.id);
    app.save(museum);

    const settings = app.settings();
    settings.meta.appName = "LibreMuseum";
    app.save(settings);
  },
  (app) => {
    const museum = app.findFirstRecordByFilter("museum", "1=1");
    if (museum) app.delete(museum);

    const english = app.findFirstRecordByFilter("language", "code = 'en'");
    if (english) app.delete(english);
  },
);
