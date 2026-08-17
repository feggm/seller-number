import { useEventCategoryQuery } from '@/clients/useEventCategoryQuery'
import { useSellerNumberReservationMutation } from '@/clients/useSellerNumberReservationMutation'
import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { useUpcomingEventQuery } from '@/clients/useUpcomingEventQuery'
import { IsLoadingProvider } from '@/components/LoadingSkeleton'
import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { ProseText } from '@/components/ProseText'
import { CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useObtainableNumbers } from '@/hooks/useObtainableNumbers'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const { data: eventCategoryData, isLoading } = useEventCategoryQuery()
  const introText = eventCategoryData?.introText

  const {
    data: sellerNumberVariationsData,
    isLoading: isSellerNumberVariationsLoading,
  } = useSellerNumberVariationsQuery()
  const {
    obtainableNumbers: allObtainableNumbers,
    isLoading: isObtainableNumbersLoading,
  } = useObtainableNumbers()

  const {
    data: upcomingEvent,
    isLoading: isUpcomingEventLoading,
    isSuccess: isUpcomingEventLoaded,
  } = useUpcomingEventQuery()
  const hasNoUpcomingEvent = isUpcomingEventLoaded && upcomingEvent === null

  const isVariationButtonsLoading =
    isSellerNumberVariationsLoading ||
    isObtainableNumbersLoading ||
    isUpcomingEventLoading

  const variationsButtonData = sellerNumberVariationsData?.map(
    (variationData) => {
      const obtainableNumbers = allObtainableNumbers?.filter(
        (n) => n.sellerNumberVariation === variationData.id
      )
      return {
        ...variationData,
        obtainableNumbers,
        obtainableCount: obtainableNumbers?.length ?? 0,
      }
    }
  )

  const navigate = useNavigate()
  const reserveMutation = useSellerNumberReservationMutation()

  return (
    <IsLoadingProvider isLoading={isLoading}>
      <PageCard title="Willkommen">
        <CardContent className="p-6 space-y-6 overflow-y-auto">
          <ProseText text={introText} />
        </CardContent>

        <CardFooter className="flex flex-wrap gap-4 pt-2">
          {isVariationButtonsLoading && <Skeleton className="h-20 w-full" />}
          {!isVariationButtonsLoading && hasNoUpcomingEvent && (
            <p className="text-slate-700 leading-relaxed">
              Zurzeit ist kein Termin geplant, für den Verkäufernummern vergeben
              werden. Schau bitte später noch einmal vorbei.
            </p>
          )}
          {!isVariationButtonsLoading &&
            !hasNoUpcomingEvent &&
            !!variationsButtonData &&
            variationsButtonData.map(
              ({ id, obtainableCount, sellerNumberVariationName }) => (
                <PageButton
                  key={id}
                  counter={obtainableCount}
                  disabled={!obtainableCount}
                  isLoading={
                    reserveMutation.isPending &&
                    reserveMutation.variables.sellerNumberVariationId === id
                  }
                  onClick={() => {
                    void (async () => {
                      const { sellerNumberId } =
                        await reserveMutation.mutateAsync({
                          sellerNumberVariationId: id,
                        })
                      await navigate({
                        to: '/variation/$variationId/sellerNumber/$sellerNumber/conditions',
                        params: {
                          sellerNumber: sellerNumberId,
                          variationId: id,
                        },
                      })
                    })()
                  }}
                >
                  {sellerNumberVariationName}
                </PageButton>
              )
            )}
        </CardFooter>
      </PageCard>
    </IsLoadingProvider>
  )
}
