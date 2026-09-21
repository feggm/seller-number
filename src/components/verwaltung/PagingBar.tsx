import { Button } from '@/components/ui/button'

import { PAGE, type Paging } from './usePaging'

/** The bar under a paged list; nothing when the list fits on one page. */
export function PagingBar({ paging: p, noun }: { paging: Paging; noun: string }) {
  if (p.total <= PAGE) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {p.all ? (
        <>
          <span className="text-muted-foreground">alle {String(p.total)} {noun}</span>
          <Button size="sm" variant="outline" onClick={() => { p.setAll(false); }}>
            je {String(PAGE)}
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" disabled={p.page === 0} onClick={() => { p.setPage(p.page - 1); }}>
            ‹ zurück
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {String(p.start + 1)}–{String(p.end)} von {String(p.total)} {noun}
          </span>
          <Button size="sm" variant="outline" disabled={p.page >= p.pages - 1} onClick={() => { p.setPage(p.page + 1); }}>
            weiter ›
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { p.setAll(true); }}>
            alle anzeigen
          </Button>
        </>
      )}
    </div>
  )
}
