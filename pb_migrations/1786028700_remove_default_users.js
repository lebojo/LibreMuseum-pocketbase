/// <reference path="../pb_data/types.d.ts" />

// PocketBase creates a `users` collection by default, with public sign-up,
// password reset and email verification.
//
// LibreMuseum has no visitor account: the app is read-only and anonymous.
// Leaving that collection would expose an open sign-up API on the internet, for
// no purpose. We delete it.
//
// Museum staff sign in to the dashboard through `_superusers`, a separate
// system collection that this does not affect.
//
// If a need for visitor accounts ever appears (synced favourites, tickets...),
// create a new collection in a dedicated migration rather than reverting this
// one.

migrate(
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("users"));
    } catch (err) {
      // Already gone (instance where it was deleted by hand): nothing to do.
    }
  },
  (app) => {
    // No restore: recreating an empty auth collection would have neither the
    // same ids nor the same data. Deliberately irreversible migration.
  },
);
