/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // update field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "date2096672853",
    "max": "",
    "min": "",
    "name": "obtainableFrom",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // update field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "date2505079801",
    "max": "",
    "min": "",
    "name": "obtainableTo",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // update field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "date2096672853",
    "max": "",
    "min": "",
    "name": "obtainableFrom",
    "presentable": true,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // update field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "date2505079801",
    "max": "",
    "min": "",
    "name": "obtainableTo",
    "presentable": true,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
})
