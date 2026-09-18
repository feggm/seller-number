/// <reference path="../pb_data/types.d.ts" />

// marketTopSellers — the strongest sellers *without* a Dauernummer, per market.
//
// Candidates for a Dauernummer are found here: the cash-desk side pushes, with the market
// statistics, the top 20 by revenue and the top 20 by items among sellers who did not hold a
// Dauernummer (union, so at most 40 rows a market). A seller gets a different number every
// market, so the person is recognised across markets by the name-hash pair, exactly as the
// register does it; for a market with an event the number resolves to the registration
// through the event's pools, so the report can show the name to a superuser.
//
// Hashes and figures only. Kept for every market. Superuser-only rules.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'marketTopSellers',
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
          cascadeDelete: false,
          collectionId: 'pbc_3505075978',
          hidden: false,
          id: 'relation_mts_category',
          maxSelect: 1,
          minSelect: 0,
          name: 'eventCategory',
          presentable: true,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_mts_market',
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
          id: 'relation_mts_event',
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
          id: 'number_mts_number',
          max: null,
          min: 0,
          name: 'number',
          onlyInt: true,
          presentable: true,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'number_mts_rankRevenue',
          max: null,
          min: 0,
          name: 'rankRevenue',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'number_mts_rankItems',
          max: null,
          min: 0,
          name: 'rankItems',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'number_mts_itemsSold',
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
          id: 'number_mts_revenueCents',
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
          autogeneratePattern: '',
          hidden: false,
          id: 'text_mts_firstNameHash',
          max: 64,
          min: 0,
          name: 'firstNameHash',
          pattern: '^[a-f0-9]{64}$',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_mts_lastNameHash',
          max: 64,
          min: 0,
          name: 'lastNameHash',
          pattern: '^[a-f0-9]{64}$',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'autodate_mts_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_mts_category_market_number` ON `marketTopSellers` (`eventCategory`, `market`, `number`)',
        // The report groups by person across markets.
        'CREATE INDEX `idx_mts_hashes` ON `marketTopSellers` (`lastNameHash`, `firstNameHash`)',
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('marketTopSellers')
    return app.delete(collection)
  }
)
