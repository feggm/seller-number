/// <reference path="../pb_data/types.d.ts" />

// permanentNumberHolders.holderAliases — the other spellings a person sold under.
//
// The statistics push recognises the holder by the hashes of the normalised name; a nickname
// (Steffi / Stefanie), a maiden name or a typo in an old seed (Krämer / Crämer / Cramer)
// therefore reads as "another person" and tears the four-market window. An alias is a second
// name pair the register accepts for this person — entered by name in the Verwaltung, or
// taken over from a market row that the operator confirms as the same person (then only the
// hash pair is known). JSON array of { firstName?, lastName?, firstNameHash, lastNameHash };
// the record hook fills the hashes from the names.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumberHolders')
    collection.fields.add(
      new Field({
        hidden: false,
        id: 'json_pnHolders_aliases',
        maxSize: 20000,
        name: 'holderAliases',
        presentable: false,
        required: false,
        system: false,
        type: 'json',
      })
    )
    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumberHolders')
    collection.fields.removeById('json_pnHolders_aliases')
    return app.save(collection)
  }
)
