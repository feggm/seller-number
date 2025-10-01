import * as Sentry from '@sentry/react'

export const withErrorLogging = <
  TFunction extends (...args: never[]) => Promise<unknown>,
>(
  fn: TFunction
): TFunction => {
  return (async (...args: Parameters<TFunction>) => {
    const functionName = fn.name || 'anonymous function'
    return await Sentry.startSpan(
      {
        name: functionName,
        op: functionName.includes('Query')
          ? 'db.query'
          : functionName.includes('Mutation')
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
