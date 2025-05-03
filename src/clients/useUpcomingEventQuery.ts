import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { UseQueryOptions, useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withErrorLogging } from './withErrorLogging'

const EventSchema = z.object({
  id: z.string(),
  eventName: z.string(),
  eventDate: z.coerce.date(),
})

const getUpcomingEvent = async (eventCategoryId: string) => {
  return EventSchema.parse(
    await pb.collection('events').getFirstListItem(
      pb.filter('eventCategory = {:eventCategoryId} && eventDate > {:now}', {
        eventCategoryId,
        now: new Date(),
      }),
      {
        fields: Object.keys(EventSchema.shape).join(','),
        sort: 'eventDate',
      }
    )
  )
}

export const upcomingEventQueryOptions = (eventCategoryId: string) =>
  ({
    queryKey: ['upcomingEvent', eventCategoryId],
    queryFn: withErrorLogging(() => getUpcomingEvent(eventCategoryId)),
    staleTime: Infinity,
  }) satisfies UseQueryOptions

export const useUpcomingEventQuery = () => {
  const eventCategoryId = useEventCategoryId()

  return useQuery(upcomingEventQueryOptions(eventCategoryId))
}
