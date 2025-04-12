import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const message =
    'Schade, es scheint weder normale Verkaufsnummern noch Babynummern mehr für dich zu geben. Vielleicht klappts ja beim Nächsten mal...'

  return (
    <PageCard title="Willkommen">
      <p className="text-slate-700 leading-relaxed">
        Diese kleine Website soll dir helfen, ohne große Umstände und besetzte
        Telefonleitungen deine Verkaufsnummer für den Kinderkleidermarkt in
        Gummersbach zu ziehen.
      </p>

      <p className="text-slate-700 leading-relaxed">
        Für Verkäufer, die mehr als 2/3 der zu verkaufenden Kleidung in Größe 86
        oder kleiner haben, bieten wir spezielle{' '}
        <span className="font-semibold text-sky-600">Baby-Verkaufsnummern</span>{' '}
        an. Aber natürlich dürfen auch die normalen Nummern gerne für den
        Verkauf von Babykleidung genutzt werden.
      </p>

      <p className="text-slate-700 leading-relaxed">
        Sobald du auf einen Button klickst, reservieren wir eine Nummer für
        dich. Du hast dann 4 Minuten Zeit, um deine Registrierung abzuschließen.
      </p>

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
