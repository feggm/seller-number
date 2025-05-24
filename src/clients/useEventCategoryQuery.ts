import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withErrorLogging } from './withErrorLogging'
import { withUrlResolving } from './withUrlResolving'

const EventCategorySchema = z.object({
  id: z.string(),
  introText: z.string(),
  introTextUrl: z.string(),
  eventCategoryName: z.string(),
  sessionTimeInSec: z.number().int().positive(),
})

const getEventCategory = async (eventCategoryId: string) => {
  const eventCategory = EventCategorySchema.parse(
    await pb.collection('eventCategories').getOne(eventCategoryId, {
      fields: Object.keys(EventCategorySchema.shape).join(','),
    })
  )
  return await withUrlResolving(eventCategory, {
    resolverMap: {
      introTextUrl: 'introText',
    },
  })
}

export const useEventCategoryQuery = () => {
  const eventCategoryId = useEventCategoryId()

  return useQuery({
    queryKey: ['eventCategory', eventCategoryId],
    queryFn: withErrorLogging(() => getEventCategory(eventCategoryId)),
    enabled: !!eventCategoryId,
    staleTime: Infinity,
  })
}
