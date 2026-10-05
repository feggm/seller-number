/// <reference path="../pb_data/types.d.ts" />

// sellerNumbers.babyNrOverride — the `babynr` export flag, set by hand for one number.
//
// `babynr` is derived from the pool's variation (export-core.js). That is wrong exactly when a
// number from the Babynummer pool went to a regular seller outside the system, or the other
// way round. Empty means "follow the variation"; `regular` / `baby` win over it. It lives on
// the sellerNumbers row, not on sellerDetails: it describes the number in this event, and a
// fresh reservation (reservation.pb.js deletes and recreates the row) starts without it.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_492105405')
    collection.fields.add(
      new Field({
        hidden: false,
        id: 'select_sn_babyNrOverride',
        maxSelect: 1,
        name: 'babyNrOverride',
        presentable: false,
        required: false,
        system: false,
        type: 'select',
        values: ['regular', 'baby'],
      })
    )
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_492105405')
    collection.fields.removeById('select_sn_babyNrOverride')
    app.save(collection)
  }
)
