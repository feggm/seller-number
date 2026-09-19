/// <reference path="../pb_data/types.d.ts" />

// sellerDetails.sellerEmail — optional at schema level, still required by the public path.
//
// The register materialises a WhatsApp-only holder into a sellerDetails row without an address
// (permanent-numbers-core.js). registration.pb.js keeps checking the address itself and sends
// the confirmation mail from the route, and createRule is closed, so no public request can
// produce a row without one. The KKM export simply carries an empty email column for such a row.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')
    collection.fields.getById('email2039473803').required = false
    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_418131918')
    collection.fields.getById('email2039473803').required = true
    return app.save(collection)
  }
)
