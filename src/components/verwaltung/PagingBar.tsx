import { Button } from '@/components/ui/button'

import { type PageView } from './usePaging'

/** The bar under a paged list; nothing when the list fits on one page. */
export function PagingBar({ view: v, noun }: { view: PageView<unknown>; noun: string }) {
  if (v.total <= v.state.size) return null
  const s = v.state
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {s.all ? (
        <>
          <span className="text-muted-foreground">alle {String(v.total)} {noun}</span>
          <Button size="sm" variant="outline" onClick={() => { s.setAll(false); }}>
            je {String(v.state.size)}
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" disabled={v.page === 0} onClick={() => { s.setPage(v.page - 1); }}>
            ‹ zurück
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {String(v.start + 1)}–{String(v.end)} von {String(v.total)} {noun}
          </span>
          <Button size="sm" variant="outline" disabled={v.page >= v.pages - 1} onClick={() => { s.setPage(v.page + 1); }}>
            weiter ›
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { s.setAll(true); }}>
            alle anzeigen
          </Button>
        </>
      )}
    </div>
  )
}
