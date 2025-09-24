import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withErrorLogging } from './withErrorLogging'

const ReservationRequestSchema = z.object({
  sellerNumberVariationId: z.string(),
})

const ReservationResponseSchema = z.object({
  sellerNumberId: z.string(),
})

const reserveSellerNumber = async (
  request: z.infer<typeof ReservationRequestSchema>
) => {
  const validatedRequest = ReservationRequestSchema.parse(request)

  const response = await pb.send<unknown>('/api/seller-number/reservation', {
    method: 'POST',
    body: validatedRequest,
  })

  const validatedResponse = ReservationResponseSchema.parse(response)

  return validatedResponse
}

export const useSellerNumberReservationMutation = () => {
  return useMutation({
    mutationFn: withErrorLogging(reserveSellerNumber),
  })
}
