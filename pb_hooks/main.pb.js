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

// Guards for a work made of several pieces (a polyptych, a collage).
//
// The shape is: ONE artwork for the whole work, attached to its exhibition and
// placed on the map, plus one artwork per element pointing at it through
// `parent`. Neither field is required on its own, so nothing in the schema
// stops the three mistakes below. Each of them saves without complaint and then
// shows up as content missing from the app, with nothing to explain why - so we
// refuse at the point where the person can still read the reason.
//
// The messages are read by museum staff in the dashboard form, not by a
// developer in a log: they say what to do, not what failed.
function checkArtworkParent(e) {
  const record = e.record;
  const parent = record.getString("parent");
  const exhibition = record.getString("exhibition");

  if (!parent && !exhibition) {
    throw new BadRequestError(
      "Choose an exhibition for this artwork. If it is one element of a work made of " +
        "several pieces, fill in `parent` instead, pointing at the whole work.",
    );
  }

  if (parent && exhibition) {
    throw new BadRequestError(
      "An artwork belongs either to an exhibition or to a whole work, not to both. " +
        "An element follows the exhibition of the work it belongs to: empty `exhibition`, " +
        "and keep `parent`.",
    );
  }

  if (parent) {
    if (parent === record.id) {
      throw new BadRequestError("An artwork cannot be an element of itself.");
    }

    // Depth is capped at one level on purpose: the API rules that hide an
    // unpublished work cannot express an arbitrary depth, they would need
    // `parent.parent.parent...` without end. See the migration.
    const target = e.app.findRecordById("artwork", parent);
    if (target.getString("parent")) {
      throw new BadRequestError(
        "`parent` must point at a whole work, not at one of its elements. A work is split " +
          "in one level only: point this artwork at the whole work instead.",
      );
    }

    // The same cap, reached from the other end: attaching a work that already
    // holds elements would bury them one level deeper. Without this check the
    // rule above is enough on creation but not on an edit, where it is exactly
    // the gesture someone makes to reorganise a room. It also rules out cycles:
    // two artworks cannot point at each other if neither may have both a parent
    // and elements.
    const children = e.app.findRecordsByFilter(
      "artwork",
      "parent = {:id}",
      "",
      1,
      0,
      { id: record.id },
    );
    if (children.length > 0) {
      throw new BadRequestError(
        "This artwork is itself made of several pieces, so it cannot become an element of " +
          "another one. Detach its elements first, or attach it to an exhibition instead.",
      );
    }
  }

  e.next();
}

onRecordCreateRequest(checkArtworkParent, "artwork");
onRecordUpdateRequest(checkArtworkParent, "artwork");
