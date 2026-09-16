/// <reference path="../pb_data/types.d.ts" />

// sellerDetails.isStaff — the `ma` (Mitarbeiter) column of the KKM export.
//
// Set by hand in the admin UI for now; the Dauernummer register will copy it from the holder
// when it materialises a number. There is deliberately no per-variation staff flag: there is no
// staff-only number range.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')

    collection.fields.addAt(
      7,
      new Field({
        hidden: false,
        id: 'bool_sellerDetails_isStaff',
        name: 'isStaff',
        presentable: false,
        required: false,
        system: false,
        type: 'bool',
      })
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')
    collection.fields.removeById('bool_sellerDetails_isStaff')
    return app.save(collection)
  }
)
