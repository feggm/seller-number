import { useMutation } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useLocalStorage } from 'react-use'
import { z } from 'zod'

import { pb } from './pocketbase'
import { withErrorLogging } from './withErrorLogging'

const RegistrationRequestSchema = z.object({
  sellerNumberId: z.string(),
  sellerFirstName: z.string(),
  sellerLastName: z.string(),
  sellerEmail: z.string().email(),
  sellerPhone: z.string().optional(),
})

const RegistrationResponseSchema = z.object({
  sellerDetailsId: z.string(),
  sellerNumberId: z.string(),
})

const SellerDetailsSchema = z.object({
  request: RegistrationRequestSchema,
  response: RegistrationResponseSchema,
})
type SellerDetails = z.infer<typeof SellerDetailsSchema>

const registerSellerNumber = async (
  request: z.infer<typeof RegistrationRequestSchema>
) => {
  const validatedRequest = RegistrationRequestSchema.parse(request)

  const response = await pb.send<unknown>('/api/seller-number/registration', {
    method: 'POST',
    body: validatedRequest,
  })

  const validatedResponse = RegistrationResponseSchema.parse(response)

  // Store in localStorage before sending request
  localStorage.setItem(
    `sellerDetails_${validatedRequest.sellerNumberId}`,
    JSON.stringify({
      request: validatedRequest,
      response: validatedResponse,
    } satisfies SellerDetails)
  )

  return validatedResponse
}

export const useSellerNumberRegistrationMutation = () => {
  return useMutation({
    mutationFn: withErrorLogging(registerSellerNumber),
  })
}

export const useSellerNumberRegistrationData = ({
  sellerNumberId,
}: {
  sellerNumberId: string
}) => {
  const [sellerDetailsRaw] = useLocalStorage<
    | {
        request: z.infer<typeof RegistrationRequestSchema>
        response: z.infer<typeof RegistrationResponseSchema>
      }
    | undefined
  >(`sellerDetails_${sellerNumberId}`, undefined)

  const sellerDetails = useMemo(() => {
    if (!sellerDetailsRaw) return
    const { success, data } = SellerDetailsSchema.safeParse(sellerDetailsRaw)
    if (!success) return
    return data
  }, [sellerDetailsRaw])

  return sellerDetails
}

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>
