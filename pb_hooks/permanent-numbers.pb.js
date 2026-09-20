// Dauernummer register routes — superuser only, no public surface.
//
//   POST /api/seller-number/permanent-numbers/import       { dryRun, holders: [{number, variation, firstName, lastName, email?, phone?, contactChannel?, isStaff?, heldSince?}] }
//   POST /api/seller-number/permanent-numbers/materialise  { eventId, source: "register", dryRun }
//
// Both run the real write path inside one transaction and roll it back on dryRun, so the dry
// run's report is exactly what the real run would do. Both write a syncLog entry (counters
// only). The logic lives in permanent-numbers-core.js; see seller-number-integration.md §1.6 /
// §1.8 in the KKM-legacy repo for the case rules.

routerAdd('POST', '/api/seller-number/permanent-numbers/import', (e) => {
  const core = require(`${__hooks}/permanent-numbers-core.js`)
  const syncLog = require(`${__hooks}/sync-log.js`)

  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== '_superusers') {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  const body = new DynamicModel({ dryRun: false, holders: [] })
  try {
    e.bindBody(body)
  } catch (error) {
    return e.json(400, { error: 'Body must be JSON: { dryRun, holders: [...] }' })
  }
  // DynamicModel hands back a Go-backed array; copy it into plain JS before validating.
  const holders = JSON.parse(JSON.stringify(body.holders || []))
  const dryRun = body.dryRun === true
  const startedAt = new Date()

  try {
    const result = core.importRegister($app, { holders, dryRun })
    syncLog.writeSyncLog($app, {
      direction: 'in',
      kind: 'permanent-numbers-import',
      client: syncLog.clientLabel(e),
      rowCount: holders.length,
      dryRun,
      status: 'ok',
      summary: result.counts,
      ipAddress: e.realIP(),
      startedAt,
    })
    return e.json(200, result)
  } catch (error) {
    const status = error && error.status ? error.status : 500
    if (status === 500) {
      $app.logger().error('permanent-numbers/import failed', 'error', error && error.message)
    }
    syncLog.writeSyncLog($app, {
      direction: 'in',
      kind: 'permanent-numbers-import',
      client: syncLog.clientLabel(e),
      rowCount: holders.length,
      dryRun,
      status: 'error',
      summary: { error: status === 500 ? 'internal error' : String(error.message) },
      ipAddress: e.realIP(),
      startedAt,
    })
    return e.json(status, { error: status === 500 ? 'Internal server error' : error.message })
  }
})

routerAdd('POST', '/api/seller-number/permanent-numbers/materialise', (e) => {
  const core = require(`${__hooks}/permanent-numbers-core.js`)
  const syncLog = require(`${__hooks}/sync-log.js`)

  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== '_superusers') {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  const body = new DynamicModel({ eventId: '', source: 'register', dryRun: false })
  try {
    e.bindBody(body)
  } catch (error) {
    return e.json(400, { error: 'Body must be JSON: { eventId, source, dryRun }' })
  }
  const eventId = String(body.eventId || '')
  const source = String(body.source || 'register')
  const dryRun = body.dryRun === true
  const startedAt = new Date()

  try {
    const result = core.materialiseRegister($app, { eventId, source, dryRun, now: startedAt })
    syncLog.writeSyncLog($app, {
      direction: 'in',
      kind: 'permanent-numbers-materialise',
      eventId,
      client: syncLog.clientLabel(e),
      rowCount: result.registerRows,
      dryRun,
      status: 'ok',
      summary: Object.assign({ source }, result.counts),
      ipAddress: e.realIP(),
      startedAt,
    })
    return e.json(200, result)
  } catch (error) {
    const status = error && error.status ? error.status : 500
    if (status === 500) {
      $app.logger().error('permanent-numbers/materialise failed', 'error', error && error.message)
    }
    syncLog.writeSyncLog($app, {
      direction: 'in',
      kind: 'permanent-numbers-materialise',
      eventId: /^[a-z0-9]{15}$/.test(eventId) ? eventId : '',
      client: syncLog.clientLabel(e),
      dryRun,
      status: 'error',
      summary: { source, error: status === 500 ? 'internal error' : String(error.message) },
      ipAddress: e.realIP(),
      startedAt,
    })
    return e.json(status, { error: status === 500 ? 'Internal server error' : error.message })
  }
})

// Keep the holder name hashes current on every save, admin UI included — the hashes are the
// join key the v2 status flow will use, and a stale one is worse than none. The contact rule
// (address on the e-mail channel, phone on WhatsApp) is checked in the same place.
onRecordCreate((e) => {
  const { applyHolderHashes, applyHolderContact } = require(`${__hooks}/permanent-numbers-core.js`)
  applyHolderContact(e.record)
  applyHolderHashes(e.record)
  e.next()
}, 'permanentNumberHolders')

onRecordUpdate((e) => {
  const { applyHolderHashes, applyHolderContact } = require(`${__hooks}/permanent-numbers-core.js`)
  applyHolderContact(e.record)
  applyHolderHashes(e.record)
  e.next()
}, 'permanentNumberHolders')

// Every edit by a person — Verwaltung page, admin UI, curl — leaves a registerLog row with the
// fields that changed. The request hooks see the account; the register's own routes (import,
// materialise) save through the app and land in syncLog instead. Never blocks the edit.
// The handlers read the collection from the record, not from a closure: module scope is not
// visible at request time (see CLAUDE.md), the loop variable only names the hook filter.
for (const registerCollection of ['permanentNumbers', 'permanentNumberHolders']) {
  onRecordCreateRequest((e) => {
    const log = require(`${__hooks}/register-log.js`)
    const collectionName = e.record.collection().name
    e.next()
    log.writeRegisterLog($app, e, {
      collectionName,
      recordId: e.record.get('id'),
      recordLabel: log.labelFor($app, e.record, collectionName),
      action: 'create',
      before: {},
      after: log.snapshot(e.record, collectionName),
    })
  }, registerCollection)

  onRecordUpdateRequest((e) => {
    const log = require(`${__hooks}/register-log.js`)
    const collectionName = e.record.collection().name
    // The stored row, read before the request is applied — a fresh read, not
    // e.record.original(), which is not reliable across the save.
    let before = {}
    try {
      before = log.snapshot($app.findRecordById(collectionName, e.record.get('id')), collectionName)
    } catch (error) {
      before = {}
    }
    e.next()
    log.writeRegisterLog($app, e, {
      collectionName,
      recordId: e.record.get('id'),
      recordLabel: log.labelFor($app, e.record, collectionName),
      action: 'update',
      before,
      after: log.snapshot(e.record, collectionName),
    })
  }, registerCollection)

  onRecordDeleteRequest((e) => {
    const log = require(`${__hooks}/register-log.js`)
    const collectionName = e.record.collection().name
    const before = log.snapshot(e.record, collectionName)
    const recordId = e.record.get('id')
    const recordLabel = log.labelFor($app, e.record, collectionName)
    e.next()
    log.writeRegisterLog($app, e, { collectionName, recordId, recordLabel, action: 'delete', before, after: {} })
  }, registerCollection)
}
