import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import {
  IsLoadingProvider,
  LoadingSkeleton,
} from '@/components/LoadingSkeleton'
import { PageCard } from '@/components/PageCard'
import { PageTitleProvider } from '@/context/PageTitleContext'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute(
  '/variation/$variationId/sellerNumber/$sellerNumber/_withSessionCounter'
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { sellerNumber: sellerNumberId } = Route.useParams()
  const { data: sellerNumbers } = useSellerNumbersQuery()
  const sellerNumber = sellerNumbers?.find(
    (number) => number.id === sellerNumberId
  )
  const timeLeft = {
    minutes: 10,
    seconds: 30,
  }
  const [title, setTitle] = useState('')
  return (
    <PageTitleProvider onTitleChange={setTitle}>
      <PageCard
        title={title}
        titleBarSuffix={
          <IsLoadingProvider isLoading={!sellerNumber}>
            <div className="text-xs whitespace-pre text-right">
              <LoadingSkeleton>
                <span className="inline-block w-3 h-3 bg-white rounded-full animate-pulse"></span>
                Sitzung endet: {timeLeft.minutes}m {timeLeft.seconds}s
              </LoadingSkeleton>
            </div>
          </IsLoadingProvider>
        }
      >
        <Outlet />
      </PageCard>
    </PageTitleProvider>
  )
}
