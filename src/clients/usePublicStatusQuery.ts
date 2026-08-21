import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { queryClient } from '@/lib/queryClient'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { onPoll } from './utils/polling'
import { withErrorLogging } from './withErrorLogging'

// These are custom endpoints reached through `pb.send`, not `pb.collection()`, so the usual
// "the Zod keys double as the PocketBase `fields` selection" convention does not apply here —
// the server decides the shape. Both directions are still validated.

const BerlinTimeSchema = z.object({
  local: z.string(),
  utc: z.string(),
  display: z.string(),
  offset: z.string(),
  abbreviation: z.string(),
})

const NullableBerlinTimeSchema = BerlinTimeSchema.nullable()

const CountsSchema = z.object({
  total: z.number(),
  registered: z.number(),
  reserved: z.number(),
  // `available` counts every pool of the event, including ones that have not opened yet.
  // `availableNow` is what a seller could actually obtain this second; `availableLater` is
  // stock still locked behind a future release. Use `availableNow` wherever the UI says "frei".
  available: z.number(),
  availableNow: z.number(),
  availableLater: z.number(),
  expiredHolds: z.number(),
})

/** One future release wave. Pools sharing an `obtainableFrom` are grouped into one block. */
const ReleaseBlockSchema = z.object({
  opensAt: BerlinTimeSchema,
  total: z.number(),
  available: z.number(),
  variations: z.array(z.string()),
})

export type ReleaseBlock = z.infer<typeof ReleaseBlockSchema>

const ReleaseSchema = z.object({
  isObtainableNow: z.boolean(),
  obtainableFrom: NullableBerlinTimeSchema,
  obtainableTo: NullableBerlinTimeSchema,
  nextOpensAt: NullableBerlinTimeSchema,
})

const PublicStatusSchema = z.object({
  generatedAt: BerlinTimeSchema,
  eventCategory: z.object({ id: z.string(), name: z.string() }),
  event: z
    .object({
      id: z.string(),
      name: z.string(),
      eventDate: NullableBerlinTimeSchema,
    })
    .nullable(),
  eventSelection: z.string(),
  reservationTargetMatches: z.boolean(),
  numbers: CountsSchema,
  variations: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      numbers: CountsSchema,
      release: ReleaseSchema,
    })
  ),
  release: ReleaseSchema,
  upcomingReleases: z.array(ReleaseBlockSchema),
  connections: z.number(),
})

export type PublicStatus = z.infer<typeof PublicStatusSchema>
export type StatusCounts = z.infer<typeof CountsSchema>
export type BerlinTime = z.infer<typeof BerlinTimeSchema>

const PublicStatusHistorySchema = z.object({
  bucketSeconds: z.number(),
  from: BerlinTimeSchema,
  to: BerlinTimeSchema,
  registrations: z.array(z.object({ t: z.string(), n: z.number() })),
  registrationsTotal: z.number(),
  connections: z.array(z.object({ t: z.string(), c: z.number() })),
})

export type PublicStatusHistory = z.infer<typeof PublicStatusHistorySchema>

const getPublicStatus = async (eventCategoryId: string) =>
  PublicStatusSchema.parse(
    await pb.send<unknown>(
      `/api/seller-number/public-status?eventCategoryId=${encodeURIComponent(eventCategoryId)}`,
      { method: 'GET' }
    )
  )

const getPublicStatusHistory = async (
  eventCategoryId: string,
  windowMinutes: number
) =>
  PublicStatusHistorySchema.parse(
    await pb.send<unknown>(
      `/api/seller-number/public-status/history?eventCategoryId=${encodeURIComponent(
        eventCategoryId
      )}&windowMinutes=${windowMinutes.toString()}`,
      { method: 'GET' }
    )
  )

const invalidatePublicStatus = () => {
  void queryClient.invalidateQueries({ queryKey: ['publicStatus'] })
}

// Registrations and reservations show up as sellerNumbers changes, so realtime covers them.
void pb.collection('sellerNumbers').subscribe('*', invalidatePublicStatus)
onPoll(invalidatePublicStatus)

/**
 * Live snapshot for the status page.
 *
 * Documented exception to the project's "staleTime: Infinity, freshness comes from realtime"
 * rule: `connections` is Go process state, not a projection of any record, so there is no
 * record event realtime could invalidate on. It has to be polled. The subscription above
 * still covers the number counts, which makes those update faster than the poll interval.
 *
 * `refetchIntervalInBackground: false` so a forgotten tab stops polling — and stops inflating
 * its own connection figure with requests nobody is reading.
 */
export const usePublicStatusQuery = () => {
  const eventCategoryId = useEventCategoryId()

  return useQuery({
    queryKey: ['publicStatus', eventCategoryId],
    queryFn: withErrorLogging(async function getPublicStatusQuery() {
      return getPublicStatus(eventCategoryId)
    }),
    enabled: !!eventCategoryId,
    staleTime: Infinity,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    // A 2s poll would otherwise fire the global error toast every 2 seconds.
    meta: { suppressErrorToast: true },
  })
}

export const usePublicStatusHistoryQuery = (windowMinutes = 60) => {
  const eventCategoryId = useEventCategoryId()

  return useQuery({
    queryKey: ['publicStatus', 'history', eventCategoryId, windowMinutes],
    queryFn: withErrorLogging(async function getPublicStatusHistoryQuery() {
      return getPublicStatusHistory(eventCategoryId, windowMinutes)
    }),
    enabled: !!eventCategoryId,
    staleTime: Infinity,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    meta: { suppressErrorToast: true },
  })
}
