import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { IsLoadingProvider } from '@/components/LoadingSkeleton'
import { PageButton } from '@/components/PageButton'
import { ProseText } from '@/components/ProseText'
import { usePageTitle } from '@/context/PageTitleContext'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/variation/$variationId/sellerNumber/$sellerNumber/_withSessionCounter/conditions'
)({
  component: RouteComponent,
})

function RouteComponent() {
  usePageTitle('Verkäuferinformationen')
  const { variationId: sellerNumberVariationId } = Route.useParams()

  const { data: sellerNumberVariations } = useSellerNumberVariationsQuery()
  const sellerNumberVariation = sellerNumberVariations?.find(
    (variation) => variation.id === sellerNumberVariationId
  )

  const handleAccept = () => {
    // Handle accept logic here
  }
  return (
    <IsLoadingProvider isLoading={!sellerNumberVariation}>
      <ProseText text={sellerNumberVariation?.conditionsText} />

      <div className="flex justify-center pt-4">
        <PageButton onClick={handleAccept}>AKZEPTIEREN UND WEITER</PageButton>
      </div>
    </IsLoadingProvider>
  )
}
