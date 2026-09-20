/// <reference path="../pb_data/types.d.ts" />

// registerLog.targetCollection — also sellerDetails and sellerNumbers.
//
// The Verwaltung page edits an event's registrations too (a typo in a name, a freed number),
// and those edits deserve the same trail as the register's. Public registrations arrive
// through the custom routes, not through record requests, so they stay out of this log.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('registerLog')
    const field = collection.fields.getById('select_regLog_target')
    field.values = ['permanentNumbers', 'permanentNumberHolders', 'sellerDetails', 'sellerNumbers']
    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('registerLog')
    const field = collection.fields.getById('select_regLog_target')
    field.values = ['permanentNumbers', 'permanentNumberHolders']
    return app.save(collection)
  }
)
