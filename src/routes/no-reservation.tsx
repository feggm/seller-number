import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/no-reservation')({
  component: Index,
})

function Index() {
  const navigate = useNavigate()
  const handleRestart = () => {
    void navigate({ to: '/' })
  }

  return (
    <PageCard title="Keine Nummer mehr frei">
      <p className="text-slate-700 leading-relaxed">
        Leider gibt es für deine Anfrage keine freien Nummern mehr.
      </p>

      <p className="text-slate-700 leading-relaxed">
        Da war hat dir wohl gerade jemand die letzte Nummer vor der Nase
        weggeschnappt.
      </p>

      <p className="text-slate-700 leading-relaxed">
        Versuche es doch noch einmal...
      </p>

      <div className="flex justify-center pt-4">
        <PageButton onClick={handleRestart}>NEU STARTEN</PageButton>
      </div>
    </PageCard>
  )
}
