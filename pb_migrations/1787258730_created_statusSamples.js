/// <reference path="../pb_data/types.d.ts" />

// statusSamples — append-only time series for the public status page.
//
// Holds ONLY the realtime connection count. The number counts (registered/reserved/available)
// are exactly reconstructable from sellerDetails.created + sellerNumbers, so persisting them
// would be a second, drift-prone copy. The connection count exists only in Go process memory
// and is gone forever if it is not written down — that is the whole reason this collection
// exists.
//
// One immutable row per (eventCategory, bucketAt). Never updated in place: the unique index is
// the dedupe mechanism that caps write load at one row per bucket regardless of how many people
// are watching. See pb_hooks/status-samples.js.
//
// Superuser-only API rules — history is served through /api/seller-number/public-status/history.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'statusSamples',
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
          collectionId: 'pbc_3505075978',
          hidden: false,
          id: 'relation_statusSamples_cat',
          maxSelect: 1,
          minSelect: 0,
          name: 'eventCategory',
          presentable: true,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          hidden: false,
          id: 'date_statusSamples_bucket',
          max: '',
          min: '',
          name: 'bucketAt',
          presentable: true,
          required: true,
          system: false,
          type: 'date',
        },
        {
          hidden: false,
          id: 'number_statusSamples_conn',
          max: null,
          min: 0,
          name: 'connections',
          onlyInt: true,
          presentable: true,
          required: false,
          system: false,
          type: 'number',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_statusSamples_source',
          max: 0,
          min: 0,
          name: 'source',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'autodate_statusSamples_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        // The dedupe mechanism, not an optimisation: concurrent samplers race on the same
        // bucket and all but one lose, which is exactly the intent.
        'CREATE UNIQUE INDEX `idx_statusSamples_bucket` ON `statusSamples` (`eventCategory`, `bucketAt`)',
        // Retention sweep and history window queries scan by time.
        'CREATE INDEX `idx_statusSamples_bucketAt` ON `statusSamples` (`bucketAt`)',
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('statusSamples')
    return app.delete(collection)
  }
)
