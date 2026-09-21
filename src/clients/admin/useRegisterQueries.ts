import { queryClient } from '@/lib/queryClient'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from '../pocketbase'
import { withErrorLogging } from '../withErrorLogging'

/**
 * Read side of the Dauernummer register (seller-number-integration.md §1.1, §1.7). Superuser
 * only: the collections have no public rules, so these queries only run once useAdminAuth
 * says there is a superuser. No module-level realtime subscription here — a subscription to a
 * superuser-only collection is refused before login — the mutations invalidate instead.
 */

export const EventCategorySchema = z.object({
  id: z.string(),
  eventCategoryName: z.string(),
})
export type EventCategory = z.infer<typeof EventCategorySchema>

export const VariationSchema = z.object({
  id: z.string(),
  sellerNumberVariationName: z.string(),
  eventCategory: z.string(),
})
export type Variation = z.infer<typeof VariationSchema>

export const ContactChannelSchema = z.enum(['email', 'whatsapp'])
export type ContactChannel = z.infer<typeof ContactChannelSchema>

export const AliasSchema = z.object({
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  firstNameHash: z.string(),
  lastNameHash: z.string(),
})
export type Alias = z.infer<typeof AliasSchema>

export const HolderSchema = z.object({
  id: z.string(),
  holderFirstName: z.string(),
  holderLastName: z.string(),
  holderEmail: z.string(),
  holderPhone: z.string(),
  holderContactChannel: ContactChannelSchema.or(z.literal('')).transform(
    (value) => value || 'email'
  ),
  isStaff: z.boolean(),
  holderNote: z.string(),
  holderFirstNameHash: z.string().default(''),
  holderLastNameHash: z.string().default(''),
  holderAliases: AliasSchema.array().nullable().transform((v) => v ?? []),
})
export type Holder = z.infer<typeof HolderSchema>

export const NumberStatusSchema = z.enum([
  'aktiv',
  'pausiert',
  'freigegeben',
  'gesperrt',
])
export type NumberStatus = z.infer<typeof NumberStatusSchema>

export const PermanentNumberSchema = z.object({
  id: z.string(),
  sellerNumberVariation: z.string(),
  permanentNumberNumber: z.number(),
  holder: z.string(),
  status: NumberStatusSchema,
  heldSince: z.string(),
  releasedAt: z.string(),
  reviewFlag: z.boolean(),
  reviewedAt: z.string(),
  reviewDecision: z.enum(['ok']).or(z.literal('')).default(''),
  reviewDecidedAt: z.string().default(''),
  reviewDecisionMarket: z.string().default(''),
  reviewNote: z.string().default(''),
  expand: z
    .object({ holder: HolderSchema.optional() })
    .optional(),
})
export type PermanentNumber = z.infer<typeof PermanentNumberSchema>

export const EventSchema = z.object({
  id: z.string(),
  eventName: z.string(),
  eventDate: z.string(),
  eventCategory: z.string(),
})
export type Event = z.infer<typeof EventSchema>

const fieldsOf = (schema: z.ZodObject<z.ZodRawShape>) =>
  Object.keys(schema.shape)
    .filter((key) => key !== 'expand')
    .join(',')

export const useEventCategoriesQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'eventCategories'],
    queryFn: withErrorLogging(async function getAdminEventCategoriesQuery() {
      return EventCategorySchema.array().parse(
        await pb.collection('eventCategories').getFullList({
          fields: fieldsOf(EventCategorySchema),
          sort: 'eventCategoryName',
        })
      )
    }),
    staleTime: Infinity,
    enabled,
  })

export const useVariationsQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'variations'],
    queryFn: withErrorLogging(async function getAdminVariationsQuery() {
      return VariationSchema.array().parse(
        await pb.collection('sellerNumberVariations').getFullList({
          fields: fieldsOf(VariationSchema),
          sort: 'sellerNumberVariationName',
        })
      )
    }),
    staleTime: Infinity,
    enabled,
  })

export const useHoldersQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'holders'],
    queryFn: withErrorLogging(async function getAdminHoldersQuery() {
      return HolderSchema.array().parse(
        await pb.collection('permanentNumberHolders').getFullList({
          fields: fieldsOf(HolderSchema),
          sort: 'holderLastName,holderFirstName',
        })
      )
    }),
    staleTime: Infinity,
    enabled,
  })

export const usePermanentNumbersQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'permanentNumbers'],
    queryFn: withErrorLogging(async function getAdminPermanentNumbersQuery() {
      return PermanentNumberSchema.array().parse(
        await pb.collection('permanentNumbers').getFullList({
          expand: 'holder',
          fields: `${fieldsOf(PermanentNumberSchema)},expand.holder.*`,
          sort: 'permanentNumberNumber',
        })
      )
    }),
    staleTime: Infinity,
    enabled,
  })

export const useEventsQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'events'],
    queryFn: withErrorLogging(async function getAdminEventsQuery() {
      return EventSchema.array().parse(
        await pb.collection('events').getFullList({
          fields: fieldsOf(EventSchema),
          sort: '-eventDate',
        })
      )
    }),
    staleTime: Infinity,
    enabled,
  })

/** After any register write: everything the page shows comes from these five lists. */
export const invalidateRegister = () =>
  queryClient.invalidateQueries({ queryKey: ['admin'] })

export const RegisterLogEntrySchema = z.object({
  id: z.string(),
  targetCollection: z.enum(['permanentNumbers', 'permanentNumberHolders']),
  recordId: z.string(),
  recordLabel: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  changes: z.record(z.string(), z.object({ from: z.unknown(), to: z.unknown() })).nullable(),
  actor: z.string(),
  created: z.string(),
})
export type RegisterLogEntry = z.infer<typeof RegisterLogEntrySchema>

/** The change history of one number and its holder — the newest first. */
export const useRegisterLogQuery = (recordIds: string[]) =>
  useQuery({
    queryKey: ['admin', 'registerLog', ...recordIds],
    queryFn: withErrorLogging(async function getAdminRegisterLogQuery() {
      if (recordIds.length === 0) return []
      const filter = recordIds.map((_, i) => `recordId = {:id${String(i)}}`).join(' || ')
      const params = Object.fromEntries(recordIds.map((id, i) => [`id${String(i)}`, id]))
      return RegisterLogEntrySchema.array().parse(
        await pb.collection('registerLog').getList(1, 30, {
          filter: pb.filter(filter, params),
          fields: fieldsOf(RegisterLogEntrySchema),
          sort: '-created',
        }).then((page) => page.items)
      )
    }),
    staleTime: Infinity,
  })

// ---------------------------------------------------------------------------
// An event's numbers — every number of its pools, reserved or registered or free
// ---------------------------------------------------------------------------

export const PoolSchema = z.object({
  id: z.string(),
  event: z.string(),
  sellerNumberVariation: z.string(),
  numbersAsJsonArray: z.string(),
  obtainableFrom: z.string(),
  obtainableTo: z.string(),
  isPermanentPool: z.boolean(),
})
export type Pool = z.infer<typeof PoolSchema>

export const SellerDetailsSchema = z.object({
  id: z.string(),
  sellerFirstName: z.string(),
  sellerLastName: z.string(),
  sellerEmail: z.string(),
  sellerPhone: z.string(),
  isStaff: z.boolean(),
  permanentNumberHolder: z.string(),
  created: z.string(),
})
export type SellerDetails = z.infer<typeof SellerDetailsSchema>

export const SellerNumberSchema = z.object({
  id: z.string(),
  sellerNumberNumber: z.number(),
  sellerNumberPool: z.string(),
  reservedAt: z.string(),
  sellerDetails: z.string(),
  expand: z.object({ sellerDetails: SellerDetailsSchema.optional() }).optional(),
})
export type SellerNumber = z.infer<typeof SellerNumberSchema>

/** The same reading of numbersAsJsonArray as status-core.js / reservation.pb.js — including
 *  the `{ "from": 0 }` pitfall they share, so this page never shows a number they would not. */
export const resolveNumbers = (json: string): number[] => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json) as unknown
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out = new Set<number>()
  for (const entry of parsed as unknown[]) {
    if (typeof entry === 'number') out.add(entry)
    else if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
      for (let i = entry[0]; i <= entry[1]; i++) out.add(i)
    } else if (entry && typeof entry === 'object' && 'from' in entry && 'to' in entry) {
      const { from, to } = entry as { from: unknown; to: unknown }
      if (typeof from === 'number' && typeof to === 'number' && from) {
        for (let i = from; i <= to; i++) out.add(i)
      }
    }
  }
  return [...out]
}

export const usePoolsQuery = (eventId: string) =>
  useQuery({
    queryKey: ['admin', 'pools', eventId],
    queryFn: withErrorLogging(async function getAdminPoolsQuery() {
      return PoolSchema.array().parse(
        await pb.collection('sellerNumberPools').getFullList({
          filter: pb.filter('event = {:eventId}', { eventId }),
          fields: fieldsOf(PoolSchema),
        })
      )
    }),
    staleTime: Infinity,
    enabled: eventId !== '',
  })

export const useEventSellerNumbersQuery = (poolIds: string[]) =>
  useQuery({
    queryKey: ['admin', 'sellerNumbers', ...poolIds],
    queryFn: withErrorLogging(async function getAdminEventSellerNumbersQuery() {
      if (poolIds.length === 0) return []
      const filter = poolIds.map((_, i) => `sellerNumberPool = {:p${String(i)}}`).join(' || ')
      const params = Object.fromEntries(poolIds.map((id, i) => [`p${String(i)}`, id]))
      return SellerNumberSchema.array().parse(
        await pb.collection('sellerNumbers').getFullList({
          filter: pb.filter(filter, params),
          expand: 'sellerDetails',
          fields: `${fieldsOf(SellerNumberSchema)},expand.sellerDetails.*`,
          sort: 'sellerNumberNumber',
        })
      )
    }),
    staleTime: Infinity,
    enabled: poolIds.length > 0,
  })

// ---------------------------------------------------------------------------
// Market figures (§1.10): the four-market window per number, the market's medians, the
// top sellers without a Dauernummer
// ---------------------------------------------------------------------------

export const NumberMarketSchema = z.object({
  id: z.string(),
  permanentNumber: z.string(),
  market: z.string(),
  event: z.string(),
  holder: z.string(),
  firstNameHash: z.string(),
  lastNameHash: z.string(),
  holderMatch: z.enum(['holder', 'nameChange', 'mismatch']),
  itemsSold: z.number(),
  revenueCents: z.number(),
})
export type NumberMarket = z.infer<typeof NumberMarketSchema>

export const MarketStatsSchema = z.object({
  id: z.string(),
  eventCategory: z.string(),
  market: z.string(),
  event: z.string(),
  sellers: z.number(),
  itemsMean: z.number().nullable(),
  itemsMedian: z.number().nullable(),
  revenueCentsMean: z.number().nullable(),
  revenueCentsMedian: z.number().nullable(),
  permanentSellers: z.number(),
  permanentItemsMean: z.number().nullable(),
  permanentItemsMedian: z.number().nullable(),
  permanentRevenueCentsMean: z.number().nullable(),
  permanentRevenueCentsMedian: z.number().nullable(),
})
export type MarketStats = z.infer<typeof MarketStatsSchema>

export const TopSellerSchema = z.object({
  id: z.string(),
  market: z.string(),
  event: z.string(),
  number: z.number(),
  rankRevenue: z.number(),
  rankItems: z.number(),
  itemsSold: z.number(),
  revenueCents: z.number(),
  firstNameHash: z.string(),
  lastNameHash: z.string(),
})
export type TopSeller = z.infer<typeof TopSellerSchema>

/** "2026-Oct" → "2026-10", the sort key that puts markets in calendar order. */
export const marketKey = (market: string) => {
  const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
  return `${market.slice(0, 4)}-${months[market.slice(5)] ?? '00'}`
}

export const useNumberMarketsQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'numberMarkets'],
    queryFn: withErrorLogging(async function getAdminNumberMarketsQuery() {
      return NumberMarketSchema.array().parse(
        await pb.collection('permanentNumberMarkets').getFullList({
          fields: fieldsOf(NumberMarketSchema),
        })
      )
    }),
    staleTime: Infinity,
    enabled,
  })

export const useMarketStatsQuery = (categoryId: string) =>
  useQuery({
    queryKey: ['admin', 'marketStats', categoryId],
    queryFn: withErrorLogging(async function getAdminMarketStatsQuery() {
      return MarketStatsSchema.array().parse(
        await pb.collection('marketStats').getFullList({
          filter: pb.filter('eventCategory = {:categoryId}', { categoryId }),
          fields: fieldsOf(MarketStatsSchema),
        })
      )
    }),
    staleTime: Infinity,
    enabled: categoryId !== '',
  })

export const useTopSellersQuery = (categoryId: string) =>
  useQuery({
    queryKey: ['admin', 'topSellers', categoryId],
    queryFn: withErrorLogging(async function getAdminTopSellersQuery() {
      return TopSellerSchema.array().parse(
        await pb.collection('marketTopSellers').getFullList({
          filter: pb.filter('eventCategory = {:categoryId}', { categoryId }),
          fields: fieldsOf(TopSellerSchema),
        })
      )
    }),
    staleTime: Infinity,
    enabled: categoryId !== '',
  })

// ---------------------------------------------------------------------------
// Sync log and seller history
// ---------------------------------------------------------------------------

export const SyncLogEntrySchema = z.object({
  id: z.string(),
  direction: z.enum(['in', 'out']),
  kind: z.string(),
  event: z.string(),
  client: z.string(),
  mode: z.string(),
  checksum: z.string(),
  rowCount: z.number().nullable(),
  dryRun: z.boolean(),
  status: z.enum(['ok', 'error']),
  summary: z.unknown().nullable(),
  ipAddress: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
})
export type SyncLogEntry = z.infer<typeof SyncLogEntrySchema>

export const useSyncLogQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'syncLog'],
    queryFn: withErrorLogging(async function getAdminSyncLogQuery() {
      const page = await pb.collection('syncLog').getList(1, 200, {
        fields: fieldsOf(SyncLogEntrySchema),
        sort: '-created',
      })
      return SyncLogEntrySchema.array().parse(page.items)
    }),
    staleTime: Infinity,
    enabled,
  })

export const SellerHistorySchema = z.object({
  eventId: z.string(),
  sellers: z
    .object({
      number: z.number(),
      sellerNumberId: z.string(),
      markets: z.number(),
      firstMarket: z.string().nullable(),
      lastMarket: z.string().nullable(),
    })
    .array(),
})
export type SellerHistory = z.infer<typeof SellerHistorySchema>

/** For every registration of the event: how many earlier markets the same person sold at. */
export const useSellerHistoryQuery = (eventId: string) =>
  useQuery({
    queryKey: ['admin', 'sellerHistory', eventId],
    queryFn: withErrorLogging(async function getAdminSellerHistoryQuery() {
      return SellerHistorySchema.parse(
        await pb.send<unknown>(`/api/seller-number/permanent-numbers/seller-history?eventId=${encodeURIComponent(eventId)}`, { method: 'GET' })
      )
    }),
    staleTime: Infinity,
    enabled: eventId !== '',
  })
