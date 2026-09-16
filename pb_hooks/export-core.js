// Shared export core.
//
// Builds the seller assignment of one event — the rows that become the KKM cash-desk
// Basisdaten — once, and renders it two ways: as the CSV that the human download
// (`csv-export.pb.js`) hands out, and as the JSON envelope with the same CSV embedded that the
// KKM admin pulls (`export-assignment.pb.js`). Both go through `buildAssignment` + `toCsv`, so
// the download and the envelope carry identical bytes.
//
// Plain `.js` module — it registers no routes and is pulled in via
// `require(`${__hooks}/export-core.js`)`.
//
// The CSV header is a contract: the consumer validates it as list equality and the column
// order is positional on that side. Do not reorder, rename, or add columns without a
// `schemaVersion` bump in `export-assignment.pb.js`.

const SCHEMA_VERSION = 1

const EXPECTED_HEADERS = {
  kkm: [
    'nr',
    'dnr',
    'babynr',
    'name',
    'vorname',
    'Strasse',
    'plz',
    'ort',
    'tel',
    'email',
    'interesse_dnr',
    'neu',
    'ma',
  ],
  azb: ['nr', 'name', 'vorname', 'ab-status', 'tel', 'email', 'ma'],
}

// The consumer's `Personen` columns are VARCHAR(45); longer values are truncated or rejected
// there depending on sql_mode, so they are flagged here.
const MAX_FIELD_LENGTH = 45

// sellerDetails ids are joined into one literal OR filter; SQLite has an expression-depth
// limit, so the lookup runs in chunks.
const DETAILS_CHUNK = 200

const MAX_LIMIT = 5000

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Both export routes accept a superuser (a person with curl) or an `apiClients` record (the KKM
// host). Nothing else in the API accepts `apiClients`; that collection's rules are all null.
const isExportClient = (e) => {
  const authRecord = e.auth
  const collectionName = authRecord ? authRecord.collection().name : null
  return collectionName === '_superusers' || collectionName === 'apiClients'
}

// Verbatim from the original csv-export.pb.js — the consumer's csv.reader honours exactly this.
const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return '"' + stringValue.replace(/"/g, '""') + '"'
  }
  return stringValue
}

const sha256Hex = (text) => $security.sha256(text)

// `babynr` comes from the variation's name, not a flag: the production variation is called
// "Babynummer" and there is exactly one. A rename shows up on the consumer side as every baby
// row "changed", which is the intended alarm.
const isBabyVariation = (variation) =>
  /baby/i.test(String(variation ? variation.get('sellerNumberVariationName') || '' : ''))

// "2026-11-14 13:00:00.000Z" → "2026-Nov", in Europe/Berlin. This names the consumer's
// Basisdaten file (`<mode>_db_basisdaten_<YYYY-Mon>.sql`); the month of the market day is the
// convention there, and no month carries two markets.
const yearMonthOf = (eventDate) => {
  const { formatBerlin } = require(`${__hooks}/berlin-time.js`)
  const formatted = formatBerlin(eventDate)
  if (!formatted) return null
  const year = formatted.local.slice(0, 4)
  const monthIndex = parseInt(formatted.local.slice(5, 7), 10) - 1
  if (!(monthIndex >= 0 && monthIndex < 12)) return null
  return year + '-' + MONTHS[monthIndex]
}

// Errors the routes translate into HTTP status codes.
const exportError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const findOrEmpty = (collection, filter, sort, params) => {
  try {
    return $app.findRecordsByFilter(collection, filter, sort || '', 0, 0, params) || []
  } catch (error) {
    $app.logger().warn('export: query failed', 'collection', collection, 'error', error.message)
    return []
  }
}

// Load one event's assignment: every seller number in the event's pools that has completed
// registration, joined to its sellerDetails and its pool's variation.
//
// Returns { event, category, rows, warnings, totalRows, truncated }. `rows` is sorted by
// number; `limit`/`offset` slice it (default: everything).
const buildAssignment = ({ eventId, mode, now, limit, offset }) => {
  const { orFilterForIds } = require(`${__hooks}/status-core.js`)

  if (!eventId) throw exportError(400, 'eventId is required')
  if (!EXPECTED_HEADERS[mode]) throw exportError(400, 'mode must be either "kkm" or "azb"')

  let event
  try {
    event = $app.findRecordById('events', eventId)
  } catch (error) {
    throw exportError(404, 'Event not found')
  }

  const pools = findOrEmpty('sellerNumberPools', 'event = {:eventId}', '', { eventId })
  if (pools.length === 0) {
    throw exportError(404, 'No seller number pools found for this event')
  }

  const variationIds = [...new Set(pools.map((pool) => pool.get('sellerNumberVariation')))].filter(
    (id) => !!id
  )
  const variations = variationIds.length
    ? findOrEmpty('sellerNumberVariations', orFilterForIds('id', variationIds))
    : []
  const variationsById = {}
  for (const variation of variations) variationsById[variation.get('id')] = variation

  const poolsById = {}
  for (const pool of pools) poolsById[pool.get('id')] = pool

  const sellerNumbers = findOrEmpty(
    'sellerNumbers',
    orFilterForIds('sellerNumberPool', pools.map((pool) => pool.get('id'))),
    'sellerNumberNumber'
  ).filter((sellerNumber) => !!sellerNumber.get('sellerDetails'))

  // sellerDetails in one query per 200 ids instead of one per row.
  const detailsById = {}
  const detailIds = [...new Set(sellerNumbers.map((sn) => sn.get('sellerDetails')))]
  for (let i = 0; i < detailIds.length; i += DETAILS_CHUNK) {
    const chunk = detailIds.slice(i, i + DETAILS_CHUNK)
    for (const details of findOrEmpty('sellerDetails', orFilterForIds('id', chunk))) {
      detailsById[details.get('id')] = details
    }
  }

  const warnings = []
  const rows = []
  const seenNumbers = {}

  for (const sellerNumber of sellerNumbers) {
    const detailsId = sellerNumber.get('sellerDetails')
    const details = detailsById[detailsId]
    const nr = sellerNumber.get('sellerNumberNumber')

    if (!details) {
      // The relation points at a record that is gone. The original export skipped these
      // silently; the consumer should know a registered number is missing from the file.
      warnings.push({ code: 'missing_seller_details', nr, key: sellerNumber.get('id') })
      continue
    }

    const pool = poolsById[sellerNumber.get('sellerNumberPool')]
    const variation = pool ? variationsById[pool.get('sellerNumberVariation')] : null

    const row = {
      key: sellerNumber.get('id'),
      sellerDetailsId: detailsId,
      nr,
      // Set only on rows the Dauernummer register materialised. The field arrives with the
      // register; until then `get()` yields nothing and dnr stays false.
      dnr: !!details.get('dauernummerHolder'),
      babynr: isBabyVariation(variation),
      // Deliberately never derived here: "first market for this seller" is a question about
      // fifteen years of history the cash-desk side holds (hash comparison per event category).
      // PocketBase only remembers events since 2025 and would call almost everyone new.
      neu: false,
      ma: !!details.get('isStaff'),
      name: String(details.get('sellerLastName') || ''),
      vorname: String(details.get('sellerFirstName') || ''),
      tel: String(details.get('sellerPhone') || ''),
      email: String(details.get('sellerEmail') || ''),
    }

    // Two pools of one event handing out the same number would break the consumer's load
    // mid-file (its primary key is (Verkaufsnummer, Veranstaltungs_ID)).
    if (seenNumbers[nr]) {
      warnings.push({ code: 'duplicate_number', nr, keys: [seenNumbers[nr], row.key] })
    } else {
      seenNumbers[nr] = row.key
    }

    for (const field of ['name', 'vorname', 'tel', 'email']) {
      const value = row[field]
      if (value.length > MAX_FIELD_LENGTH) {
        warnings.push({ code: 'value_too_long', nr, field, length: value.length })
      }
      // The consumer's SQL escaping does not handle backslashes.
      if (value.includes('\\')) {
        warnings.push({ code: 'unsafe_sql_char', nr, field })
      }
    }

    rows.push(row)
  }

  // Phase 1 adds: dn_not_materialised (a Dauernummer in `aktiv` without a completed row),
  // compensation_capped / compensation_collision.

  const totalRows = rows.length
  const start = offset > 0 ? offset : 0
  const end = limit > 0 ? start + limit : totalRows
  const slice = rows.slice(start, end)

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: (now || new Date()).toISOString(),
    mode,
    rowCount: slice.length,
    truncated: slice.length !== totalRows,
    event: {
      id: event.get('id'),
      eventName: event.get('eventName'),
      eventDate: event.get('eventDate'),
      yearMonth: yearMonthOf(event.get('eventDate')),
    },
    csvHeader: EXPECTED_HEADERS[mode].join(','),
    warnings,
    rows: slice,
  }
}

// Render the CSV the consumer's csv_import.py reads: exact header, one line per row, flags as
// D/B/N/M or empty, address columns and `interesse_dnr` deliberately empty, "\n" line ends.
const toCsv = (assignment) => {
  const header = EXPECTED_HEADERS[assignment.mode]
  const lines = [header.join(',')]

  for (const row of assignment.rows) {
    const cells =
      assignment.mode === 'kkm'
        ? [
            escapeCsvValue(row.nr), // nr
            row.dnr ? 'D' : '', // dnr
            row.babynr ? 'B' : '', // babynr
            escapeCsvValue(row.name), // name
            escapeCsvValue(row.vorname), // vorname
            '', // Strasse (not collected)
            '', // plz (not collected)
            '', // ort (not collected)
            escapeCsvValue(row.tel), // tel
            escapeCsvValue(row.email), // email
            '', // interesse_dnr (never read by the consumer)
            row.neu ? 'N' : '', // neu
            row.ma ? 'M' : '', // ma
          ]
        : [
            escapeCsvValue(row.nr), // nr
            escapeCsvValue(row.name), // name
            escapeCsvValue(row.vorname), // vorname
            '', // ab-status (not collected)
            escapeCsvValue(row.tel), // tel
            escapeCsvValue(row.email), // email
            row.ma ? 'M' : '', // ma
          ]
    lines.push(cells.join(','))
  }

  return lines.join('\n') + '\n'
}

// The envelope the KKM admin pulls: the assignment plus the CSV it will commit and the
// checksum that ties the two together (and becomes the preview token on the consumer side).
const toEnvelope = (assignment) => {
  const csv = toCsv(assignment)
  return Object.assign({}, assignment, { checksum: sha256Hex(csv), csv })
}

module.exports = {
  SCHEMA_VERSION,
  EXPECTED_HEADERS,
  MAX_LIMIT,
  isExportClient,
  escapeCsvValue,
  sha256Hex,
  isBabyVariation,
  yearMonthOf,
  buildAssignment,
  toCsv,
  toEnvelope,
}
