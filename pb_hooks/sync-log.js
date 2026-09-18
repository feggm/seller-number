// sync-log.js — one append-only row per synchronisation in or out of this instance.
//
// writeSyncLog never throws: a failed log entry must not turn a served export into a 500. The
// entry carries counters and case classes only — the caller passes a `summary` it has already
// stripped of names, emails and rows.
//
// Plain module, loaded via require() from inside handlers.

const KINDS = [
  'export-assignment',
  'export-events',
  'export-ack',
  'permanent-numbers-import',
  'permanent-numbers-materialise',
]

const clientLabel = (e) => {
  const authRecord = e && e.auth
  if (!authRecord) return ''
  const collectionName = authRecord.collection().name
  if (collectionName === '_superusers') return 'superuser'
  return String(authRecord.get('email') || collectionName)
}

// writeSyncLog(app, { direction, kind, eventId?, client?, mode?, checksum?, rowCount?, dryRun?,
//                     status, summary?, ipAddress?, startedAt?, finishedAt? }) → record id or null
const writeSyncLog = (app, entry) => {
  try {
    if (!KINDS.includes(entry.kind)) throw new Error(`unknown kind ${entry.kind}`)
    const collection = app.findCollectionByNameOrId('syncLog')
    const record = new Record(collection)
    record.set('direction', entry.direction === 'in' ? 'in' : 'out')
    record.set('kind', entry.kind)
    if (entry.eventId) record.set('event', entry.eventId)
    record.set('client', String(entry.client || '').slice(0, 200))
    record.set('mode', String(entry.mode || '').slice(0, 10))
    if (entry.checksum && /^[a-f0-9]{64}$/.test(entry.checksum)) record.set('checksum', entry.checksum)
    if (typeof entry.rowCount === 'number' && entry.rowCount >= 0) record.set('rowCount', Math.floor(entry.rowCount))
    record.set('dryRun', entry.dryRun === true)
    record.set('status', entry.status === 'error' ? 'error' : 'ok')
    if (entry.summary !== undefined) record.set('summary', entry.summary)
    record.set('ipAddress', String(entry.ipAddress || '').slice(0, 100))
    const finishedAt = entry.finishedAt || new Date()
    record.set('startedAt', (entry.startedAt || finishedAt).toISOString())
    record.set('finishedAt', finishedAt.toISOString())
    app.save(record)
    return record.get('id')
  } catch (error) {
    $app.logger().warn('syncLog: entry not written', 'kind', entry && entry.kind, 'error', error && error.message)
    return null
  }
}

// Kinds that are not about one event; an eventId filter must not hide them.
const EVENTLESS_KINDS = ['export-events', 'permanent-numbers-import']

// The newest real (non-dry-run) entry per kind, optionally for one event — what a status
// widget shows. Dry runs are rehearsals and stay in the admin UI's full list.
const latestPerKind = (app, eventId) => {
  const latest = {}
  for (const kind of KINDS) {
    const byEvent = eventId && !EVENTLESS_KINDS.includes(kind)
    const filter = byEvent
      ? 'kind = {:kind} && dryRun = false && event = {:eventId}'
      : 'kind = {:kind} && dryRun = false'
    let rows = []
    try {
      rows = app.findRecordsByFilter('syncLog', filter, '-finishedAt', 1, 0, { kind, eventId: eventId || '' }) || []
    } catch (error) {
      rows = []
    }
    const row = rows[0]
    latest[kind] = row
      ? {
          direction: row.get('direction'),
          status: row.get('status'),
          finishedAt: row.get('finishedAt'),
          client: row.get('client'),
          mode: row.get('mode'),
          checksum: row.get('checksum') || null,
          rowCount: row.get('rowCount'),
          eventId: row.get('event') || null,
          summary: row.get('summary'),
        }
      : null
  }
  return latest
}

module.exports = {
  KINDS,
  clientLabel,
  writeSyncLog,
  latestPerKind,
}
