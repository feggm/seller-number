/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
import { isKeyOf } from '@/lib/isKeyOf'
import { get } from 'lodash-es'

import { pb } from './pocketbase'

type KeyableValue<TObject extends object> =
  TObject[keyof TObject] extends string ? TObject[keyof TObject] : never

const stringify = (value: unknown) => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const resolveUrl = async (url: string) => {
  const hash = new URL(url).hash.slice(1)
  const fetchResult = await pb.send<unknown>('/api/seller-number/cors-proxy', {
    query: { url },
  })
  const pickedValue = (hash ? get(fetchResult, hash) : fetchResult) as unknown
  return pickedValue ? stringify(pickedValue) : undefined
}

export const withUrlResolving = async <
  TData extends object,
  TResolverMap extends Partial<Record<keyof TData, string>>,
  TResolvedData extends object = Record<KeyableValue<TResolverMap>, string>,
  TReturn extends object = TData & TResolvedData,
>(
  data: TData,
  {
    resolverMap,
    throwOnError,
  }: {
    resolverMap: TResolverMap
    throwOnError?: boolean
  }
): Promise<TReturn> => {
  const resolvedDataArray = await Promise.all(
    Object.entries(resolverMap).flatMap(async ([urlKey, destinationField]) => {
      if (!isKeyOf(data, urlKey)) return []
      const url = data[urlKey]
      if (!url) return []
      if (typeof destinationField !== 'string') return []
      if (typeof url !== 'string') return []

      const resolvedUrl = await resolveUrl(url).catch(() =>
        throwOnError
          ? Promise.reject(new Error(`Failed to resolve URL: ${url}`))
          : undefined
      )
      if (resolvedUrl === undefined) return []

      return { [destinationField]: resolvedUrl }
    })
  )

  const resolvedData = Object.assign({}, ...resolvedDataArray) as TResolvedData

  return { ...data, ...resolvedData } as unknown as TReturn
}
