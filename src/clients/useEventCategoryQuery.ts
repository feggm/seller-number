import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { queryClient } from '@/lib/queryClient'
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
  domain: z.string(),
  supportEmail: z.string(),
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

void pb.collection('eventCategories').subscribe('*', ({ record }) => {
  void queryClient.invalidateQueries({ queryKey: ['eventCategory', record.id] })
})

//////////////////////////////////////////////////////////////////
// Query by domain
//////////////////////////////////////////////////////////////////

const EventCategoryByDomainSchema = EventCategorySchema.pick({
  id: true,
})

const getEventCategoryByDomain = async (domain: string) => {
  const eventCategory = EventCategoryByDomainSchema.parse(
    await pb
      .collection('eventCategories')
      .getFirstListItem(`domain="${domain}"`, {
        fields: Object.keys(EventCategoryByDomainSchema.shape).join(','),
      })
  )
  return eventCategory
}
export const useEventCategoryByDomainQuery = (domain: string | undefined) => {
  return useQuery({
    queryKey: ['eventCategoryByDomain', domain],
    queryFn: withErrorLogging(() => getEventCategoryByDomain(domain ?? '')),
    enabled: !!domain,
    staleTime: Infinity,
  })
}
void pb.collection('eventCategories').subscribe('*', ({ record }) => {
  const { data, success } = EventCategorySchema.safeParse(record)
  const queryKey = success
    ? ['eventCategoryByDomain', data.domain]
    : ['eventCategoryByDomain']
  void queryClient.invalidateQueries({ queryKey })
})
