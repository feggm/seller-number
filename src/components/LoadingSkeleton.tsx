import { cn } from '@/lib/utils'
import { createContext, use } from 'react'

import { Skeleton } from './ui/skeleton'

const IsLoadingContext = createContext(false)

export const IsLoadingProvider = ({
  children,
  isLoading,
}: {
  children: React.ReactNode
  isLoading: boolean
}) => {
  return <IsLoadingContext value={isLoading}>{children}</IsLoadingContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useIsLoadingContext = () => {
  const isLoading = use(IsLoadingContext)
  return isLoading
}

export const LoadingSkeleton = ({
  children,
  ...props
}: Parameters<typeof Skeleton>[0]) => {
  const isLoading = useIsLoadingContext()
  return isLoading ? (
    <div className="relative">
      <div className="opacity-0">{children}</div>
      <Skeleton {...props} className={cn('inset-0 absolute')} />
    </div>
  ) : (
    children
  )
}

export const LoadingSkeletonForChildren = ({
  children,
  ...props
}: Parameters<typeof Skeleton>[0]) => {
  const isLoading = useIsLoadingContext()
  return isLoading ? (
    <div
      className={cn(
        '[&>*]:bg-accent [&>*]:animate-pulse [&>*]:rounded-md',
        props.className
      )}
    >
      {children}
    </div>
  ) : (
    children
  )
}

export const LoadingSkeletonForGrandChildren = ({
  children,
  className,
  ...props
}: Parameters<typeof Skeleton>[0]) => {
  const isLoading = useIsLoadingContext()
  return isLoading ? (
    <div
      className={cn(
        '[&>*>*]:bg-accent [&>*>*]:animate-pulse [&>*>*]:rounded-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  ) : (
    children
  )
}
