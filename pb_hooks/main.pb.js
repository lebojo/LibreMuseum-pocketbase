/// <reference path="../pb_data/types.d.ts" />

// Guard for the `museum` singleton.
//
// One LibreMuseum instance serves ONE museum. The bundle reads the first
// `museum` record; a second one would silently go unnoticed and give hours of
// confusion to whoever edits the wrong one. We refuse the creation rather than
// letting the ambiguity settle in.
onRecordCreateRequest((e) => {
  const existing = e.app.findRecordsByFilter("museum", "1=1", "", 1, 0);
  if (existing.length > 0) {
    throw new BadRequestError(
      "Only one museum per instance. Edit the existing record instead of creating a new one.",
    );
  }

  e.next();
}, "museum");

// Symmetrically: deleting the only museum would leave the app with no name, no
// logo and no default language. What gets emptied is the content, not the record.
onRecordDeleteRequest((e) => {
  throw new BadRequestError(
    "The museum record cannot be deleted. Edit it to change its content.",
  );
}, "museum");
