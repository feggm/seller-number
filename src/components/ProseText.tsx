import { LoadingSkeletonForGrandChildren } from './LoadingSkeleton'

export const ProseText = ({ text }: { text?: string }) => {
  return (
    <LoadingSkeletonForGrandChildren>
      <div
        className="text-slate-700 leading-relaxed space-y-4 prose max-w-prose"
        // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
        dangerouslySetInnerHTML={{
          __html: text ?? '<pre> </pre><pre> </pre><pre> </pre>',
        }}
      ></div>
    </LoadingSkeletonForGrandChildren>
  )
}
