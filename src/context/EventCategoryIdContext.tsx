import { createContext, use } from 'react'

const getDefaultEventCategoryId = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const eventCategoryIdFromUrl = urlParams.get('eventCategoryId')
  return eventCategoryIdFromUrl ?? import.meta.env.VITE_EVENT_CATEGORY_ID
}

const EventCategoryIdContext = createContext<string>(
  getDefaultEventCategoryId()
)

export const EventCategoryIdProvider = ({
  children,
  // eslint-disable-next-line react-x/no-unstable-default-props
  value = getDefaultEventCategoryId(),
}: {
  children: React.ReactNode
  value?: string
}) => {
  return (
    <EventCategoryIdContext value={value}>{children}</EventCategoryIdContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEventCategoryId = () => use(EventCategoryIdContext)
