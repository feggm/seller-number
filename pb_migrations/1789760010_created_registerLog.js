/// <reference path="../pb_data/types.d.ts" />

// registerLog — who changed what in the Dauernummer register, and when.
//
// One row per API request that creates, updates or deletes a permanentNumbers or
// permanentNumberHolders record, written by the request hooks in permanent-numbers.pb.js: the
// Verwaltung page, the PocketBase admin UI and curl all pass through them. `changes` holds
// field → { from, to } for what actually differed. The register's own routes (import,
// materialise) write syncLog instead — they are bulk syncs, not edits by a person.
//
// Superuser-only on all five rules, like the collections it describes; it carries the same
// names and contact data they do, nothing more.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'registerLog',
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
          hidden: false,
          id: 'select_regLog_target',
          maxSelect: 1,
          name: 'targetCollection',
          presentable: true,
          required: true,
          system: false,
          type: 'select',
          values: ['permanentNumbers', 'permanentNumberHolders'],
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_regLog_recordId',
          max: 15,
          min: 0,
          name: 'recordId',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_regLog_recordLabel',
          max: 200,
          min: 0,
          name: 'recordLabel',
          pattern: '',
          presentable: true,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'select_regLog_action',
          maxSelect: 1,
          name: 'action',
          presentable: true,
          required: true,
          system: false,
          type: 'select',
          values: ['create', 'update', 'delete'],
        },
        {
          hidden: false,
          id: 'json_regLog_changes',
          maxSize: 20000,
          name: 'changes',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_regLog_actor',
          max: 200,
          min: 0,
          name: 'actor',
          pattern: '',
          presentable: true,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_regLog_ip',
          max: 100,
          min: 0,
          name: 'ipAddress',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'autodate_regLog_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        // "Verlauf" of one number or one holder.
        'CREATE INDEX `idx_regLog_record` ON `registerLog` (`recordId`, `created`)',
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('registerLog')
    return app.delete(collection)
  }
)
