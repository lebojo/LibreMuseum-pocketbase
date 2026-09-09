/// <reference path="../pb_data/types.d.ts" />

// The staff photograph the artworks themselves, with what they have on hand:
// either a phone shot too small to fill a screen, or a 40 MP archival scan the
// uploader rejects. The field said nothing about it, so the answer arrived only
// as an error message, or two months later as a blurry app.
//
// Nothing changes in the schema besides the `help`: the format and the size
// were already enforced by `mimeTypes` and `maxSize`, they simply were not
// stated anywhere the person uploading could read them.

migrate(
  (app) => {
    const artwork = app.findCollectionByNameOrId("artwork");

    // 1600 px is the largest thumbnail generated for this field: below that,
    // the app enlarges the photo and it shows on a full-screen view. Above
    // ~2400 px nothing is gained, since every size served comes from the
    // thumbnails.
    artwork.fields.getByName("images").help =
      "The first image is used as the thumbnail in lists: put the overall photo first, not a detail. " +
      "JPEG or WebP preferred (PNG accepted), at least 1600 px on the long side, 2400 px is plenty. 5 MB max per image.";

    app.save(artwork);
  },
  (app) => {
    const artwork = app.findCollectionByNameOrId("artwork");
    artwork.fields.getByName("images").help =
      "The first image is used as the thumbnail in lists.";
    app.save(artwork);
  },
);
