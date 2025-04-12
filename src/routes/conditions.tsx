import { PageButton } from '@/components/PageButton'
import { PageCard } from '@/components/PageCard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/conditions')({
  component: RouteComponent,
})

function RouteComponent() {
  const timeLeft = {
    minutes: 10,
    seconds: 30,
  }
  const handleAccept = () => {
    // Handle accept logic here
  }
  return (
    <PageCard
      title="Verkäuferinformationen"
      titleBarSuffix={
        <div className="text-xs whitespace-pre text-right">
          <span className="inline-block w-3 h-3 bg-white rounded-full animate-pulse"></span>
          Sitzung endet: {timeLeft.minutes}m {timeLeft.seconds}s
        </div>
      }
    >
      <div className="text-slate-700 leading-relaxed">
        <p className="mb-2">
          Wenn du auf dem Kleidermarkt <strong>verkaufen</strong> möchtest,
          benötigst du eine Verkaufsnummer.
        </p>
        <p className="mb-2">
          Die{' '}
          <a href="#" className="text-rose-500 hover:underline font-medium">
            Vergabe der Verkaufsnummern
          </a>{' '}
          erfolgt <strong>ausschließlich am Mittwoch, den 26.02.2025</strong>{' '}
          über unsere{' '}
          <a href="#" className="text-rose-500 hover:underline font-medium">
            Webseite
          </a>
          . Es wird jeweils um 8 und 20 Uhr ein Kontingent an Verkaufsnummern
          freigeschaltet. Bitte beachte, dass aus Fairness nur{' '}
          <strong>eine Verkaufsnummer pro Haushalt</strong> zulässig ist.
        </p>
      </div>

      <div className="text-slate-700 leading-relaxed">
        <p>
          Für Verkäufer, die mehr als 2/3 der zu verkaufenden Kleidung in Größe
          86 oder kleiner haben, bieten wir spezielle{' '}
          <span className="font-semibold text-sky-600">
            Baby-Verkaufsnummern
          </span>{' '}
          an. Aber natürlich dürfen auch die normalen Nummern für den Verkauf
          von Babykleidung genutzt werden.
        </p>
      </div>

      <div className="text-slate-700 leading-relaxed">
        <p>
          Die <strong>Kleiderabgabe</strong> wird am Donnerstag, den 27.03.2025
          von 18:00 bis 19:00 Uhr und am Freitag, den 28.03.2025 von 9:15 bis
          10:00 Uhr stattfinden.
        </p>
      </div>

      <div className="text-slate-700 leading-relaxed">
        <p>
          Die <strong>Kleiderrückgabe und Abrechnung</strong> findet am Samstag,
          den 29.03.2025, von 16:30 bis 17:00 Uhr statt.{' '}
          <em>
            Nicht abgeholte Kleidung und Geldbeträge werden nach der offiziellen
            Abholzeit als Spende verstanden und an unsere sozialen Projekte
            weitergegeben. Eine Kleiderrückgabe bzw. Auszahlung des Geldes ist
            dann nicht mehr möglich. Vielen Dank für dein Verständnis.
          </em>
        </p>
      </div>

      <div className="text-slate-700 leading-relaxed">
        <p>
          <strong>Auszeichnung:</strong> Unsere Richtlinien zum Auszeichnen der
          Kleidungsstücke sowie weitere Informationen findest du unter dem
          Menüpunkt{' '}
          <a href="#" className="text-rose-500 hover:underline font-medium">
            Richtlinien
          </a>
          .
        </p>
      </div>

      <div className="text-slate-700 leading-relaxed">
        <p>
          Zur Unterstützung unserer <strong>sozialen Projekte</strong> werden 15
          % des Verkaufserlöses einbehalten.
        </p>
      </div>

      <div className="text-slate-700 leading-relaxed">
        <p>
          Für beschädigte oder verloren gegangene Teile können wir keine Haftung
          übernehmen. Bitte melde dich bei uns, wenn du Kleidung oder
          Geldbeträge findest, die dir nicht gehören.
        </p>
      </div>

      <div className="flex justify-center pt-4">
        <PageButton onClick={handleAccept}>AKZEPTIEREN UND WEITER</PageButton>
      </div>
    </PageCard>
  )
}
