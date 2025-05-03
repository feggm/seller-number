/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // remove field
  collection.fields.removeById("number571526813")

  // remove field
  collection.fields.removeById("number299693395")

  // update field
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1981446857")

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number571526813",
    "max": null,
    "min": null,
    "name": "numberFrom",
    "onlyInt": true,
    "presentable": true,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "number299693395",
    "max": null,
    "min": null,
    "name": "numberTo",
    "onlyInt": true,
    "presentable": true,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // update field
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
})
