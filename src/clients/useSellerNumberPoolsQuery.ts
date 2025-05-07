import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { gracefulArray } from '@/lib/gracefulArray'
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { upcomingEventQueryOptions } from './useUpcomingEventQuery'
import { withErrorLogging } from './withErrorLogging'

const NumberDataSchema = z.union([
  z.number().min(0),
  z.object({
    from: z.number().min(0),
    to: z.number().min(0),
  }),
])

type NumberData = z.infer<typeof NumberDataSchema>

const SellerNumberPoolSchema = z.object({
  id: z.string(),
  sellerNumberVariation: z.string(),
  obtainableFrom: z.coerce.date().optional().catch(undefined),
  obtainableTo: z.coerce.date().optional().catch(undefined),
  numbers: gracefulArray(NumberDataSchema),
})

const resolveNumbers = (numberDatas: NumberData[]) => [
  ...new Set(
    numberDatas.flatMap((numberData) =>
      typeof numberData === 'number'
        ? numberData
        : [
            ...Array.from(
              { length: numberData.to - numberData.from + 1 },
              (_, i) => numberData.from + i
            ),
          ]
    )
  ),
]

const getSellerNumberPools = async (
  eventCategoryId: string,
  queryClient: QueryClient
) => {
  const { id: eventId } = await queryClient.fetchQuery(
    upcomingEventQueryOptions(eventCategoryId)
  )
  return SellerNumberPoolSchema.array()
    .parse(
      await pb.collection('sellerNumberPools').getFullList({
        filter: pb.filter('event = {:eventId}', {
          eventId,
        }),
        fields: Object.keys(SellerNumberPoolSchema.shape).join(','),
      })
    )
    .map((sellerNumberPool) => ({
      ...sellerNumberPool,
      resolvedNumbers: resolveNumbers(sellerNumberPool.numbers),
    }))
}

export const sellerNumberPoolsQueryOptions = ({
  eventCategoryId,
  queryClient,
}: {
  eventCategoryId: string
  queryClient: QueryClient
}) => ({
  queryKey: ['sellerNumberPools', eventCategoryId],
  queryFn: withErrorLogging(() =>
    getSellerNumberPools(eventCategoryId, queryClient)
  ),
  staleTime: Infinity,
})

export const useSellerNumberPoolsQuery = () => {
  const eventCategoryId = useEventCategoryId()
  const queryClient = useQueryClient()

  return useQuery(
    sellerNumberPoolsQueryOptions({
      eventCategoryId,
      queryClient,
    })
  )
}
