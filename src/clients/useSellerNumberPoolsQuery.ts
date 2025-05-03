import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { gracefulArray } from '@/lib/gracefulArray'
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { upcomingEventQueryOptions } from './useUpcomingEventQuery'
import { withErrorLogging } from './withErrorLogging'

const NumberSchema = z.union([
  z.number().min(0),
  z.object({
    from: z.number().min(0),
    to: z.number().min(0),
  }),
])

const SellerNumberPoolSchema = z.object({
  id: z.string(),
  sellerNumberVariation: z.string(),
  obtainableFrom: z.coerce.date().optional().catch(undefined),
  obtainableTo: z.coerce.date().optional().catch(undefined),
  numbers: gracefulArray(NumberSchema),
})

const getSellerNumberPools = async (
  eventCategoryId: string,
  queryClient: QueryClient
) => {
  const { id: eventId } = await queryClient.fetchQuery(
    upcomingEventQueryOptions(eventCategoryId)
  )
  return SellerNumberPoolSchema.array().parse(
    await pb.collection('sellerNumberPools').getFullList({
      filter: pb.filter('event = {:eventId}', {
        eventId,
      }),
      fields: Object.keys(SellerNumberPoolSchema.shape).join(','),
    })
  )
}

export const useSellerNumberPoolsQuery = () => {
  const eventCategoryId = useEventCategoryId()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['sellerNumberPools', eventCategoryId],
    queryFn: withErrorLogging(() =>
      getSellerNumberPools(eventCategoryId, queryClient)
    ),
    staleTime: Infinity,
  })
}
