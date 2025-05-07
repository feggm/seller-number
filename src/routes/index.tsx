import { useEventCategoryQuery } from '@/clients/useEventCategoryQuery'
import { useSellerNumberPoolsQuery } from '@/clients/useSellerNumberPoolsQuery'
import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import { useUpcomingEventQuery } from '@/clients/useUpcomingEventQuery'
import {
  IsLoadingProvider,
  LoadingSkeletonForGrandChildren,
} from '@/components/LoadingSkeleton'
import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const message =
    'Schade, es scheint weder normale Verkaufsnummern noch Babynummern mehr für dich zu geben. Vielleicht klappts ja beim Nächsten mal...'

  const { data: eventCategoryData, isLoading } = useEventCategoryQuery()

  const { data: sellerNumberVariationsData } = useSellerNumberVariationsQuery()
  const { data: upcomingEventData } = useUpcomingEventQuery()
  const { data: sellerNumberPoolsData } = useSellerNumberPoolsQuery()
  const { data: sellerNumbers } = useSellerNumbersQuery()

  const introText = isLoading
    ? '<pre> </pre><pre> </pre><pre> </pre>'
    : (eventCategoryData?.introText ?? '')

  return (
    <IsLoadingProvider isLoading={isLoading}>
      <PageCard title="Willkommen">
        <LoadingSkeletonForGrandChildren>
          <div
            className="text-slate-700 leading-relaxed space-y-4"
            // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
            dangerouslySetInnerHTML={{ __html: introText }}
          ></div>
        </LoadingSkeletonForGrandChildren>

        <pre>{JSON.stringify(sellerNumberVariationsData, null, 2)}</pre>
        <pre>{JSON.stringify(upcomingEventData, null, 2)}</pre>
        <pre>{JSON.stringify(sellerNumberPoolsData, null, 2)}</pre>
        <pre>{JSON.stringify(sellerNumbers, null, 2)}</pre>

        <div className="flex flex-wrap gap-4 pt-2">
          <PageButton counter={0}>Verkäufernummer</PageButton>
          <PageButton counter={0}>Babynummer</PageButton>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-slate-600 italic">{message}</p>
        </div>
      </PageCard>
    </IsLoadingProvider>
  )
}
