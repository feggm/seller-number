import { getSyncedNow } from '@/lib/timeSync'
import { useMutation } from '@tanstack/react-query'
import mitt from 'mitt'
import { useCallback, useEffect, useRef } from 'react'
import { z } from 'zod'

import { pb } from './pocketbase'
import { useSellerNumbersQuery } from './useSellerNumbersQuery'
import { withErrorLogging } from './withErrorLogging'

const ReservationRequestSchema = z.object({
  sellerNumberVariationId: z.string(),
})

const ReservationResponseSchema = z.object({
  sellerNumberId: z.string(),
})

const reserveSellerNumber =
  (
    waitForUpdates?: (
      response: z.infer<typeof ReservationResponseSchema>
    ) => Promise<void>
  ) =>
  async (request: z.infer<typeof ReservationRequestSchema>) => {
    const validatedRequest = ReservationRequestSchema.parse(request)

    const response = await pb.send<unknown>('/api/seller-number/reservation', {
      method: 'POST',
      body: validatedRequest,
    })

    const validatedResponse = ReservationResponseSchema.parse(response)
    await waitForUpdates?.(validatedResponse)

    return validatedResponse
  }

export const useSellerNumberReservationMutation = () => {
  const { data: sellerNumbers } = useSellerNumbersQuery()

  type SellerNumber = NonNullable<typeof sellerNumbers>[number]

  const { current: emitter } =
    useRef(mitt<{ sellerNumbersChanged: SellerNumber[] }>())
  useEffect(() => {
    if (!sellerNumbers) return
    emitter.emit('sellerNumbersChanged', sellerNumbers)
  }, [sellerNumbers, emitter])

  const waitForUpdates = useCallback(
    (response: z.infer<typeof ReservationResponseSchema>) => {
      return new Promise<void>((resolve) => {
        const onSellerNumbersChange = (sellerNumbers: SellerNumber[]) => {
          const isSellerNumberReservedTimeUpdated = (
            sellerNumber?: SellerNumber
          ) => {
            const reservedAt = sellerNumber?.reservedAt
            if (!reservedAt) return false
            const now = getSyncedNow()
            const diffInMs = now.getTime() - reservedAt.getTime()
            return diffInMs < 30 * 1000 // 30 seconds
          }

          const sellerNumber = sellerNumbers.find(
            (number) => number.id === response.sellerNumberId
          )

          if (isSellerNumberReservedTimeUpdated(sellerNumber)) {
            emitter.off('sellerNumbersChanged', onSellerNumbersChange)
            resolve()
          }
        }
        emitter.on('sellerNumbersChanged', onSellerNumbersChange)
      })
    },
    [emitter]
  )

  return useMutation({
    mutationFn: withErrorLogging(reserveSellerNumber(waitForUpdates)),
  })
}
