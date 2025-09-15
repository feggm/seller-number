import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { IsLoadingProvider } from '@/components/LoadingSkeleton'
import { PageButton } from '@/components/PageButton'
import { ProseText } from '@/components/ProseText'
import { CardContent, CardFooter } from '@/components/ui/card'
import { usePageTitle } from '@/context/PageTitleContext'
import { createFileRoute, useRouter } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/variation/$variationId/sellerNumber/$sellerNumber/_withSessionCounter/conditions'
)({
  component: RouteComponent,
})

function RouteComponent() {
  usePageTitle('Verkäuferinformationen')
  const { variationId: sellerNumberVariationId, sellerNumber } =
    Route.useParams()
  const router = useRouter()

  const { data: sellerNumberVariations } = useSellerNumberVariationsQuery()
  const sellerNumberVariation = sellerNumberVariations?.find(
    (variation) => variation.id === sellerNumberVariationId
  )

  const handleAccept = () => {
    void router.navigate({
      to: '/variation/$variationId/sellerNumber/$sellerNumber/seller-details',
      params: { variationId: sellerNumberVariationId, sellerNumber },
    })
  }
  return (
    <>
      <CardContent className="p-6 space-y-6 overflow-y-auto">
        <IsLoadingProvider isLoading={!sellerNumberVariation}>
          <ProseText text={sellerNumberVariation?.conditionsText} />
        </IsLoadingProvider>
      </CardContent>
      <CardFooter className="flex justify-center">
        <PageButton onClick={handleAccept}>AKZEPTIEREN UND WEITER</PageButton>
      </CardFooter>
    </>
  )
}
