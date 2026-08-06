/// <reference path="../pb_data/types.d.ts" />

// Museum map: floors (with a map image) and rooms.
// Artworks will be positioned on these maps through normalised coordinates.

migrate(
  (app) => {
    const floor = new Collection({
      type: "base",
      name: "floor",
      listRule: "",
      viewRule: "",
      fields: [
        { type: "text", name: "name", required: true, max: 80, presentable: true },
        {
          // Deliberately NOT `required`: PocketBase treats 0 as an empty value
          // on a required field, which would make the ground floor - the most
          // common one - impossible to enter.
          type: "number",
          name: "level",
          onlyInt: true,
          help: "0 = ground floor, 1 = first floor, -1 = basement.",
        },
        {
          type: "file",
          name: "map",
          maxSelect: 1,
          maxSize: 15728640, // 15 MB - scanned maps are large
          mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
          thumbs: ["400x0", "1600x0"],
          help: "Map image. Artwork coordinates are relative to this image.",
        },
        { type: "number", name: "sort", onlyInt: true },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_floor_level` ON `floor` (`level`)"],
    });
    app.save(floor);

    const room = new Collection({
      type: "base",
      name: "room",
      listRule: "",
      viewRule: "",
      fields: [
        {
          type: "relation",
          name: "floor",
          required: true,
          collectionId: floor.id,
          maxSelect: 1,
          // Deleting a floor deletes its rooms: a room with no floor makes no
          // sense and would leave artworks pointing at nothing.
          cascadeDelete: true,
        },
        { type: "text", name: "name", required: true, max: 80, presentable: true },
        {
          type: "text",
          name: "code",
          max: 20,
          help: "Short code shown in the app (e.g. \"S3\").",
        },
        { type: "number", name: "sort", onlyInt: true },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX `idx_room_floor` ON `room` (`floor`)"],
    });
    app.save(room);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("room"));
    app.delete(app.findCollectionByNameOrId("floor"));
  },
);
