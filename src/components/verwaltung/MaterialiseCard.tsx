import type { Event } from '@/clients/admin/useRegisterQueries'
import {
  useMaterialiseMutation,
  type MaterialiseResponse,
  type MaterialiseResult,
} from '@/clients/admin/useRegisterMutations'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'

import { Field, Select } from './fields'
import { formatDay } from './helpers'

const RESULT_LABEL: Record<MaterialiseResult['result'], { text: string; cls: string }> = {
  created: { text: 'reserviert', cls: 'bg-emerald-100 text-emerald-800' },
  updated: { text: 'nachgezogen', cls: 'bg-sky-100 text-sky-800' },
  already: { text: 'schon drin', cls: 'bg-slate-200 text-slate-700' },
  conflict: { text: 'Konflikt', cls: 'bg-red-100 text-red-800' },
  notInPool: { text: 'nicht im Pool', cls: 'bg-amber-100 text-amber-800' },
  skipped: { text: 'übersprungen', cls: 'bg-amber-100 text-amber-800' },
  stale: { text: 'veraltet', cls: 'bg-orange-100 text-orange-800' },
}

const ORDER: MaterialiseResult['result'][] = [
  'conflict',
  'notInPool',
  'skipped',
  'stale',
  'updated',
  'created',
  'already',
]

/** Register → event: dry run first, always; the real run only behind the dialog and only
 *  after a dry run of the same event, so what gets written is what was just read. */
export function MaterialiseCard({ events, registerTerm }: { events: Event[]; registerTerm: string }) {
  const upcoming = events.filter((e) => e.eventDate >= new Date().toISOString().slice(0, 10))
  const [eventId, setEventId] = useState(
    upcoming.length > 0 ? upcoming[upcoming.length - 1].id : (events[0]?.id ?? '')
  )
  const [report, setReport] = useState<MaterialiseResponse | null>(null)
  const materialise = useMaterialiseMutation()

  const run = async (dryRun: boolean) => {
    const result = await materialise.mutateAsync({ eventId, dryRun })
    setReport(result)
    if (!dryRun) {
      toast.success(
        `Materialisiert: ${String(result.counts.created ?? 0)} reserviert, ${String(result.counts.updated ?? 0)} nachgezogen`
      )
    }
  }

  const dryRunMatches = report?.dryRun === true && report.event.id === eventId
  // A past market is closed for the register too: nothing is written into it any more.
  const isPast = !upcoming.some((u) => u.id === eventId)
  const blocking = report ? (report.counts.conflict ?? 0) + (report.counts.notInPool ?? 0) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
        <Field label="Event">
          <Select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value)
              setReport(null)
            }}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.eventName} — {formatDay(e.eventDate)}
                {upcoming.some((u) => u.id === e.id) ? '' : ' (vergangen)'}
              </option>
            ))}
          </Select>
        </Field>
        <div className="self-end">
          <Button variant="outline" disabled={!eventId || isPast || materialise.isPending} onClick={() => void run(true)}>
            Probelauf
          </Button>
        </div>
        <div className="self-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!dryRunMatches || isPast || materialise.isPending}>
                Materialisieren
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Register in das Event schreiben?</AlertDialogTitle>
                <AlertDialogDescription>
                  {report && (
                    <>
                      {report.event.eventName}: {report.counts.created ?? 0} Nummern werden
                      reserviert, {report.counts.updated ?? 0} nachgezogen
                      {blocking > 0 && (
                        <>
                          {' '}
                          — <strong>{blocking} Zeilen bleiben liegen</strong> (Konflikt / nicht
                          im Pool), sie brechen den Lauf nicht ab
                        </>
                      )}
                      . Das ist genau der Probelauf von eben.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => void run(false)}>Ja, schreiben</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {isPast && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          Vergangenes Event — in einen gelaufenen Markt wird nichts mehr geschrieben.
        </p>
      )}
      <div className="text-muted-foreground space-y-1 text-xs">
        <p>
          Trägt jede aktive {registerTerm} als Registrierung in das Event ein — so, als hätte die Person sich
          selbst angemeldet. Danach steht sie im Export für die Kasse. Vorher zeigt der <strong>Probelauf</strong>,
          was passieren würde, ohne etwas zu speichern.
        </p>
        <p>
          Voraussetzung: das Event hat einen {registerTerm}n-Pool, der die Nummern enthält (Tab „Pools"). Fehlt
          eine Nummer dort, meldet der Probelauf „nicht im Pool".
        </p>
      </div>

      {report && <Report report={report} />}
    </div>
  )
}

function Report({ report }: { report: MaterialiseResponse }) {
  const grouped = ORDER.map((key) => ({
    key,
    rows: report.results.filter((r) => r.result === key),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <strong>{report.dryRun ? 'Probelauf' : 'Materialisiert'}</strong>
        <span className="text-muted-foreground">
          {report.event.eventName} · {report.registerRows} aktive Register-Zeilen
        </span>
        {grouped.map((g) => (
          <span key={g.key} className={`rounded px-2 py-0.5 text-xs ${RESULT_LABEL[g.key].cls}`}>
            {String(g.rows.length)}× {RESULT_LABEL[g.key].text}
          </span>
        ))}
      </div>
      {grouped
        .filter((g) => g.key !== 'already')
        .map((g) => (
          <div key={g.key}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {RESULT_LABEL[g.key].text}
            </div>
            <ul className="space-y-0.5 text-sm">
              {g.rows.map((r) => (
                <li key={`${r.result}-${String(r.number)}`} className="flex flex-wrap gap-x-2">
                  <span className="font-mono font-semibold">{r.number}</span>
                  {r.variationName && (
                    <span className="text-muted-foreground text-xs">{r.variationName}</span>
                  )}
                  {r.warning === 'noContactOnFile' && (
                    <span className="text-xs text-red-700">⚠ kein Kontakt hinterlegt</span>
                  )}
                  {r.warning === 'manualConfirmation' && (
                    <span className="text-xs text-amber-700">⚠ Bestätigung manuell</span>
                  )}
                  {r.changedFields && (
                    <span className="text-muted-foreground text-xs">
                      {r.changedFields.join(', ')}
                    </span>
                  )}
                  {r.registeredName && (
                    <span className="text-xs text-red-700">registriert von {r.registeredName}</span>
                  )}
                  {r.reason && <span className="text-muted-foreground text-xs">{r.reason}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}
