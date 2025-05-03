import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withErrorLogging } from './withErrorLogging'

const SellerNumberVariationSchema = z.object({
  id: z.string(),
  sellerNumberVariationName: z.string(),
})

const getSellerNumberVariations = async (eventCategoryId: string) => {
  return SellerNumberVariationSchema.array().parse(
    await pb.collection('sellerNumberVariations').getFullList({
      filter: pb.filter('eventCategory = {:eventCategoryId}', {
        eventCategoryId,
      }),
      fields: Object.keys(SellerNumberVariationSchema.shape).join(','),
    })
  )
}

export const useSellerNumberVariationsQuery = () => {
  const eventCategoryId = useEventCategoryId()

  return useQuery({
    queryKey: ['sellerNumberVariations', eventCategoryId],
    queryFn: withErrorLogging(() => getSellerNumberVariations(eventCategoryId)),
    staleTime: Infinity,
  })
}
