import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/variation/$sellerNumberVariation/conditions'
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { sellerNumberVariation: sellerNumberVariationId } = Route.useParams()

  const { data: sellerNumberVariations } = useSellerNumberVariationsQuery()
  const sellerNumberVariation = sellerNumberVariations?.find(
    (variation) => variation.id === sellerNumberVariationId
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
        <div className="text-xs whitespace-pre text-right">
          <span className="inline-block w-3 h-3 bg-white rounded-full animate-pulse"></span>
          Sitzung endet: {timeLeft.minutes}m {timeLeft.seconds}s
        </div>
      }
    >
      <div className="text-slate-700 leading-relaxed">
        <div
          className="prose max-w-prose"
          // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{
            __html: sellerNumberVariation?.conditionsText ?? '',
          }}
        />
      </div>

      <div className="flex justify-center pt-4">
        <PageButton onClick={handleAccept}>AKZEPTIEREN UND WEITER</PageButton>
      </div>
    </PageCard>
  )
}
