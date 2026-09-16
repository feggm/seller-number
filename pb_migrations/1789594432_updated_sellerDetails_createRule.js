/// <reference path="../pb_data/types.d.ts" />

// sellerDetails: close the public createRule.
//
// 1743201120 opened createRule to "" (anyone). registration.pb.js creates sellerDetails through
// $app, which bypasses API rules, and no client writes the collection directly. The open rule
// allowed anonymous inserts of names/emails that could be attached to a number and exported.
// list/view/update/delete remain superuser-only as before.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')
    unmarshal({ createRule: null }, collection)
    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')
    unmarshal({ createRule: '' }, collection)
    return app.save(collection)
  }
)
