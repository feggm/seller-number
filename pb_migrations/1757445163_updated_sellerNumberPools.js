/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // remove field
  collection.fields.removeById("json2006895353")

  // remove field
  collection.fields.removeById("text67889014")

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3630363806",
    "max": 0,
    "min": 0,
    "name": "numbersAsJsonArray",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "json2006895353",
    "maxSize": 0,
    "name": "numbers",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text67889014",
    "max": 0,
    "min": 0,
    "name": "numbersString",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("text3630363806")

  return app.save(collection)
})
