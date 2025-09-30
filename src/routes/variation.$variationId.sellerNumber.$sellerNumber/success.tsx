import { useSellerNumberRegistrationData } from '@/clients/useSellerNumberRegistrationMutation'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import { IsLoadingProvider } from '@/components/LoadingSkeleton'
import { PageCard } from '@/components/PageCard'
import { ProseText } from '@/components/ProseText'
import { CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/variation/$variationId/sellerNumber/$sellerNumber/success'
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { sellerNumber } = Route.useParams()
  const { data: sellerNumbers } = useSellerNumbersQuery()
  const sellerDetails = useSellerNumberRegistrationData({
    sellerNumberId: sellerNumber,
  })

  // Find the seller number record to get the actual number
  const sellerNumberRecord = sellerNumbers?.find(
    (number) => number.id === sellerNumber
  )

  return (
    <IsLoadingProvider isLoading={!sellerNumbers || !sellerDetails}>
      <PageCard title="Das hat geklappt">
        <CardContent className="p-6 space-y-6 overflow-y-auto">
          {/* Big first line with the seller number */}
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">
              Deine Nummer:{' '}
              <pre className="bg-gray-300 inline-block p-1.5 rounded">
                {sellerNumberRecord?.sellerNumberNumber}
              </pre>
            </h1>
          </div>

          {/* Table with seller information */}
          {sellerDetails && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Deine Daten:</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feld</TableHead>
                    <TableHead>Wert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Vorname</TableCell>
                    <TableCell>
                      {sellerDetails.request.sellerFirstName}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Nachname</TableCell>
                    <TableCell>
                      {sellerDetails.request.sellerLastName}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">E-Mail</TableCell>
                    <TableCell>{sellerDetails.request.sellerEmail}</TableCell>
                  </TableRow>
                  {sellerDetails.request.sellerPhone && (
                    <TableRow>
                      <TableCell className="font-medium">Telefon</TableCell>
                      <TableCell>{sellerDetails.request.sellerPhone}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Information text */}
          <div className="bg-blue-50 -mx-3 p-3 rounded-lg">
            <ProseText>
              Bitte beachte: Du bekommst eine E-Mail an{' '}
              <strong>{sellerDetails?.request.sellerEmail}</strong>, wo alle
              wichtigen Daten noch einmal enthalten sind. Falls du keine E-Mail
              bekommst, überprüfe dein Spam Filter. Wenn alles nicht hilft,
              wende dich an{' '}
              <a
                href="mailto:verkaufsnummer@kleidermarkt-gummersbach.de"
                className="text-blue-600 underline"
              >
                verkaufsnummer@kleidermarkt-gummersbach.de
              </a>
              .
            </ProseText>
          </div>
        </CardContent>
      </PageCard>
    </IsLoadingProvider>
  )
}
