import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'

const ErrorWithMessageSchema = z.object({
  message: z.string(),
})
const ServerErrorResponseSchema = z.object({
  response: z.object({
    error: z.string(),
  }),
})

const getErrorMessage = (error: unknown): string => {
  const serverErrorParseResult = ServerErrorResponseSchema.safeParse(error)
  if (serverErrorParseResult.success) {
    return serverErrorParseResult.data.response.error
  }

  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }

  const errorWithMessageParseResult = ErrorWithMessageSchema.safeParse(error)
  if (errorWithMessageParseResult.success) {
    return errorWithMessageParseResult.data.message
  }

  return 'An unexpected error occurred'
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.error('Query error:', error)
      const errorMessage = getErrorMessage(error)
      toast.error('Failed to load data', {
        description: errorMessage,
        richColors: true,
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('Mutation error:', { error })
      const errorMessage = getErrorMessage(error)
      toast.error('Da ist was schiefgelaufen', {
        description: errorMessage,
        richColors: true,
      })
    },
  }),
})
