import { PropsWithChildren } from 'react'

import { LoadingSkeletonForGrandChildren } from './LoadingSkeleton'

export const ProseText = ({
  text,
  children,
}: PropsWithChildren<{ text?: string }>) => {
  const className = 'text-slate-700 leading-relaxed space-y-4 prose max-w-prose'
  return (
    <LoadingSkeletonForGrandChildren>
      {children ? (
        <div className={className}>{children}</div>
      ) : (
        <div
          className={className}
          // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{
            __html: text ?? '<pre> </pre><pre> </pre><pre> </pre>',
          }}
        ></div>
      )}
    </LoadingSkeletonForGrandChildren>
  )
}
