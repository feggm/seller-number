import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"

export default function WelcomePage() {
  const [message, setMessage] = useState<string>(
    "Schade, es scheint weder normale Verkaufsnummern noch Babynummern mehr für dich zu geben. Vielleicht klappts ja beim Nächsten mal...",
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md overflow-hidden shadow-md border-0">
        <div className="bg-gradient-to-r from-sky-500 to-cyan-400 p-6">
          <h1 className="text-2xl font-medium text-white">Willkommen</h1>
        </div>

        <CardContent className="p-6 space-y-6">
          <p className="text-slate-700 leading-relaxed">
            Diese kleine Website soll dir helfen, ohne große Umstände und besetzte Telefonleitungen deine Verkaufsnummer
            für den Kinderkleidermarkt in Gummersbach zu ziehen.
          </p>

          <p className="text-slate-700 leading-relaxed">
            Für Verkäufer, die mehr als 2/3 der zu verkaufenden Kleidung in Größe 86 oder kleiner haben, bieten wir
            spezielle <span className="font-semibold text-sky-600">Baby-Verkaufsnummern</span> an. Aber natürlich dürfen
            auch die normalen Nummern gerne für den Verkauf von Babykleidung genutzt werden.
          </p>

          <p className="text-slate-700 leading-relaxed">
            Sobald du auf einen Button klickst, reservieren wir eine Nummer für dich. Du hast dann 4 Minuten Zeit, um
            deine Registrierung abzuschließen.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                className="relative bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm px-5 py-6 h-auto font-medium rounded-lg"
              >
                VERKÄUFERNUMMER
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                  0
                </span>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                className="relative bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm px-5 py-6 h-auto font-medium rounded-lg"
              >
                BABYNUMMER
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                  0
                </span>
              </Button>
            </motion.div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-slate-600 italic">{message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

