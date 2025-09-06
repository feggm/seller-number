import { useEventCategoryQuery } from '@/clients/useEventCategoryQuery'
import { useSellerNumbersQuery } from '@/clients/useSellerNumbersQuery'
import {
  IsLoadingProvider,
  LoadingSkeleton,
} from '@/components/LoadingSkeleton'
import { PageCard } from '@/components/PageCard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageTitleProvider } from '@/context/PageTitleContext'
import { useCurrentTime } from '@/hooks/useCurrentTime'
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { add } from 'date-fns'
import { useMemo, useState } from 'react'

export const Route = createFileRoute(
  '/variation/$variationId/sellerNumber/$sellerNumber/_withSessionCounter'
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { sellerNumber: sellerNumberId } = Route.useParams()

  const { data: eventCategory } = useEventCategoryQuery()
  const { data: sellerNumbers } = useSellerNumbersQuery()
  const sellerNumber = sellerNumbers?.find(
    (number) => number.id === sellerNumberId
  )

  const { getTimeDiff } = useCurrentTime()
  const timeLeft = useMemo(() => {
    if (!sellerNumber || !eventCategory || !sellerNumber.reservedAt) return
    return getTimeDiff(
      add(sellerNumber.reservedAt, {
        seconds: eventCategory.sessionTimeInSec,
      })
    )
  }, [sellerNumber, eventCategory, getTimeDiff])

  const isSessionExpired = useMemo(() => {
    if (!timeLeft) return false
    return timeLeft.seconds <= 0
  }, [timeLeft])

  const [title, setTitle] = useState('')

  const navigate = useNavigate()
  const navigateHome = () => {
    void navigate({ to: '/' })
  }

  return (
    <PageTitleProvider onTitleChange={setTitle}>
      <PageCard
        title={title}
        titleBarSuffix={
          <IsLoadingProvider isLoading={!timeLeft}>
            <div className="text-xs whitespace-pre text-right">
              <LoadingSkeleton>
                <span className="inline-block w-3 h-3 bg-white rounded-full animate-pulse"></span>
                {isSessionExpired ? (
                  <>Sitzung abgelaufen</>
                ) : (
                  <>
                    Sitzung endet: {(timeLeft?.minutes ?? 0) % 60}m{' '}
                    {(timeLeft?.seconds ?? 0) % 60}s{' '}
                  </>
                )}
              </LoadingSkeleton>
            </div>
          </IsLoadingProvider>
        }
      >
        <Outlet />
      </PageCard>

      <AlertDialog open={isSessionExpired}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deine Sitzung ist abgelaufen</AlertDialogTitle>
            <AlertDialogDescription>
              Deine Sitzung ist abgelaufen. Du musst die Sitzung neu starten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClickCapture={navigateHome}>
              Sitzung neu starten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTitleProvider>
  )
}
