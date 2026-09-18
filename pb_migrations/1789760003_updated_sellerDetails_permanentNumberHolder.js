/// <reference path="../pb_data/types.d.ts" />

// sellerDetails.permanentNumberHolder — set only on rows the register materialised.
//
// This single relation is what turns `dnr` on in the export (export-core.js): a materialised
// Dauernummer is an ordinary registered row that also knows its holder. No cascade — deleting a
// holder must not silently unregister a number mid-market.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')
    const holders = app.findCollectionByNameOrId('permanentNumberHolders')

    collection.fields.addAt(
      8,
      new Field({
        cascadeDelete: false,
        collectionId: holders.id,
        hidden: false,
        id: 'relation_sellerDetails_pnHolder',
        maxSelect: 1,
        minSelect: 0,
        name: 'permanentNumberHolder',
        presentable: false,
        required: false,
        system: false,
        type: 'relation',
      })
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')
    collection.fields.removeById('relation_sellerDetails_pnHolder')
    return app.save(collection)
  }
)
