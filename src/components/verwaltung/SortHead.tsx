import { TableHead } from '@/components/ui/table'

import type { SortState } from './helpers'

/** The clickable label with its ▲/▼/⇅ marker — without the TableHead, for a header cell
 *  that carries more than one sort key. */
export function SortButton<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onToggle: (key: K) => void
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded px-1 hover:bg-slate-100 hover:underline"
      title="sortieren"
      onClick={() => { onToggle(sortKey); }}
    >
      {label}
      <span aria-hidden className={sort.key === sortKey ? '' : 'text-muted-foreground/60'}>
        {sort.key === sortKey ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}
      </span>
    </button>
  )
}

export function SortHead<K extends string>({
  className,
  ...button
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onToggle: (key: K) => void
  className?: string
}) {
  return (
    <TableHead className={className}>
      <SortButton {...button} />
    </TableHead>
  )
}
