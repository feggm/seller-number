// Shared module: renders UTC timestamps in Europe/Berlin local time (CET/CEST).
//
// The PocketBase JSVM (goja) does not ship `Intl`, so `toLocaleString('de-DE', { timeZone })`
// is not available. The EU daylight-saving rule is implemented directly instead: CEST (UTC+2)
// runs from the last Sunday in March 01:00 UTC until the last Sunday in October 01:00 UTC,
// CET (UTC+1) applies the rest of the year. This rule has been stable for Germany since 1996.

const pad = (value, length) => {
  let out = String(value)
  while (out.length < length) out = '0' + out
  return out
}

// Last Sunday of the given month at 01:00 UTC (the DST switch instant).
const lastSundayAt1UTC = (year, monthIndex) => {
  // Day 0 of the following month is the last day of this month.
  const date = new Date(Date.UTC(year, monthIndex + 1, 0, 1, 0, 0))
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return date
}

const berlinOffsetMinutes = (date) => {
  const year = date.getUTCFullYear()
  const dstStart = lastSundayAt1UTC(year, 2) // March
  const dstEnd = lastSundayAt1UTC(year, 9) // October
  return date >= dstStart && date < dstEnd ? 120 : 60
}

const offsetLabel = (offsetMinutes) =>
  '+' + pad(Math.floor(offsetMinutes / 60), 2) + ':' + pad(offsetMinutes % 60, 2)

const abbreviation = (offsetMinutes) => (offsetMinutes === 120 ? 'CEST' : 'CET')

// PocketBase date fields come back as '2026-09-01 16:00:00.000Z' (space instead of 'T'),
// which older JS engines refuse to parse. Normalise before handing it to `Date`.
const toDate = (value) => {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (raw === '') return null

  const date = new Date(raw.replace(' ', 'T'))
  return isNaN(date.getTime()) ? null : date
}

const isMidnightUTC = (date) =>
  date.getUTCHours() === 0 &&
  date.getUTCMinutes() === 0 &&
  date.getUTCSeconds() === 0 &&
  date.getUTCMilliseconds() === 0

/**
 * Format a timestamp for the status report.
 *
 * Returns `null` for empty/unset/unparseable values, otherwise:
 *   { local: '2026-09-01T18:00:00+02:00', utc: '2026-09-01T16:00:00.000Z',
 *     display: '01.09.2026, 18:00 Uhr', offset: '+02:00', abbreviation: 'CEST' }
 *
 * `dateOnlyAtMidnight: true` drops the time from `display` — but only when the stored value
 * is exactly midnight UTC, i.e. a date with no meaningful time of day. Use it for
 * `events.eventDate`: a date-only entry would otherwise read as '14.09.2026, 02:00 Uhr' once
 * shifted to Berlin, while an event that really does start at 15:30 still shows its time.
 * `local` and `utc` always carry the full timestamp either way.
 */
const formatBerlin = (value, options) => {
  const date = toDate(value)
  if (!date) return null

  const dateOnly = !!(options && options.dateOnlyAtMidnight) && isMidnightUTC(date)
  const offsetMinutes = berlinOffsetMinutes(date)
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000)

  const day = pad(shifted.getUTCDate(), 2)
  const month = pad(shifted.getUTCMonth() + 1, 2)
  const year = shifted.getUTCFullYear()
  const hours = pad(shifted.getUTCHours(), 2)
  const minutes = pad(shifted.getUTCMinutes(), 2)

  return {
    local: shifted.toISOString().replace(/\.\d{3}Z$/, '') + offsetLabel(offsetMinutes),
    utc: date.toISOString(),
    display: dateOnly
      ? day + '.' + month + '.' + year
      : day + '.' + month + '.' + year + ', ' + hours + ':' + minutes + ' Uhr',
    offset: offsetLabel(offsetMinutes),
    abbreviation: abbreviation(offsetMinutes),
  }
}

const berlinZoneInfo = (date) => {
  const offsetMinutes = berlinOffsetMinutes(date || new Date())
  return {
    name: 'Europe/Berlin',
    abbreviation: abbreviation(offsetMinutes),
    utcOffset: offsetLabel(offsetMinutes),
  }
}

module.exports = {
  formatBerlin,
  berlinZoneInfo,
  berlinOffsetMinutes,
}
