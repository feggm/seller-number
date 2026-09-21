// permanent-numbers-statistics.js — the post-market statistics push (Kasse → register).
//
// Plain module, loaded via require() from the route in permanent-numbers.pb.js. The cash desk
// (or the backfill script) sends, per market, two figures for every seller plus the market's
// own means and medians; nothing here carries a name — the sellers travel as sha256 name
// hashes under the exchange normalisation (permanent-numbers-core.js:normaliseName).
//
// What the push does, in order (seller-number-integration.md §1.10):
//   1. resolve every number with a register row to its permanentNumbers record — through the
//      event's pools when there is an event, through the category's variations when the
//      market predates the app (backfill);
//   2. compare the hashes with the current holder: holder | nameChange | mismatch;
//   3. write/overwrite the permanentNumberMarkets row for (number, market), then keep only the
//      newest eight rows per number and holder (the flag reads four, the Verwaltung draws
//      eight);
//   4. write marketStats and marketTopSellers for the market;
//   5. compute the advisory reviewFlag for every touched number: four `holder` rows of the
//      current holder whose mean items AND mean revenue both lie under the median of those
//      markets' medians.
// One transaction; dryRun walks the same path and rolls back.

const MARKET_RE = /^\d{4}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/
const HASH_RE = /^[a-f0-9]{64}$/
const ID_RE = /^[a-z0-9]{15}$/
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
const WINDOW = 4 // markets the review flag reads
const KEEP = 8 // markets kept per number and holder — the Verwaltung's trend chart
const MAX_NUMBERS = 2000
const MAX_TOP = 100

const validationError = (message) => {
  const error = new Error(message)
  error.status = 400
  return error
}

// "2026-Oct" → "2026-10": the sort key that puts markets in calendar order.
const marketKey = (market) => `${market.slice(0, 4)}-${MONTHS[market.slice(5)] || '00'}`

const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

// ---------------------------------------------------------------------------
// Body validation — numbers, hashes, counts; nothing else is accepted
// ---------------------------------------------------------------------------

const cleanInt = (value, where, { min = 0 } = {}) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min) throw validationError(`${where}: integer ≥ ${min} required`)
  return n
}
const cleanNumberOrNull = (value, where) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw validationError(`${where}: number or null`)
  return n
}
const cleanHash = (value, where) => {
  const text = String(value || '').toLowerCase()
  if (text && !HASH_RE.test(text)) throw validationError(`${where}: sha256 hex or empty`)
  return text
}

const cleanBody = (body) => {
  const mode = String(body.mode || '')
  if (!['kkm', 'azb'].includes(mode)) throw validationError('mode: kkm or azb')
  const market = String(body.market || '')
  if (!MARKET_RE.test(market)) throw validationError('market: YYYY-Mon')
  const eventId = body.eventId ? String(body.eventId) : ''
  if (eventId && !ID_RE.test(eventId)) throw validationError('eventId: record id or null')
  const eventCategoryId = body.eventCategoryId ? String(body.eventCategoryId) : ''
  if (eventCategoryId && !ID_RE.test(eventCategoryId)) throw validationError('eventCategoryId: record id')
  if (!eventId && !eventCategoryId) throw validationError('eventId or eventCategoryId is required')

  const statsIn = body.stats && typeof body.stats === 'object' ? body.stats : {}
  const stats = {
    sellers: cleanInt(statsIn.sellers, 'stats.sellers'),
    itemsMean: cleanNumberOrNull(statsIn.itemsMean, 'stats.itemsMean'),
    itemsMedian: cleanNumberOrNull(statsIn.itemsMedian, 'stats.itemsMedian'),
    revenueCentsMean: cleanNumberOrNull(statsIn.revenueCentsMean, 'stats.revenueCentsMean'),
    revenueCentsMedian: cleanNumberOrNull(statsIn.revenueCentsMedian, 'stats.revenueCentsMedian'),
    permanentSellers: cleanInt(statsIn.permanentSellers === undefined ? 0 : statsIn.permanentSellers, 'stats.permanentSellers'),
    permanentItemsMean: cleanNumberOrNull(statsIn.permanentItemsMean, 'stats.permanentItemsMean'),
    permanentItemsMedian: cleanNumberOrNull(statsIn.permanentItemsMedian, 'stats.permanentItemsMedian'),
    permanentRevenueCentsMean: cleanNumberOrNull(statsIn.permanentRevenueCentsMean, 'stats.permanentRevenueCentsMean'),
    permanentRevenueCentsMedian: cleanNumberOrNull(statsIn.permanentRevenueCentsMedian, 'stats.permanentRevenueCentsMedian'),
  }

  if (!Array.isArray(body.numbers)) throw validationError('numbers: array required')
  if (body.numbers.length > MAX_NUMBERS) throw validationError(`numbers: at most ${MAX_NUMBERS} rows`)
  const seen = {}
  const numbers = body.numbers.map((row, i) => {
    const where = `numbers[${i}]`
    if (!row || typeof row !== 'object') throw validationError(`${where}: object required`)
    const number = cleanInt(row.number, `${where}.number`, { min: 1 })
    if (seen[number]) throw validationError(`${where}: number ${number} appears twice`)
    seen[number] = true
    return {
      number,
      itemsSold: cleanInt(row.itemsSold, `${where}.itemsSold`),
      revenueCents: cleanInt(row.revenueCents, `${where}.revenueCents`),
      firstNameHash: cleanHash(row.firstNameHash, `${where}.firstNameHash`),
      lastNameHash: cleanHash(row.lastNameHash, `${where}.lastNameHash`),
      permanent: row.permanent === true,
    }
  })

  const topIn = Array.isArray(body.topSellers) ? body.topSellers : []
  if (topIn.length > MAX_TOP) throw validationError(`topSellers: at most ${MAX_TOP} rows`)
  const topSellers = topIn.map((row, i) => {
    const where = `topSellers[${i}]`
    if (!row || typeof row !== 'object') throw validationError(`${where}: object required`)
    return {
      number: cleanInt(row.number, `${where}.number`, { min: 1 }),
      rankRevenue: cleanInt(row.rankRevenue, `${where}.rankRevenue`, { min: 1 }),
      rankItems: cleanInt(row.rankItems, `${where}.rankItems`, { min: 1 }),
      itemsSold: cleanInt(row.itemsSold, `${where}.itemsSold`),
      revenueCents: cleanInt(row.revenueCents, `${where}.revenueCents`),
      firstNameHash: cleanHash(row.firstNameHash, `${where}.firstNameHash`),
      lastNameHash: cleanHash(row.lastNameHash, `${where}.lastNameHash`),
    }
  })

  return { mode, market, eventId, eventCategoryId, stats, numbers, topSellers, generatedAt: body.generatedAt ? String(body.generatedAt) : '' }
}

// ---------------------------------------------------------------------------
// The push
// ---------------------------------------------------------------------------

const holderMatchOf = (row, holder) => {
  const { holderHasHashes } = require(`${__hooks}/permanent-numbers-core.js`)
  if (holderHasHashes(holder, row.firstNameHash, row.lastNameHash)) return 'holder'
  const firstHash = holder.get('holderFirstNameHash') || ''
  if (row.firstNameHash === firstHash) return 'nameChange'
  return 'mismatch'
}

const pushStatistics = (app, rawBody, { dryRun, now } = {}) => {
  const { runMaybeDry } = require(`${__hooks}/permanent-numbers-core.js`)
  const { resolveNumbers, orFilterForIds } = require(`${__hooks}/status-core.js`)
  const body = cleanBody(rawBody || {})

  // --- category and, if present, event with its pools -------------------------------------
  let event = null
  let categoryId = body.eventCategoryId
  if (body.eventId) {
    try {
      event = app.findRecordById('events', body.eventId)
    } catch (error) {
      const notFound = new Error('Event not found')
      notFound.status = 404
      throw notFound
    }
    categoryId = event.get('eventCategory')
  }
  try {
    app.findRecordById('eventCategories', categoryId)
  } catch (error) {
    const notFound = new Error('Event category not found')
    notFound.status = 404
    throw notFound
  }

  const variations = app.findRecordsByFilter('sellerNumberVariations', 'eventCategory = {:categoryId}', '', 0, 0, { categoryId }) || []
  const variationIds = variations.map((v) => v.get('id'))
  if (variationIds.length === 0) throw validationError('the category has no variations')

  // number → variation through the event's pools; without an event every variation of the
  // category is a candidate and the register decides (exactly one row → that one).
  const variationByNumber = {}
  if (event) {
    const pools = app.findRecordsByFilter('sellerNumberPools', 'event = {:eventId}', '', 0, 0, { eventId: event.get('id') }) || []
    for (const pool of pools) {
      let numbers = []
      try {
        numbers = resolveNumbers(JSON.parse(pool.get('numbersAsJsonArray') || '[]'))
      } catch (error) {
        numbers = []
      }
      for (const n of numbers) variationByNumber[n] = pool.get('sellerNumberVariation')
    }
  }

  const registerRows = app.findRecordsByFilter('permanentNumbers', orFilterForIds('sellerNumberVariation', variationIds), '', 0, 0) || []
  const registerByNumber = {}
  for (const row of registerRows) {
    const n = row.get('permanentNumberNumber')
    if (!registerByNumber[n]) registerByNumber[n] = []
    registerByNumber[n].push(row)
  }

  const timestamp = (now || new Date()).toISOString()
  const marketSortKey = marketKey(body.market)

  return runMaybeDry(app, dryRun === true, (txApp) => {
    const marketsCollection = txApp.findCollectionByNameOrId('permanentNumberMarkets')
    const statsCollection = txApp.findCollectionByNameOrId('marketStats')
    const topCollection = txApp.findCollectionByNameOrId('marketTopSellers')
    const counts = { rows: 0, created: 0, updated: 0, trimmed: 0, ignored: 0, ambiguous: 0, holder: 0, nameChange: 0, mismatch: 0, flagged: 0, unflagged: 0, topSellers: 0 }
    const warnings = []
    const touched = []

    for (const row of body.numbers) {
      const candidates = registerByNumber[row.number] || []
      let register = null
      if (candidates.length === 1) {
        register = candidates[0]
      } else if (candidates.length > 1) {
        const wanted = variationByNumber[row.number]
        register = wanted ? candidates.find((c) => c.get('sellerNumberVariation') === wanted) || null : null
        if (!register) {
          counts.ambiguous += 1
          warnings.push({ number: row.number, code: 'ambiguous', message: 'number exists in more than one variation of the category and no event pool decides' })
          continue
        }
      }
      if (!register) {
        counts.ignored += 1
        continue
      }
      if (event && variationByNumber[row.number] && variationByNumber[row.number] !== register.get('sellerNumberVariation')) {
        // The event hands this number out under another variation than the register keeps it.
        counts.ignored += 1
        warnings.push({ number: row.number, code: 'variationMismatch', message: 'the event pool and the register disagree on the variation' })
        continue
      }

      let holder
      try {
        holder = txApp.findRecordById('permanentNumberHolders', register.get('holder'))
      } catch (error) {
        counts.ignored += 1
        warnings.push({ number: row.number, code: 'holderMissing', message: 'register row without holder' })
        continue
      }
      const match = holderMatchOf(row, holder)
      counts[match] += 1

      const existing = txApp.findRecordsByFilter('permanentNumberMarkets', 'permanentNumber = {:id} && market = {:market}', '', 1, 0, { id: register.get('id'), market: body.market }) || []
      const record = existing.length ? existing[0] : new Record(marketsCollection)
      record.set('permanentNumber', register.get('id'))
      record.set('market', body.market)
      record.set('event', event ? event.get('id') : '')
      record.set('firstNameHash', row.firstNameHash)
      record.set('lastNameHash', row.lastNameHash)
      record.set('holder', match === 'holder' ? holder.get('id') : '')
      record.set('holderMatch', match)
      record.set('itemsSold', row.itemsSold)
      record.set('revenueCents', row.revenueCents)
      txApp.save(record)
      counts.rows += 1
      if (existing.length) counts.updated += 1
      else counts.created += 1
      touched.push({ register, holder, number: row.number, match })
    }

    // --- keep the newest eight rows per number and holder --------------------------------
    for (const { register } of touched) {
      const rows = txApp.findRecordsByFilter('permanentNumberMarkets', 'permanentNumber = {:id}', '', 0, 0, { id: register.get('id') }) || []
      const byHolder = {}
      for (const r of rows) {
        const key = r.get('holder') || ''
        if (!byHolder[key]) byHolder[key] = []
        byHolder[key].push(r)
      }
      for (const group of Object.values(byHolder)) {
        group.sort((a, b) => marketKey(b.get('market')).localeCompare(marketKey(a.get('market'))))
        for (const old of group.slice(KEEP)) {
          txApp.delete(old)
          counts.trimmed += 1
        }
      }
    }

    // --- market figures and candidates -----------------------------------------------------
    const existingStats = txApp.findRecordsByFilter('marketStats', 'eventCategory = {:categoryId} && market = {:market}', '', 1, 0, { categoryId, market: body.market }) || []
    const statsRecord = existingStats.length ? existingStats[0] : new Record(statsCollection)
    statsRecord.set('eventCategory', categoryId)
    statsRecord.set('market', body.market)
    statsRecord.set('event', event ? event.get('id') : '')
    for (const [field, value] of Object.entries(body.stats)) statsRecord.set(field, value === null ? null : value)
    txApp.save(statsRecord)

    for (const old of txApp.findRecordsByFilter('marketTopSellers', 'eventCategory = {:categoryId} && market = {:market}', '', 0, 0, { categoryId, market: body.market }) || []) {
      txApp.delete(old)
    }
    for (const top of body.topSellers) {
      const record = new Record(topCollection)
      record.set('eventCategory', categoryId)
      record.set('market', body.market)
      record.set('event', event ? event.get('id') : '')
      for (const field of ['number', 'rankRevenue', 'rankItems', 'itemsSold', 'revenueCents', 'firstNameHash', 'lastNameHash']) record.set(field, top[field])
      txApp.save(record)
      counts.topSellers += 1
    }

    // --- the advisory flag, per touched number ---------------------------------------------
    // Four `holder` rows of the current holder; both means under the median of the four
    // markets' medians. No full window, no flag. The market medians come from marketStats —
    // this push's own row included, so the flag sees the market it was just handed.
    const statsByMarket = {}
    for (const s of txApp.findRecordsByFilter('marketStats', 'eventCategory = {:categoryId}', '', 0, 0, { categoryId }) || []) {
      statsByMarket[s.get('market')] = s
    }
    const flagged = []
    for (const { register, holder, number } of touched) {
      const rows = (txApp.findRecordsByFilter('permanentNumberMarkets', 'permanentNumber = {:id} && holder = {:holderId} && holderMatch = "holder"', '', 0, 0, { id: register.get('id'), holderId: holder.get('id') }) || [])
        .sort((a, b) => marketKey(b.get('market')).localeCompare(marketKey(a.get('market'))))
        .slice(0, WINDOW)
      let flag = false
      if (rows.length === WINDOW) {
        const itemMedians = []
        const revenueMedians = []
        for (const r of rows) {
          const s = statsByMarket[r.get('market')]
          if (s && s.get('itemsMedian') !== null && s.get('revenueCentsMedian') !== null) {
            itemMedians.push(Number(s.get('itemsMedian')))
            revenueMedians.push(Number(s.get('revenueCentsMedian')))
          }
        }
        if (itemMedians.length === WINDOW) {
          const itemsMean = mean(rows.map((r) => Number(r.get('itemsSold'))))
          const revenueMean = mean(rows.map((r) => Number(r.get('revenueCents'))))
          flag = itemsMean < median(itemMedians) && revenueMean < median(revenueMedians)
        }
      }
      register.set('reviewFlag', flag)
      register.set('reviewedAt', timestamp)
      txApp.save(register)
      if (flag) {
        counts.flagged += 1
        flagged.push(number)
      } else {
        counts.unflagged += 1
      }
    }

    return {
      dryRun: dryRun === true,
      mode: body.mode,
      market: body.market,
      eventId: event ? event.get('id') : null,
      eventCategoryId: categoryId,
      counts,
      flagged,
      warnings,
    }
  })
}

module.exports = { MARKET_RE, marketKey, median, mean, cleanBody, holderMatchOf, pushStatistics }
