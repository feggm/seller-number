/// <reference path="../pb_data/types.d.ts" />

// permanentNumberHolders.holderContactChannel — how the holder is reached.
//
// `email` is the default and the only channel the confirmation cycle can drive itself.
// `whatsapp` holders have a phone number and no address: their confirmation stays a manual
// step for the operator until a gateway exists (seller-number-integration.md §1.8,
// 19.09.2026 — three AZB staff numbers are reachable this way only). holderEmail therefore
// stops being required at schema level; the record hook enforces "address required unless the
// channel is whatsapp" instead, so an e-mail holder without an address is still refused.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumberHolders')

    collection.fields.getById('email_pnHolders_email').required = false
    collection.fields.addAt(
      5,
      new Field({
        hidden: false,
        id: 'select_pnHolders_contactChannel',
        maxSelect: 1,
        name: 'holderContactChannel',
        presentable: false,
        required: true,
        system: false,
        type: 'select',
        values: ['email', 'whatsapp'],
      })
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumberHolders')
    collection.fields.removeById('select_pnHolders_contactChannel')
    collection.fields.getById('email_pnHolders_email').required = true
    return app.save(collection)
  }
)
