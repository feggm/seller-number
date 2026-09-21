/// <reference path="../pb_data/types.d.ts" />

// permanentNumbers.reviewDecision — the operator's answer to the advisory flag.
//
// The flag is arithmetic and gets recomputed by every push; the decision is a person's: "looked
// at it, the number stays" (ok), with a note and the newest market it was taken for. A later
// market does not erase the decision — the Verwaltung shows the flag again when the window
// has moved past the market the decision was taken for, and the registerLog keeps every
// decision because these fields arrive through record requests.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumbers')
    collection.fields.add(
      new Field({
        hidden: false,
        id: 'select_pn_reviewDecision',
        maxSelect: 1,
        name: 'reviewDecision',
        presentable: false,
        required: false,
        system: false,
        type: 'select',
        values: ['ok'],
      })
    )
    collection.fields.add(
      new Field({
        hidden: false,
        id: 'date_pn_reviewDecidedAt',
        name: 'reviewDecidedAt',
        presentable: false,
        required: false,
        system: false,
        type: 'date',
      })
    )
    collection.fields.add(
      new Field({
        autogeneratePattern: '',
        hidden: false,
        id: 'text_pn_reviewDecisionMarket',
        max: 8,
        min: 0,
        name: 'reviewDecisionMarket',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )
    collection.fields.add(
      new Field({
        autogeneratePattern: '',
        hidden: false,
        id: 'text_pn_reviewNote',
        max: 500,
        min: 0,
        name: 'reviewNote',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )
    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumbers')
    for (const id of ['select_pn_reviewDecision', 'date_pn_reviewDecidedAt', 'text_pn_reviewDecisionMarket', 'text_pn_reviewNote']) {
      collection.fields.removeById(id)
    }
    return app.save(collection)
  }
)
