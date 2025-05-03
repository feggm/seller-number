import { z } from 'zod'

/**
 * This is an alternative to z.array that allows you to ignore elements that don't match the schema.
 * Useful when you don't control e.g. an enum and want to ignore elements that don't match the enum.
 * Inspired from {@link https://github.com/colinhacks/zod/discussions/672#discussioncomment-6884241 github discussion}
 * @param itemSchema The schema for the array items
 * @returns A zod array with the given item schema
 */
export const gracefulArray = <TSchema extends z.ZodType<unknown>>(
  itemSchema: TSchema
) => {
  const catchValue = {} as never

  return z
    .array(itemSchema.catch(catchValue))
    .transform((a) => a.filter((o) => o !== catchValue))
    .catch([])
}
