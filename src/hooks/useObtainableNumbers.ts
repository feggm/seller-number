import { useSellerNumberPoolsQuery } from '@/clients/useSellerNumberPoolsQuery'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import { useCurrentTime } from '@/hooks/useCurrentTime'
import { useMemo } from 'react'

export const useObtainableNumbers = () => {
  const { data: sellerNumberPoolsData, isLoading: isPoolsLoading } =
    useSellerNumberPoolsQuery()
  const {
    dataWithComputedFields: sellerNumbers,
    isLoading: isSellerNumbersLoading,
  } = useSellerNumbersQuery()
  const { nowDate } = useCurrentTime()

  const obtainableNumbers = useMemo(() => {
    // Filter pools by obtainableFrom/obtainableTo based on current time
    const availablePools = sellerNumberPoolsData?.filter((pool) => {
      // Check obtainableFrom - if set, current time must be >= obtainableFrom
      if (pool.obtainableFrom) {
        if (nowDate < pool.obtainableFrom) return false
      }

      // Check obtainableTo - if set, current time must be <= obtainableTo
      if (pool.obtainableTo) {
        if (nowDate > pool.obtainableTo) return false
      }

      return true
    })

    return availablePools
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
      .filter(({ sellerNumber }) => !sellerNumber || sellerNumber.isObtainable)
  }, [sellerNumberPoolsData, sellerNumbers, nowDate])

  return {
    obtainableNumbers,
    isLoading: isPoolsLoading || isSellerNumbersLoading,
  }
}
