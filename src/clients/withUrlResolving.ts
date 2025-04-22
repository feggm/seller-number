/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
import { isKeyOf } from '@/lib/isKeyOf'
import { get } from 'lodash-es'

type KeyableValue<TObject extends object> =
  TObject[keyof TObject] extends string ? TObject[keyof TObject] : never

const resolveUrl = async (url: string) => {
  const hash = new URL(url).hash.slice(1)
  const resultJson = (await fetch(url).then((res) => res.json())) as unknown
  return String(get(resultJson, hash))
}

export const withUrlResolving = async <
  TData extends object,
  TResolverMap extends Partial<Record<keyof TData, string>>,
  TResolvedData extends object = Record<KeyableValue<TResolverMap>, string>,
  TReturn extends object = TData & TResolvedData,
>(
  data: TData,
  resolverMap: TResolverMap
): Promise<TReturn> => {
  const resolvedDataArray = await Promise.all(
    Object.entries(resolverMap).flatMap(async ([urlKey, destinationField]) => {
      if (!isKeyOf(data, urlKey)) return []
      const url = data[urlKey]
      if (!url) return []
      if (typeof destinationField !== 'string') return []
      if (typeof url !== 'string') return []

      const resolvedUrl = await resolveUrl(url)
      return { [destinationField]: resolvedUrl }
    })
  )

  const resolvedData = Object.assign({}, ...resolvedDataArray) as TResolvedData

  return { ...data, ...resolvedData } as unknown as TReturn
}
