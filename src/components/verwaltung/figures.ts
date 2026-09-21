import type {
  MarketStats,
  NumberMarket,
  PermanentNumber,
} from '@/clients/admin/useRegisterQueries'
import { marketKey } from '@/clients/admin/useRegisterQueries'

/** The Kasse pushes the top 20 by revenue ∪ top 20 by items among the sellers without a
 *  Dauernummer; the candidate view starts at the top 10 and opens up to the full 20. */
export const TOP_N = 10
export const TOP_N_ALL = 20
export const WINDOW = 4

export const euro = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : `${(cents / 100).toFixed(2).replace('.', ',')} €`

const median = (values: number[]) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null


/**
 * The same arithmetic the push does (permanent-numbers-statistics.js): the newest four
 * `holder` rows of the current holder, their means, and the median of those markets' medians.
 * Computed on read, so the page and the stored flag can be held against each other.
 */
export function windowOf(
  number: PermanentNumber,
  rows: NumberMarket[],
  statsByMarket: Map<string, MarketStats>
) {
  const own = rows
    .filter((r) => r.permanentNumber === number.id)
    .sort((a, b) => marketKey(b.market).localeCompare(marketKey(a.market)))
  const window = own.filter((r) => r.holderMatch === 'holder' && r.holder === number.holder).slice(0, WINDOW)
  const medians = window
    .map((r) => statsByMarket.get(r.market))
    .filter((s): s is MarketStats => s?.itemsMedian !== null && s?.itemsMedian !== undefined && s.revenueCentsMedian !== null)
  const complete = window.length === WINDOW && medians.length === WINDOW
  const itemsMean = mean(window.map((r) => r.itemsSold))
  const revenueMean = mean(window.map((r) => r.revenueCents))
  const itemsRef = median(medians.map((s) => s.itemsMedian ?? 0))
  const revenueRef = median(medians.map((s) => s.revenueCentsMedian ?? 0))
  const flag =
    complete && itemsMean !== null && revenueMean !== null && itemsRef !== null && revenueRef !== null
      ? itemsMean < itemsRef && revenueMean < revenueRef
      : false
  // The decision holds until the window moves past the market it was taken for.
  const newestMarket = window.length > 0 ? window[0].market : ''
  const decisionCurrent =
    number.reviewDecision === 'ok' &&
    (number.reviewDecisionMarket === '' || marketKey(number.reviewDecisionMarket) >= marketKey(newestMarket))
  const needsReview = number.reviewFlag && !decisionCurrent
  return { own, window, complete, itemsMean, revenueMean, itemsRef, revenueRef, flag, newestMarket, decisionCurrent, needsReview }
}

