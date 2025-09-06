import { useEventCategoryQuery } from '@/clients/useEventCategoryQuery'
import { useSellerNumberPoolsQuery } from '@/clients/useSellerNumberPoolsQuery'
import { useSellerNumberReservationMutation } from '@/clients/useSellerNumberReservationMutation'
import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import { IsLoadingProvider } from '@/components/LoadingSkeleton'
import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { ProseText } from '@/components/ProseText'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const { data: eventCategoryData, isLoading } = useEventCategoryQuery()
  const { data: sellerNumberVariationsData } = useSellerNumberVariationsQuery()
  const { data: sellerNumberPoolsData } = useSellerNumberPoolsQuery()
  const { dataWithComputedFields: sellerNumbers } = useSellerNumbersQuery()

  const introText = isLoading
    ? '<pre> </pre><pre> </pre><pre> </pre>'
    : (eventCategoryData?.introText ?? '')

  const variationsButtonData = sellerNumberVariationsData?.map(
    (variationData) => {
      const obtainableNumbers = sellerNumberPoolsData
        ?.filter((pool) => pool.sellerNumberVariation === variationData.id)
        .reduce(
          (numbers, pool) => [
            ...numbers,
            ...pool.resolvedNumbers.filter((resolvedNumber) => {
              const sellerNumber = sellerNumbers?.find(
                ({ sellerNumberNumber, sellerNumberPool }) =>
                  sellerNumberNumber === resolvedNumber &&
                  sellerNumberPool === pool.id
              )
              return !sellerNumber || sellerNumber.isObtainable
            }),
          ],
          [] as number[]
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
        <ProseText text={introText} />

        <div className="flex flex-wrap gap-4 pt-2">
          {!!variationsButtonData &&
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
        </div>
      </PageCard>
    </IsLoadingProvider>
  )
}
