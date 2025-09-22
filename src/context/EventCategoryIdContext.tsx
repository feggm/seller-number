import { useEventCategoryByDomainQuery } from '@/clients/useEventCategoryQuery'
import { createContext, use, useMemo } from 'react'

const currentDomain = window.location.host

const getDefaultEventCategoryIdFromSearchParam = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('eventCategoryId')
}

const EventCategoryIdContext = createContext<string>('')

export const EventCategoryIdProvider = ({
  children,
  value,
}: {
  children: React.ReactNode
  value?: string
}) => {
  const syncCategoryId = useMemo(
    () => value ?? getDefaultEventCategoryIdFromSearchParam(),
    [value]
  )
  const { data } = useEventCategoryByDomainQuery(
    syncCategoryId ? undefined : currentDomain
  )
  const eventCategoryId = syncCategoryId ?? data?.id
  if (!eventCategoryId) return null
  return (
    <EventCategoryIdContext value={eventCategoryId}>
      {children}
    </EventCategoryIdContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEventCategoryId = () => use(EventCategoryIdContext)
