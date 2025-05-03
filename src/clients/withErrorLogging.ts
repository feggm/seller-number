export const withErrorLogging = <
  TFunction extends (...args: never[]) => Promise<unknown>,
>(
  fn: TFunction
): TFunction => {
  return (async (...args: Parameters<TFunction>) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error('Error:', error)
      throw error
    }
  }) as TFunction
}
