import { useSellerNumberPoolsQuery } from '@/clients/useSellerNumberPoolsQuery'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import { useMemo } from 'react'

export const useObtainableNumbers = () => {
  const { data: sellerNumberPoolsData, isLoading: isPoolsLoading } =
    useSellerNumberPoolsQuery()
  const {
    dataWithComputedFields: sellerNumbers,
    isLoading: isSellerNumbersLoading,
  } = useSellerNumbersQuery()

  const obtainableNumbers = useMemo(
    () =>
      sellerNumberPoolsData
        ?.flatMap((pool) =>
          pool.resolvedNumbers.map((number) => {
            const sellerNumber = sellerNumbers?.find(
              (sellerNumber) =>
                sellerNumber.sellerNumberNumber === number &&
                sellerNumber.sellerNumberPool === pool.id
            )
            return {
              number,
              sellerNumber,
              sellerNumberVariation: pool.sellerNumberVariation,
            }
          })
        )
        .filter(
          ({ sellerNumber }) => !sellerNumber || sellerNumber.isObtainable
        ),
    [sellerNumberPoolsData, sellerNumbers]
  )

  return {
    obtainableNumbers,
    isLoading: isPoolsLoading || isSellerNumbersLoading,
  }
}
