/// <reference path="../pb_data/types.d.ts" />

// apiClients — machine accounts for the export routes.
//
// The KKM cash-desk host pulls the seller assignment through
// /api/seller-number/export-assignment. Giving that host a superuser password would let it read
// and write every collection; a record here can authenticate and do nothing else: all five API
// rules are null, so it cannot list, view, or even read its own record. Only the export routes
// accept this collection (export-core.js: isExportClient), every other route stays superuser.
//
// passwordAuth only. OAuth2/OTP/MFA are off so the account is exactly one secret. Tokens live
// for an hour — the caller re-authenticates on 401 anyway. authAlert stays on: the caller's IP is
// stable, so a login from anywhere else is worth an email.
//
// Records are created by hand in the admin UI (one per consumer, `note` says which).
migrate(
  (app) => {
    const collection = new Collection({
      type: 'auth',
      name: 'apiClients',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      manageRule: null,
      authRule: '',
      passwordAuth: { enabled: true, identityFields: ['email'] },
      oauth2: { enabled: false, mappedFields: { avatarURL: '', id: '', name: '', username: '' } },
      otp: { enabled: false, duration: 180, length: 8 },
      mfa: { enabled: false, duration: 1800, rule: '' },
      authToken: { duration: 3600 },
      authAlert: { enabled: true },
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
          cost: 0,
          hidden: true,
          id: 'password901924565',
          max: 0,
          min: 16,
          name: 'password',
          pattern: '',
          presentable: false,
          required: true,
          system: true,
          type: 'password',
        },
        {
          autogeneratePattern: '[a-zA-Z0-9]{50}',
          hidden: true,
          id: 'text2504183744',
          max: 60,
          min: 30,
          name: 'tokenKey',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: true,
          system: true,
          type: 'text',
        },
        {
          exceptDomains: null,
          hidden: false,
          id: 'email3885137012',
          name: 'email',
          onlyDomains: null,
          presentable: true,
          required: true,
          system: true,
          type: 'email',
        },
        {
          hidden: false,
          id: 'bool1547992806',
          name: 'emailVisibility',
          presentable: false,
          required: false,
          system: true,
          type: 'bool',
        },
        {
          hidden: false,
          id: 'bool256245529',
          name: 'verified',
          presentable: false,
          required: false,
          system: true,
          type: 'bool',
        },
        {
          autogeneratePattern: '',
          hidden: false,
          id: 'text_apiClients_note',
          max: 200,
          min: 0,
          name: 'note',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'autodate_apiClients_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
        {
          hidden: false,
          id: 'autodate_apiClients_updated',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_tokenKey_apiClients` ON `apiClients` (`tokenKey`)',
        "CREATE UNIQUE INDEX `idx_email_apiClients` ON `apiClients` (`email`) WHERE `email` != ''",
      ],
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('apiClients')
    return app.delete(collection)
  }
)
