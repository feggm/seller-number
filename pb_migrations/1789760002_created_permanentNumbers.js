/// <reference path="../pb_data/types.d.ts" />

// permanentNumbers — one row per Dauernummer.
//
// Keyed on the *variation*, not the event: that is what makes the number outlive a market. The
// variation already carries the event category, so a KKM Dauernummer and an AZB staff number
// (decision 14 in seller-number-integration.md) live side by side without a market column.
//
// Superuser-only. The unique index mirrors sellerNumbers' (pool, number) shape and is what makes
// the register import idempotent: a second import of the same list finds every row.
migrate(
  (app) => {
    const holders = app.findCollectionByNameOrId('permanentNumberHolders')

    const collection = new Collection({
      type: 'base',
      name: 'permanentNumbers',
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
          collectionId: 'pbc_1269879477',
          hidden: false,
          id: 'relation_pn_variation',
          maxSelect: 1,
          minSelect: 0,
          name: 'sellerNumberVariation',
          presentable: true,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          hidden: false,
          id: 'number_pn_number',
          max: null,
          min: 0,
          name: 'permanentNumberNumber',
          onlyInt: true,
          presentable: true,
          required: true,
          system: false,
          type: 'number',
        },
        {
          cascadeDelete: false,
          collectionId: holders.id,
          hidden: false,
          id: 'relation_pn_holder',
          maxSelect: 1,
          minSelect: 0,
          name: 'holder',
          presentable: true,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          hidden: false,
          id: 'select_pn_status',
          maxSelect: 1,
          name: 'status',
          presentable: true,
          required: true,
          system: false,
          type: 'select',
          values: ['aktiv', 'pausiert', 'freigegeben', 'gesperrt'],
        },
        {
          hidden: false,
          id: 'date_pn_heldSince',
          max: '',
          min: '',
          name: 'heldSince',
          presentable: false,
          required: false,
          system: false,
          type: 'date',
        },
        {
          hidden: false,
          id: 'date_pn_releasedAt',
          max: '',
          min: '',
          name: 'releasedAt',
          presentable: false,
          required: false,
          system: false,
          type: 'date',
        },
        // Snapshot of the last review export from the sales archive (kkm-db-v2-datamodel.md
        // "Feeding the review flag"): windowed averages over the last four active markets and
        // the flag they produced. Averages only, by design — no single market judges a number.
        // Money in cents, like everywhere on the cash-desk side.
        {
          hidden: false,
          id: 'bool_pn_reviewFlag',
          name: 'reviewFlag',
          presentable: false,
          required: false,
          system: false,
          type: 'bool',
        },
        {
          hidden: false,
          id: 'date_pn_reviewedAt',
          max: '',
          min: '',
          name: 'reviewedAt',
          presentable: false,
          required: false,
          system: false,
          type: 'date',
        },
        {
          hidden: false,
          id: 'number_pn_reviewMarkets',
          max: null,
          min: 0,
          name: 'reviewMarkets',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'number_pn_avgItemsSold',
          max: null,
          min: 0,
          name: 'avgItemsSold',
          onlyInt: false,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'number_pn_avgRevenueCents',
          max: null,
          min: 0,
          name: 'avgRevenueCents',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'autodate_pn_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
        {
          hidden: false,
          id: 'autodate_pn_updated',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_pn_variation_number` ON `permanentNumbers` (`sellerNumberVariation`, `permanentNumberNumber`)',
        'CREATE INDEX `idx_pn_holder` ON `permanentNumbers` (`holder`)',
        'CREATE INDEX `idx_pn_status` ON `permanentNumbers` (`status`)',
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumbers')
    return app.delete(collection)
  }
)
