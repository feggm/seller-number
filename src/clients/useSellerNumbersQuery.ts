import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { useCurrentTime } from '@/hooks/useCurrentTime'
import { queryClient } from '@/lib/queryClient'
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { z } from 'zod'

import { pb } from './pocketbase'
import { useEventCategoryQuery } from './useEventCategoryQuery'
import { sellerNumberPoolsQueryOptions } from './useSellerNumberPoolsQuery'
import { onPoll } from './utils/polling'
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
  const { getTimeDiff } = useCurrentTime()
  const { data: eventCategoryData } = useEventCategoryQuery()

  const query = useQuery({
    queryKey: ['sellerNumbers', eventCategoryId],
    queryFn: withErrorLogging(() =>
      getSellerNumbers({
        eventCategoryId,
        queryClient,
      })
    ),
    staleTime: Infinity,
  })

  return Object.assign(query, {
    dataWithComputedFields: useMemo(
      () =>
        query.data?.map((sellerNumber) => ({
          ...sellerNumber,
          isObtainable: (() => {
            const isReserved =
              !!sellerNumber.reservedAt &&
              !!eventCategoryData?.sessionTimeInSec &&
              getTimeDiff(sellerNumber.reservedAt).seconds >
                -eventCategoryData.sessionTimeInSec
            return !isReserved && !sellerNumber.sellerDetails
          })(),
        })),
      [eventCategoryData, getTimeDiff, query.data]
    ),
  })
}

const invalidateSellerNumbersQuery = () => {
  void queryClient.invalidateQueries({
    queryKey: ['sellerNumbers'],
  })
}
void pb.collection('sellerNumbers').subscribe('*', invalidateSellerNumbersQuery)
onPoll(invalidateSellerNumbersQuery)
