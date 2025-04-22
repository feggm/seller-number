import { useEventCategoryQuery } from '@/clients/useEventCategoryQuery'
import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const message =
    'Schade, es scheint weder normale Verkaufsnummern noch Babynummern mehr für dich zu geben. Vielleicht klappts ja beim Nächsten mal...'

  const { data } = useEventCategoryQuery('14oj16us9lza6h6')

  return (
    <PageCard title="Willkommen">
      <div
        className="text-slate-700 leading-relaxed"
        // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
        dangerouslySetInnerHTML={{ __html: data?.introText ?? '' }}
      ></div>

      <div className="flex flex-wrap gap-4 pt-2">
        <PageButton counter={0}>Verkäufernummer</PageButton>
        <PageButton counter={0}>Babynummer</PageButton>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-100">
        <p className="text-slate-600 italic">{message}</p>
      </div>
    </PageCard>
  )
}
