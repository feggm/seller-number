import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withUrlResolving } from './withUrlResolving'

const EventCategorySchema = z.object({
  id: z.string(),
  introText: z.string(),
  introTextUrl: z.string(),
  eventCategoryName: z.string(),
})

const getEventCategory = async (eventCategoryId: string) => {
  const eventCategory = EventCategorySchema.parse(
    await pb.collection('eventCategories').getOne(eventCategoryId)
  )
  return await withUrlResolving(eventCategory, {
    resolverMap: {
      introTextUrl: 'introText',
    },
  })
}

export const useEventCategoryQuery = (eventCategoryId: string) => {
  return useQuery({
    queryKey: ['eventCategory', eventCategoryId],
    queryFn: () => getEventCategory(eventCategoryId),
    enabled: !!eventCategoryId,
    staleTime: Infinity,
  })
}
