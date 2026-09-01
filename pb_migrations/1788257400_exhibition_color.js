/// <reference path="../pb_data/types.d.ts" />

// A colour per exhibition: the app tints the exhibition's screens with it, so
// that a temporary exhibition can carry the graphic identity of its poster
// without an app update.
//
// Optional on purpose: left empty, the app falls back to the museum's
// `accent_color`. A museum that does not want to think about colours therefore
// has nothing to fill in.

migrate(
  (app) => {
    const exhibition = app.findCollectionByNameOrId("exhibition");

    // Same format and same validation as `museum.primary_color`: one single
    // notation to explain to the staff.
    //
    // Inserted right after `cover` (index 0 is the implicit `id`) rather than
    // appended: the dashboard form follows the schema order, and the content
    // guide describes the colour just below the cover image.
    exhibition.fields.addAt(
      3,
      new TextField({
        name: "color",
        max: 9,
        pattern: "^#[0-9a-fA-F]{6}$",
        help: "Colour of the exhibition, in #RRGGBB format. Empty = the museum's accent colour.",
      }),
    );

    app.save(exhibition);
  },
  (app) => {
    const exhibition = app.findCollectionByNameOrId("exhibition");
    exhibition.fields.removeByName("color");
    app.save(exhibition);
  },
);
