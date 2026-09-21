/// <reference path="../pb_data/types.d.ts" />

// marketSellers — every seller of a market, as hash pair and figures.
//
// The cash-desk push carries all sellers of a market (§1.10 `numbers`); the register kept only
// the Dauernummern's rows and the top sellers. This keeps the rest too, so the Verwaltung can
// say of a registration "seen before — first market 2019-Apr, 12 markets" or "neu dabei":
// a free seller draws another number every market, only the hash pair follows the person.
// Hashes and figures only, no names. Replaced per market by each push. Superuser-only rules.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'marketSellers',
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
          id: 'relation_msl_category',
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
          id: 'text_msl_market',
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
          id: 'relation_msl_event',
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
          id: 'number_msl_number',
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
          id: 'number_msl_itemsSold',
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
          id: 'number_msl_revenueCents',
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
          id: 'text_msl_firstNameHash',
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
          id: 'text_msl_lastNameHash',
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
          id: 'autodate_msl_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_msl_category_market_number` ON `marketSellers` (`eventCategory`, `market`, `number`)',
        // The history looks a person up by the hash pair.
        'CREATE INDEX `idx_msl_hashes` ON `marketSellers` (`lastNameHash`, `firstNameHash`)',
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('marketSellers')
    return app.delete(collection)
  }
)
