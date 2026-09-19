// permanent-numbers-core.js — the Dauernummer register: import and materialisation.
//
// Plain module, loaded via require() from inside handlers (see CLAUDE.md: handlers cannot see
// their file's module scope). Every function takes the app to write through (`$app` or a
// transaction's `txApp`) as an argument so the routes decide about transactions and dry runs.
//
// Two operations, deliberately separate:
//
//   importRegister      the one-off load of the register itself — holders and their numbers,
//                       no event involved. Idempotent over the (variation, number) unique index.
//   materialiseRegister for one event: turn every `aktiv` register row whose variation belongs
//                       to the event's category into an ordinary registered sellerNumbers row,
//                       with sellerDetails.permanentNumberHolder set. That single relation is
//                       what makes the export say `dnr`.
//
// Neither sends mail: the holders confirmed outside this system (or, later, through the
// confirmation cycle, which has its own mails).
//
// Plan and case rules: seller-number-integration.md §1.6 and §1.8 in the KKM-legacy repo.

const MAX_HOLDERS_PER_IMPORT = 1000
const MAX_NAME_LENGTH = 100
const NUMBER_RE = /^[0-9]{1,6}$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// kkm-db-v2-datamodel.md §"Namens-Hashes": lowercase, umlauts transliterated, NFD with the
// combining marks dropped (José → jose), then everything outside [a-z0-9] removed — whitespace
// and punctuation included. The hash is a join key across systems, so this must not drift:
// KKM-legacy's backfill_statistics.py computes the same, and the test vectors live in the KKM
// plan §1.1. The NFC step first only matters for names that arrive decomposed (u + U+0308),
// which the umlaut replacement would otherwise miss.
const normaliseName = (value) =>
  String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const CONTACT_CHANNELS = ['email', 'whatsapp']

const sha256Hex = (text) => $security.sha256(text)

const nameHash = (value) => sha256Hex(normaliseName(value))

// Records a holder's hashes on the record itself. Used by the record hook in
// permanent-numbers.pb.js (admin-UI edits) and by the import (so a dry run classifies with the
// same keys the real run stores).
const applyHolderHashes = (record) => {
  record.set('holderFirstNameHash', nameHash(record.get('holderFirstName')))
  record.set('holderLastNameHash', nameHash(record.get('holderLastName')))
}

// The channel rule, enforced where admin-UI edits arrive too: an e-mail holder needs an
// address. A WhatsApp holder should have a phone number but may lack one (reached through the
// team) — that is a warning for the report, not a refusal. An unset channel is e-mail, the
// default that existed before the field did.
const applyHolderContact = (record) => {
  const channel = record.get('holderContactChannel') || 'email'
  record.set('holderContactChannel', channel)
  if (channel === 'email' && !String(record.get('holderEmail') || '').trim()) {
    throw new BadRequestError('holderEmail is required unless holderContactChannel is "whatsapp"')
  }
}

// What the report should warn about for a holder: nothing, "manual confirmation" for a
// WhatsApp holder, "no contact on file" when not even a phone number is known.
const holderWarning = (holder) => {
  if ((holder.get('holderContactChannel') || 'email') !== 'whatsapp') return ''
  return String(holder.get('holderPhone') || '').trim() ? 'manualConfirmation' : 'noContactOnFile'
}

// A dry run walks the real write path inside a transaction and then rolls it back by throwing;
// the result was captured before the throw. The flag, not the error object, tells the two
// apart — an error thrown through the Go boundary does not come back as the same JS instance.
const runMaybeDry = (app, dryRun, work) => {
  let result = null
  let rolledBack = false
  try {
    app.runInTransaction((txApp) => {
      result = work(txApp)
      if (dryRun) {
        rolledBack = true
        throw new Error('dry run: rolling back')
      }
    })
  } catch (error) {
    if (rolledBack) return result
    throw error
  }
  return result
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const validationError = (message) => {
  const error = new Error(message)
  error.status = 400
  return error
}

// One import row → a clean object, or a thrown 400 naming the row.
const cleanHolderRow = (row, index, variationsById) => {
  const where = `holders[${index}]`
  if (!row || typeof row !== 'object') throw validationError(`${where}: not an object`)

  const number = String(row.number === undefined ? '' : row.number).trim()
  if (!NUMBER_RE.test(number)) throw validationError(`${where}.number: must be a small integer`)

  const variation = String(row.variation || '').trim()
  if (!variationsById[variation]) {
    throw validationError(`${where}.variation: unknown sellerNumberVariations id "${variation}"`)
  }

  const firstName = String(row.firstName || '').trim()
  const lastName = String(row.lastName || '').trim()
  if (!firstName || firstName.length > MAX_NAME_LENGTH) {
    throw validationError(`${where}.firstName: required, at most ${MAX_NAME_LENGTH} characters`)
  }
  if (!lastName || lastName.length > MAX_NAME_LENGTH) {
    throw validationError(`${where}.lastName: required, at most ${MAX_NAME_LENGTH} characters`)
  }

  const contactChannel = String(row.contactChannel || 'email').trim()
  if (!CONTACT_CHANNELS.includes(contactChannel)) {
    throw validationError(`${where}.contactChannel: one of ${CONTACT_CHANNELS.join(', ')}`)
  }

  const email = String(row.email || '')
    .trim()
    .toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError(`${where}.email: must look like an address`)
  }
  if (contactChannel === 'email' && !email) {
    throw validationError(`${where}.email: required unless contactChannel is "whatsapp"`)
  }

  // A WhatsApp holder may arrive without a number: three AZB staff are reached indirectly
  // through the team, and the register keeps them with a warning rather than refusing them.
  const phone = String(row.phone || '').trim()
  if (phone.length > 50) throw validationError(`${where}.phone: at most 50 characters`)

  const heldSince = row.heldSince === undefined || row.heldSince === null || row.heldSince === ''
    ? ''
    : String(row.heldSince).slice(0, 10)
  if (heldSince && !ISO_DATE_RE.test(heldSince)) {
    throw validationError(`${where}.heldSince: YYYY-MM-DD or empty`)
  }

  return {
    number: parseInt(number, 10),
    variation,
    firstName,
    lastName,
    email,
    phone,
    contactChannel,
    isStaff: row.isStaff === true,
    heldSince,
  }
}

const loadVariationsById = (app) => {
  const byId = {}
  const variations = app.findRecordsByFilter('sellerNumberVariations', 'id != ""', '', 0, 0) || []
  for (const variation of variations) byId[variation.get('id')] = variation
  return byId
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

// importRegister(app, { holders, dryRun }) → { dryRun, counts, results }
//
// Per row: reuse the holder whose email and both name hashes match, else create one; then find
// the (variation, number) row — same holder: `already`; other holder: `conflict` (reported,
// never overwritten); none: `created`. The whole import runs in one transaction; a dry run
// walks the identical path and rolls back.
const importRegister = (app, { holders, dryRun }) => {
  if (!Array.isArray(holders) || holders.length === 0) {
    throw validationError('holders: non-empty array required')
  }
  if (holders.length > MAX_HOLDERS_PER_IMPORT) {
    throw validationError(`holders: at most ${MAX_HOLDERS_PER_IMPORT} rows per import`)
  }
  const variationsById = loadVariationsById(app)
  const rows = holders.map((row, index) => cleanHolderRow(row, index, variationsById))

  // Duplicate (variation, number) inside one body is a list error, not a register state.
  const seen = {}
  for (const row of rows) {
    const key = `${row.variation}:${row.number}`
    if (seen[key]) throw validationError(`holders: number ${row.number} appears twice for the same variation`)
    seen[key] = true
  }

  return runMaybeDry(app, dryRun === true, (txApp) => {
    const holdersCollection = txApp.findCollectionByNameOrId('permanentNumberHolders')
    const numbersCollection = txApp.findCollectionByNameOrId('permanentNumbers')
    const counts = { created: 0, already: 0, conflict: 0, holdersCreated: 0, holdersReused: 0 }
    const results = []
    // Holders created in this run, keyed like the lookup, so two numbers of one person share one row.
    const holdersThisRun = {}

    // A person is the same person when name hashes and contact match — the address on the
    // e-mail channel, the phone number on WhatsApp, where there is no address to compare.
    const holderKey = (row) => {
      const firstHash = nameHash(row.firstName)
      const lastHash = nameHash(row.lastName)
      const contact = row.contactChannel === 'whatsapp' ? row.phone : row.email
      return { key: `${row.contactChannel}|${contact}|${firstHash}|${lastHash}`, firstHash, lastHash, contact }
    }

    // Lookup only — a holder is created no earlier than the number that needs it, so a
    // conflicting row leaves no orphan person behind.
    const findHolder = (row) => {
      const { key, firstHash, lastHash, contact } = holderKey(row)
      if (holdersThisRun[key]) return holdersThisRun[key]
      const contactField = row.contactChannel === 'whatsapp' ? 'holderPhone' : 'holderEmail'
      const existing =
        txApp.findRecordsByFilter(
          'permanentNumberHolders',
          `holderContactChannel = {:channel} && ${contactField} = {:contact} && holderFirstNameHash = {:firstHash} && holderLastNameHash = {:lastHash}`,
          '',
          1,
          0,
          { channel: row.contactChannel, contact, firstHash, lastHash }
        ) || []
      if (existing.length > 0) holdersThisRun[key] = existing[0]
      return existing.length > 0 ? existing[0] : null
    }

    const createHolder = (row) => {
      const holder = new Record(holdersCollection)
      holder.set('holderFirstName', row.firstName)
      holder.set('holderLastName', row.lastName)
      holder.set('holderEmail', row.email)
      holder.set('holderPhone', row.phone)
      holder.set('holderContactChannel', row.contactChannel)
      holder.set('isStaff', row.isStaff)
      applyHolderHashes(holder)
      txApp.save(holder)
      holdersThisRun[holderKey(row).key] = holder
      return holder
    }

    for (const row of rows) {
      const existing =
        txApp.findRecordsByFilter(
          'permanentNumbers',
          'sellerNumberVariation = {:variation} && permanentNumberNumber = {:number}',
          '',
          1,
          0,
          { variation: row.variation, number: row.number }
        ) || []

      const base = {
        number: row.number,
        variation: row.variation,
        variationName: variationsById[row.variation].get('sellerNumberVariationName'),
      }

      if (existing.length > 0) {
        const current = existing[0]
        const holder = findHolder(row)
        if (holder && current.get('holder') === holder.get('id')) {
          counts.already += 1
          counts.holdersReused += 1
          results.push(Object.assign(base, { result: 'already', holderId: holder.get('id'), permanentNumberId: current.get('id'), status: current.get('status') }))
        } else {
          counts.conflict += 1
          let otherName = ''
          try {
            const other = txApp.findRecordById('permanentNumberHolders', current.get('holder'))
            otherName = `${other.get('holderFirstName')} ${other.get('holderLastName')}`
          } catch (error) {
            otherName = '(holder missing)'
          }
          results.push(
            Object.assign(base, {
              result: 'conflict',
              holderId: holder ? holder.get('id') : null,
              permanentNumberId: current.get('id'),
              status: current.get('status'),
              existingHolderId: current.get('holder'),
              existingHolderName: otherName,
              reason: 'number is registered to a different holder; not overwritten',
            })
          )
        }
        continue
      }

      let holder = findHolder(row)
      if (holder) {
        counts.holdersReused += 1
      } else {
        holder = createHolder(row)
        counts.holdersCreated += 1
      }

      const record = new Record(numbersCollection)
      record.set('sellerNumberVariation', row.variation)
      record.set('permanentNumberNumber', row.number)
      record.set('holder', holder.get('id'))
      record.set('status', 'aktiv')
      if (row.heldSince) record.set('heldSince', `${row.heldSince} 00:00:00.000Z`)
      txApp.save(record)
      counts.created += 1
      results.push(Object.assign(base, { result: 'created', holderId: holder.get('id'), permanentNumberId: record.get('id'), heldSince: row.heldSince }))
    }

    return { dryRun: dryRun === true, counts, results }
  })
}

// ---------------------------------------------------------------------------
// Materialisation
// ---------------------------------------------------------------------------

// materialiseRegister(app, { eventId, source, dryRun, now }) → { dryRun, event, counts, results }
//
// `source: "register"` (the October bridge) takes every `aktiv` row whose variation belongs to
// the event's category. `source: "confirmations"` is Phase 1 — confirmed answers only — and is
// refused until that collection exists.
//
// Per register row (§1.6): resolve the event's pool for the variation → number must lie in the
// pool's declared range → look at the existing sellerNumbers row at (pool, number):
//   sellerDetails with this holder          → already
//   sellerDetails with other/no holder      → conflict (someone got the number; never overwrite)
//   no sellerDetails (dead hold)            → delete, then create
//   no row                                  → create
const materialiseRegister = (app, { eventId, source, dryRun, now }) => {
  const { resolveNumbers, orFilterForIds } = require(`${__hooks}/status-core.js`)

  if (!eventId || !/^[a-z0-9]{15}$/.test(String(eventId))) throw validationError('eventId is required')
  if (source === 'confirmations') {
    const error = new Error('source "confirmations" arrives with the confirmation cycle (Phase 1); use "register"')
    error.status = 501
    throw error
  }
  if (source !== 'register') throw validationError('source must be "register"')

  let event
  try {
    event = app.findRecordById('events', eventId)
  } catch (error) {
    const notFound = new Error('Event not found')
    notFound.status = 404
    throw notFound
  }

  const pools = app.findRecordsByFilter('sellerNumberPools', 'event = {:eventId}', '', 0, 0, { eventId }) || []
  if (pools.length === 0) {
    const error = new Error('No seller number pools found for this event')
    error.status = 404
    throw error
  }
  const poolByVariation = {}
  const numbersByPool = {}
  for (const pool of pools) {
    const variationId = pool.get('sellerNumberVariation')
    if (poolByVariation[variationId]) {
      throw validationError(`event has two pools for variation ${variationId}; materialise cannot pick one`)
    }
    poolByVariation[variationId] = pool
    try {
      numbersByPool[pool.get('id')] = resolveNumbers(JSON.parse(pool.get('numbersAsJsonArray') || '[]'))
    } catch (error) {
      throw validationError(`pool ${pool.get('id')}: numbersAsJsonArray is not valid JSON`)
    }
  }
  const variationIds = Object.keys(poolByVariation)
  const variationsById = {}
  for (const variation of app.findRecordsByFilter('sellerNumberVariations', orFilterForIds('id', variationIds), '', 0, 0) || []) {
    variationsById[variation.get('id')] = variation
  }

  const registerRows =
    app.findRecordsByFilter(
      'permanentNumbers',
      `status = "aktiv" && (${orFilterForIds('sellerNumberVariation', variationIds)})`,
      'permanentNumberNumber',
      0,
      0
    ) || []

  const timestamp = (now || new Date()).toISOString()

  return runMaybeDry(app, dryRun === true, (txApp) => {
    const detailsCollection = txApp.findCollectionByNameOrId('sellerDetails')
    const sellerNumbersCollection = txApp.findCollectionByNameOrId('sellerNumbers')
    const counts = { created: 0, already: 0, conflict: 0, notInPool: 0, skipped: 0, deadHoldsReplaced: 0 }
    const results = []

    for (const row of registerRows) {
      const number = row.get('permanentNumberNumber')
      const variationId = row.get('sellerNumberVariation')
      const pool = poolByVariation[variationId]
      const variation = variationsById[variationId]
      const base = {
        number,
        variation: variationId,
        variationName: variation ? variation.get('sellerNumberVariationName') : null,
        permanentNumberId: row.get('id'),
        holderId: row.get('holder'),
      }

      let holder
      try {
        holder = txApp.findRecordById('permanentNumberHolders', row.get('holder'))
      } catch (error) {
        counts.skipped += 1
        results.push(Object.assign(base, { result: 'skipped', reason: 'holder record missing' }))
        continue
      }
      // Visible in the dry-run report: a WhatsApp holder gets no confirmation mail, the
      // operator confirms by hand (§1.8); without a number the team has to be asked.
      base.contactChannel = holder.get('holderContactChannel') || 'email'
      const warning = holderWarning(holder)
      if (warning) base.warning = warning

      if (!numbersByPool[pool.get('id')].includes(number)) {
        counts.notInPool += 1
        results.push(
          Object.assign(base, {
            result: 'notInPool',
            poolId: pool.get('id'),
            reason: 'number is outside the pool\'s declared range; extend numbersAsJsonArray first',
          })
        )
        continue
      }

      const existingRows =
        txApp.findRecordsByFilter(
          'sellerNumbers',
          'sellerNumberPool = {:poolId} && sellerNumberNumber = {:number}',
          '',
          0,
          0,
          { poolId: pool.get('id'), number }
        ) || []

      let replacedDeadHold = false
      let conflict = null
      for (const existing of existingRows) {
        const detailsId = existing.get('sellerDetails')
        if (!detailsId) {
          // A reservation that never completed registration; the same move as reservation.pb.js.
          txApp.delete(existing)
          replacedDeadHold = true
          continue
        }
        let details = null
        try {
          details = txApp.findRecordById('sellerDetails', detailsId)
        } catch (error) {
          details = null
        }
        if (details && details.get('permanentNumberHolder') === holder.get('id')) {
          conflict = { already: true, sellerNumberId: existing.get('id'), sellerDetailsId: detailsId }
        } else {
          conflict = {
            already: false,
            sellerNumberId: existing.get('id'),
            sellerDetailsId: detailsId,
            registeredName: details ? `${details.get('sellerFirstName')} ${details.get('sellerLastName')}` : '(details missing)',
            registeredHolderId: details ? details.get('permanentNumberHolder') || null : null,
          }
        }
        break
      }

      if (conflict && conflict.already) {
        counts.already += 1
        results.push(Object.assign(base, { result: 'already', sellerNumberId: conflict.sellerNumberId, sellerDetailsId: conflict.sellerDetailsId }))
        continue
      }
      if (conflict) {
        counts.conflict += 1
        results.push(
          Object.assign(base, {
            result: 'conflict',
            sellerNumberId: conflict.sellerNumberId,
            sellerDetailsId: conflict.sellerDetailsId,
            registeredName: conflict.registeredName,
            registeredHolderId: conflict.registeredHolderId,
            reason: 'someone completed registration on this number; not overwritten',
          })
        )
        continue
      }

      const details = new Record(detailsCollection)
      details.set('sellerFirstName', holder.get('holderFirstName'))
      details.set('sellerLastName', holder.get('holderLastName'))
      details.set('sellerEmail', holder.get('holderEmail') || '')
      details.set('sellerPhone', holder.get('holderPhone') || '')
      details.set('ipAddress', '')
      details.set('deviceUuid', '')
      details.set('isStaff', holder.get('isStaff') === true)
      details.set('permanentNumberHolder', holder.get('id'))
      txApp.save(details)

      const sellerNumber = new Record(sellerNumbersCollection)
      sellerNumber.set('sellerNumberNumber', number)
      sellerNumber.set('sellerNumberPool', pool.get('id'))
      sellerNumber.set('reservedAt', timestamp)
      sellerNumber.set('sellerDetails', details.get('id'))
      txApp.save(sellerNumber)

      counts.created += 1
      if (replacedDeadHold) counts.deadHoldsReplaced += 1
      results.push(
        Object.assign(base, {
          result: 'created',
          sellerNumberId: sellerNumber.get('id'),
          sellerDetailsId: details.get('id'),
          replacedDeadHold,
        })
      )
    }

    return {
      dryRun: dryRun === true,
      event: { id: event.get('id'), eventName: event.get('eventName'), eventDate: event.get('eventDate') },
      registerRows: registerRows.length,
      counts,
      results,
    }
  })
}

module.exports = {
  MAX_HOLDERS_PER_IMPORT,
  normaliseName,
  nameHash,
  sha256Hex,
  applyHolderHashes,
  applyHolderContact,
  holderWarning,
  importRegister,
  materialiseRegister,
}
