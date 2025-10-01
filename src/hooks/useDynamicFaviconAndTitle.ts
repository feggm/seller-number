import { pb } from '@/clients/pocketbase'
import { useEventCategoryQuery } from '@/clients/useEventCategoryQuery'
import { useEffect } from 'react'

const DEFAULT_TITLE = 'Verkäufernummer Registrierung'

export const useDynamicFaviconAndTitle = () => {
  const { data: eventCategory } = useEventCategoryQuery()

  // Update document title
  useEffect(() => {
    const title = eventCategory
      ? `${eventCategory.eventCategoryName} - ${DEFAULT_TITLE}`
      : DEFAULT_TITLE

    document.title = title
  }, [eventCategory])

  // Update favicon
  useEffect(() => {
    const updateFavicon = (href: string) => {
      let link = document.querySelector('link[rel="icon"]')

      if (!link) {
        link = document.createElement('link')
        if ('rel' in link) link.rel = 'icon'
        document.head.appendChild(link)
      }

      ;(link as HTMLLinkElement).href = href
    }

    if (eventCategory?.favicon) {
      try {
        const faviconUrl = pb.files.getURL(
          eventCategory.raw,
          eventCategory.favicon
        )
        updateFavicon(faviconUrl)
      } catch (error) {
        console.warn(
          'Failed to generate favicon URL, using default. Error:',
          error
        )
        updateFavicon('')
      }
    } else {
      updateFavicon('')
    }
  }, [eventCategory])
}
