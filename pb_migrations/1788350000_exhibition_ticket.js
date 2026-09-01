/// <reference path="../pb_data/types.d.ts" />

// Paying exhibitions: the app shows the description, then locks the artworks
// behind a code the visitor scans from the ticket sold at the desk.
//
// The flag is `requires_ticket`, not `free`. A PocketBase boolean is false by
// default and cannot be otherwise: a `free` checkbox would turn every existing
// exhibition into a paying one on this very migration, and every exhibition
// created afterwards would be born paying until someone remembers to tick it.
// Unchecked must mean "nothing changes", so the checkbox says what it adds.
//
// This lock is an honesty barrier, not a copy protection: the artworks stay
// readable through the public REST API, as they must be for the app to work
// without an account. It stops a visitor from browsing the exhibition instead
// of buying a ticket; it does not stop someone determined to read the JSON.

migrate(
  (app) => {
    const exhibition = app.findCollectionByNameOrId("exhibition");

    // Inserted before `sort` and `published`, which close every content form:
    // the ticket settings read as part of the exhibition, not as an appendix.
    exhibition.fields.addAt(
      8,
      new BoolField({
        name: "requires_ticket",
        help:
          "Tick this if a ticket is needed to see the artworks. The app then shows only the " +
          "description of the exhibition, and asks the visitor to scan the code below.",
      }),
    );

    exhibition.fields.addAt(
      9,
      new TextField({
        name: "unlock_code",
        max: 64,
        help:
          "Code to unlock: the text to put in the QR code printed on the ticket. Choose whatever " +
          "you like (e.g. \"MONET2026\"). Scanning it opens this exhibition on the visitor's phone.",
      }),
    );

    app.save(exhibition);

    const museum = app.findCollectionByNameOrId("museum");

    // Not required: `0` is a legitimate value and a required number field
    // rejects it. Empty or 0 therefore means "never expires", which is also
    // what a museum that has not thought about it gets.
    museum.fields.addAt(
      8,
      new NumberField({
        name: "ticket_validity_hours",
        onlyInt: true,
        min: 0,
        help:
          "How many hours a scanned ticket keeps the exhibitions unlocked on the phone. " +
          "Leave empty or 0 so that a scan never expires.",
      }),
    );

    app.save(museum);
  },
  (app) => {
    const exhibition = app.findCollectionByNameOrId("exhibition");
    exhibition.fields.removeByName("requires_ticket");
    exhibition.fields.removeByName("unlock_code");
    app.save(exhibition);

    const museum = app.findCollectionByNameOrId("museum");
    museum.fields.removeByName("ticket_validity_hours");
    app.save(museum);
  },
);
