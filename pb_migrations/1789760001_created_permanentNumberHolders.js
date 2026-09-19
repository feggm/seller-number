/// <reference path="../pb_data/types.d.ts" />

// permanentNumberHolders — the durable person behind a Dauernummer.
//
// sellerDetails is created fresh on every registration and is a per-event artefact, not an
// identity. The register keeps the person here and writes sellerDetails as a projection when it
// materialises a number for an event (permanent-numbers-core.js). Superuser-only on all five
// rules: names, emails and phones of people who did not register through the public flow.
//
// The name hashes follow the kkm-db v2 data model (normalised: trim, lowercase, ä→ae ö→oe ü→ue
// ß→ss, punctuation dropped, then sha256). The legacy path does not read them; they are kept
// current by a record hook so the v2 status flow finds them ready.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'permanentNumberHolders',
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
          autogeneratePattern: '',
          hidden: false,
          id: 'text_pnHolders_firstName',
          max: 100,
          min: 0,
          name: 'holderFirstName',
          pattern: '',
          presentable: true,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_pnHolders_lastName',
          max: 100,
          min: 0,
          name: 'holderLastName',
          pattern: '',
          presentable: true,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          exceptDomains: null,
          hidden: false,
          id: 'email_pnHolders_email',
          name: 'holderEmail',
          onlyDomains: null,
          presentable: false,
          required: true,
          system: false,
          type: 'email',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_pnHolders_phone',
          max: 50,
          min: 0,
          name: 'holderPhone',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_pnHolders_firstNameHash',
          max: 64,
          min: 0,
          name: 'holderFirstNameHash',
          pattern: '^[a-f0-9]{64}$',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_pnHolders_lastNameHash',
          max: 64,
          min: 0,
          name: 'holderLastNameHash',
          pattern: '^[a-f0-9]{64}$',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'bool_pnHolders_isStaff',
          name: 'isStaff',
          presentable: false,
          required: false,
          system: false,
          type: 'bool',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_pnHolders_note',
          max: 500,
          min: 0,
          name: 'holderNote',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'autodate_pnHolders_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
        {
          hidden: false,
          id: 'autodate_pnHolders_updated',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        // Not unique: two people in one household may share an address. The import dedupes on
        // email + name hashes, and the hash index is what the v2 flow will join on.
        'CREATE INDEX `idx_pnHolders_email` ON `permanentNumberHolders` (`holderEmail`)',
        'CREATE INDEX `idx_pnHolders_lastNameHash` ON `permanentNumberHolders` (`holderLastNameHash`)',
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('permanentNumberHolders')
    return app.delete(collection)
  }
)
