import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { queryClient } from '@/lib/queryClient'
import { getSyncedNow } from '@/lib/timeSync'
import { UseQueryOptions, useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withErrorLogging } from './withErrorLogging'

const EventSchema = z.object({
  id: z.string(),
  eventName: z.string(),
  eventDate: z.coerce.date(),
})

// Returns null instead of throwing when no upcoming event is configured — that
// is a normal state (e.g. between two events), not an error.
const getUpcomingEvent = async (eventCategoryId: string) => {
  const { items } = await pb.collection('events').getList(1, 1, {
    filter: pb.filter(
      'eventCategory = {:eventCategoryId} && eventDate > {:now}',
      {
        eventCategoryId,
        now: getSyncedNow(),
      }
    ),
    fields: Object.keys(EventSchema.shape).join(','),
    sort: 'eventDate',
  })

  const upcomingEvent = items.at(0)
  return upcomingEvent ? EventSchema.parse(upcomingEvent) : null
}

export const upcomingEventQueryOptions = (eventCategoryId: string) =>
  ({
    queryKey: ['upcomingEvent', eventCategoryId],
    queryFn: withErrorLogging(async function getUpcomingEventQuery() {
      return getUpcomingEvent(eventCategoryId)
    }),
    staleTime: Infinity,
  }) satisfies UseQueryOptions

void pb.collection('events').subscribe('*', () => {
  void queryClient.invalidateQueries({ queryKey: ['upcomingEvent'] })
})

export const useUpcomingEventQuery = () => {
  const eventCategoryId = useEventCategoryId()

  return useQuery(upcomingEventQueryOptions(eventCategoryId))
}
