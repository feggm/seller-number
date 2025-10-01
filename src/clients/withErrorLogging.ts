import * as Sentry from '@sentry/react'

export const withErrorLogging = <
  TFunction extends (...args: never[]) => Promise<unknown>,
>(
  fn: TFunction
): TFunction => {
  return (async (...args: Parameters<TFunction>) => {
    return await Sentry.startSpan(
      {
        name: fn.name || 'anonymous function',
        op: fn.name?.includes('Query')
          ? 'db.query'
          : fn.name?.includes('Mutation')
            ? 'db.mutation'
            : 'function.call',
      },
      async () => {
        try {
          return await fn(...args)
        } catch (error) {
          console.error('Error:', error)
          Sentry.captureException(error)
          throw error
        }
      }
    )
  }) as TFunction
}
