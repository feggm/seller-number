/// <reference path="../pb_data/types.d.ts" />

// permanentNumberMarkets — one row per (Dauernummer, market): what that number sold.
//
// Raw per-market figures, not aggregates: averages, medians and a trend are computed on read
// from these rows, so there is no second copy to drift. The cash-desk side pushes them after
// each market (KKM-legacy plan §1.10); the push keeps the newest MARKETS_KEPT rows per number
// and deletes older ones — the window the review flag rests on is four active markets, and the
// register holds nothing it does not need. A paused market has no row, which is exactly how the
// flag rule wants it.
//
// Numbers and cents only — no article, no name. Superuser-only rules; read through the report
// route.
migrate(
  (app) => {
    const numbers = app.findCollectionByNameOrId('permanentNumbers')

    const collection = new Collection({
      type: 'base',
      name: 'permanentNumberMarkets',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          autogeneratePattern: '[a-z0-9]{15}',
          hidden: false,
          id: 'text3208210256',
          max: 15,
          min: 15,
          name: 'id',
          pattern: '^[a-z0-9]+$',
          presentable: false,
          primaryKey: true,
          required: true,
          system: true,
          type: 'text',
        },
        {
          cascadeDelete: true,
          collectionId: numbers.id,
          hidden: false,
          id: 'relation_pnm_permanentNumber',
          maxSelect: 1,
          minSelect: 0,
          name: 'permanentNumber',
          presentable: true,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_pnm_market',
          max: 8,
          min: 8,
          name: 'market',
          pattern: '^[0-9]{4}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$',
          presentable: true,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          cascadeDelete: false,
          collectionId: 'pbc_1687431684',
          hidden: false,
          id: 'relation_pnm_event',
          maxSelect: 1,
          minSelect: 0,
          name: 'event',
          presentable: false,
          required: false,
          system: false,
          type: 'relation',
        },
        {
          hidden: false,
          id: 'number_pnm_itemsSold',
          max: null,
          min: 0,
          name: 'itemsSold',
          onlyInt: true,
          presentable: true,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'number_pnm_revenueCents',
          max: null,
          min: 0,
          name: 'revenueCents',
          onlyInt: true,
          presentable: true,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'autodate_pnm_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
        {
          hidden: false,
          id: 'autodate_pnm_updated',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        // Idempotent push: a market is written once per number, a repeat overwrites in place.
        'CREATE UNIQUE INDEX `idx_pnm_number_market` ON `permanentNumberMarkets` (`permanentNumber`, `market`)',
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumberMarkets')
    return app.delete(collection)
  }
)
