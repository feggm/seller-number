import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { sellerNumberPoolsQueryOptions } from './useSellerNumberPoolsQuery'
import { withErrorLogging } from './withErrorLogging'

const SellerNumberSchema = z.object({
  id: z.string(),
  sellerNumberNumber: z.number().min(0),
  reservedAt: z.coerce.date().optional().catch(undefined),
  sellerNumberPool: z.string(),
  sellerDetails: z.string(),
})

const getSellerNumbers = async ({
  eventCategoryId,
  queryClient,
}: {
  eventCategoryId: string
  queryClient: QueryClient
}) => {
  const sellerNumberPools = await queryClient.fetchQuery(
    sellerNumberPoolsQueryOptions({
      eventCategoryId,
      queryClient,
    })
  )
  return (
    await Promise.all(
      sellerNumberPools.map(async ({ id: sellerNumberPoolId }) =>
        SellerNumberSchema.array().parse(
          await pb.collection('sellerNumbers').getFullList({
            filter: pb.filter('sellerNumberPool = {:sellerNumberPoolId}', {
              sellerNumberPoolId,
            }),
            fields: Object.keys(SellerNumberSchema.shape).join(','),
            requestKey: sellerNumberPoolId,
          })
        )
      )
    )
  ).flat()
}

export const useSellerNumbersQuery = () => {
  const eventCategoryId = useEventCategoryId()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['realtime', 'sellerNumbers', eventCategoryId],
    queryFn: withErrorLogging(() =>
      getSellerNumbers({
        eventCategoryId,
        queryClient,
      })
    ),
    staleTime: Infinity,
  })
}
