import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withErrorLogging } from './withErrorLogging'
import { withUrlResolving } from './withUrlResolving'

const SellerNumberVariationSchema = z.object({
  id: z.string(),
  sellerNumberVariationName: z.string(),
  conditionsText: z.string(),
  conditionsTextUrl: z.string(),
})

const getSellerNumberVariations = async (eventCategoryId: string) => {
  const sellerNumberVariations = SellerNumberVariationSchema.array().parse(
    await pb.collection('sellerNumberVariations').getFullList({
      filter: pb.filter('eventCategory = {:eventCategoryId}', {
        eventCategoryId,
      }),
      fields: Object.keys(SellerNumberVariationSchema.shape).join(','),
    })
  )

  return await Promise.all(
    sellerNumberVariations.map((sellerNumberVariation) =>
      withUrlResolving(sellerNumberVariation, {
        resolverMap: {
          conditionsTextUrl: 'conditionsText',
        },
      })
    )
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
