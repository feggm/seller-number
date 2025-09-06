import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import {
  IsLoadingProvider,
  LoadingSkeleton,
} from '@/components/LoadingSkeleton'
import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { ProseText } from '@/components/ProseText'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/variation/$variationId/sellerNumber/$sellerNumber/conditions'
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { variationId: sellerNumberVariationId, sellerNumber: sellerNumberId } =
    Route.useParams()

  const { data: sellerNumberVariations } = useSellerNumberVariationsQuery()
  const sellerNumberVariation = sellerNumberVariations?.find(
    (variation) => variation.id === sellerNumberVariationId
  )

  const { data: sellerNumbers } = useSellerNumbersQuery()
  const sellerNumber = sellerNumbers?.find(
    (number) => number.id === sellerNumberId
  )

  const timeLeft = {
    minutes: 10,
    seconds: 30,
  }
  const handleAccept = () => {
    // Handle accept logic here
  }
  return (
    <PageCard
      title="Verkäuferinformationen"
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
      <IsLoadingProvider isLoading={!sellerNumberVariation}>
        <ProseText text={sellerNumberVariation?.conditionsText} />

        <div className="flex justify-center pt-4">
          <PageButton onClick={handleAccept}>AKZEPTIEREN UND WEITER</PageButton>
        </div>
      </IsLoadingProvider>
    </PageCard>
  )
}
