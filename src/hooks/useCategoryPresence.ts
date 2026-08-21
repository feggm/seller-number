import { pb } from '@/clients/pocketbase'
import { useEventCategoryId } from '@/context/EventCategoryIdContext'
import { useEffect } from 'react'

/**
 * Tags this browser's realtime connection with the event category it belongs to, so the
 * backend can count "how many people have the app open" per domain.
 *
 * The callback is deliberately empty — this subscription exists only for its topic name.
 * `$app.subscriptionsBroker()` is process-global across every domain a PocketBase instance
 * serves, so `public-status.pb.js` filters clients by `hasSubscription('eventCategories/<id>')`
 * to tell them apart.
 *
 * Additive on purpose. The existing `subscribe('*', …)` handlers in `useEventCategoryQuery`
 * stay untouched: the by-domain one *must* keep listening to `'*'`, otherwise it would miss
 * another category claiming this domain. A tagged client receives `eventCategories` changes
 * twice, but this listener does nothing, so no query is invalidated twice.
 *
 * Called from the root route so it covers every visitor on every route — presence belongs to
 * the seller flow, not to the status page that happens to display it.
 *
 * Caveat worth remembering when reading the figure: this counts SSE connections, i.e. browser
 * TABS (`pb` is a module singleton), not people and not devices.
 */
export const useCategoryPresence = () => {
  const eventCategoryId = useEventCategoryId()

  useEffect(() => {
    if (!eventCategoryId) return

    let cancelled = false
    let unsubscribe: (() => Promise<void>) | undefined

    void pb
      .collection('eventCategories')
      .subscribe(eventCategoryId, () => {
        // no-op: the subscription is the signal, not its payload
      })
      .then((fn) => {
        if (cancelled) {
          void fn()
          return
        }
        unsubscribe = fn
      })

    return () => {
      cancelled = true
      void unsubscribe?.()
    }
  }, [eventCategoryId])
}
