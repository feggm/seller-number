/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3505075978")

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "file2229311990",
    "maxSelect": 1,
    "maxSize": 0,
    "mimeTypes": [
      "image/x-icon",
      "image/png",
      "image/vnd.mozilla.apng",
      "image/jpeg",
      "image/gif",
      "image/svg+xml"
    ],
    "name": "favicon",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [
      "16x16",
      "32x32",
      "48x48",
      "180x180",
      "192x192",
      "512x512"
    ],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3505075978")

  // remove field
  collection.fields.removeById("file2229311990")

  return app.save(collection)
})
