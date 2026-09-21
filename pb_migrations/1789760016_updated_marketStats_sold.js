/// <reference path="../pb_data/types.d.ts" />

// marketStats.sellersSold / permanentSellersSold — how many of the market's sellers sold
// anything at all. `sellers` counts the registrations (every number the Kasse had a person
// for); a registration without a single sale is a no-show or an empty rail, and the gap
// between the two is a figure of its own. Both are derived by the statistics route from the
// pushed numbers, so an old push fills them on the next run.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('marketStats')
    collection.fields.add(
      new Field({
        hidden: false,
        id: 'number_ms_sellersSold',
        max: null,
        min: 0,
        name: 'sellersSold',
        onlyInt: true,
        presentable: false,
        required: false,
        system: false,
        type: 'number',
      })
    )
    collection.fields.add(
      new Field({
        hidden: false,
        id: 'number_ms_pnSellersSold',
        max: null,
        min: 0,
        name: 'permanentSellersSold',
        onlyInt: true,
        presentable: false,
        required: false,
        system: false,
        type: 'number',
      })
    )
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('marketStats')
    collection.fields.removeById('number_ms_sellersSold')
    collection.fields.removeById('number_ms_pnSellersSold')
    app.save(collection)
  }
)
