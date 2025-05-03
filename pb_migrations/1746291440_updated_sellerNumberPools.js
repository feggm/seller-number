/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "json2006895353",
    "maxSize": 0,
    "name": "numbers",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // remove field
  collection.fields.removeById("json2006895353")

  return app.save(collection)
})
