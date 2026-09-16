/// <reference path="../pb_data/types.d.ts" />

// sellerNumbers: close the public createRule.
//
// 1743201088 opened createRule to "" (anyone). Nothing legitimate uses it: reservations are
// created by reservation.pb.js through $app inside a transaction, which bypasses API rules, and
// the frontend only lists and subscribes (useSellerNumbersQuery.ts). What the open rule did allow
// was anonymous inserts of arbitrary seller numbers straight into the export — and with the
// KKM pull those rows would reach the cash desk database. list/view stay public: the number grid
// needs them.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_492105405')
    unmarshal({ createRule: null }, collection)
    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_492105405')
    unmarshal({ createRule: '' }, collection)
    return app.save(collection)
  }
)
