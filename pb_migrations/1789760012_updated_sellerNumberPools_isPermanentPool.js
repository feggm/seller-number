/// <reference path="../pb_data/types.d.ts" />

// sellerNumberPools.isPermanentPool — the pool the register writes into.
//
// A Dauernummern pool is closed to the public (obtainableTo in the past) — but so is every
// public pool once the registration phase has ended, so the date alone cannot say what a pool
// is for. The flag can. The two pools the bridge created on 20.09.2026 carried a one-second
// obtainable window (00:00:00 – 00:00:01) as their only marker; the migration flags those.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_1981446857')
    collection.fields.add(
      new Field({
        hidden: false,
        id: 'bool_pools_isPermanentPool',
        name: 'isPermanentPool',
        presentable: false,
        required: false,
        system: false,
        type: 'bool',
      })
    )
    app.save(collection)

    const pools = app.findRecordsByFilter('sellerNumberPools', 'obtainableFrom != "" && obtainableTo != ""', '', 0, 0) || []
    for (const pool of pools) {
      const from = new Date(String(pool.get('obtainableFrom')).replace(' ', 'T')).getTime()
      const to = new Date(String(pool.get('obtainableTo')).replace(' ', 'T')).getTime()
      if (Number.isFinite(from) && Number.isFinite(to) && to - from <= 60 * 1000) {
        pool.set('isPermanentPool', true)
        app.save(pool)
      }
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_1981446857')
    collection.fields.removeById('bool_pools_isPermanentPool')
    return app.save(collection)
  }
)
