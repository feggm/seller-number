import { pb } from '@/clients/pocketbase'
import { useEventCategoryQuery } from '@/clients/useEventCategoryQuery'
import { useSellerNumberPoolsQuery } from '@/clients/useSellerNumberPoolsQuery'
import { useSellerNumberVariationsQuery } from '@/clients/useSellerNumberVariationsQuery'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import {
  IsLoadingProvider,
  LoadingSkeletonForGrandChildren,
} from '@/components/LoadingSkeleton'
import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { useMutation } from '@tanstack/react-query'
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
  // const { mutateAsync: reserveSellerNumber } = useMutation({
  //   mutationFn: async (sellerNumberVariationId: string) => {
  //     pb.collection('sellerNumbers')
  //     console.log('Reserving seller number variation:', sellerNumberVariationId)
  //   },
  // })

  return (
    <IsLoadingProvider isLoading={isLoading}>
      <PageCard title="Willkommen">
        {/*<pre>{JSON.stringify(sellerNumberPoolsData, null, 2)}</pre>*/}
        <LoadingSkeletonForGrandChildren>
          <div
            className="text-slate-700 leading-relaxed space-y-4"
            // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
            dangerouslySetInnerHTML={{ __html: introText }}
          ></div>
        </LoadingSkeletonForGrandChildren>

        <div className="flex flex-wrap gap-4 pt-2">
          {!!variationsButtonData &&
            variationsButtonData.map(
              ({ id, obtainableCount, sellerNumberVariationName }) => (
                <PageButton
                  key={id}
                  counter={obtainableCount}
                  disabled={!obtainableCount}
                  onClick={() => {
                    void (async () => {
                      // await reserveSellerNumber(id)
                      void navigate({
                        to: '/variation/$sellerNumberVariation/conditions',
                        params: { sellerNumberVariation: id },
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
