import { useState } from 'react'

export const PAGE = 20

export type Paging = {
  start: number
  end: number
  total: number
  page: number
  pages: number
  all: boolean
  setPage: (page: number) => void
  setAll: (all: boolean) => void
}

/**
 * Twenty rows at a time, with "alle anzeigen". `resetKey` names what the list depends on
 * (filter, sort, event …) — when it changes the paging goes back to the first page.
 */
export const usePaging = (total: number, resetKey: string): Paging => {
  const [page, setPage] = useState(0)
  const [all, setAll] = useState(false)
  const [seenKey, setSeenKey] = useState(resetKey)
  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setPage(0)
  }
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const current = Math.min(page, pages - 1)
  const start = all ? 0 : current * PAGE
  const end = all ? total : Math.min(total, start + PAGE)
  return { start, end, total, page: current, pages, all, setPage, setAll }
}

export const pageOf = <T,>(rows: T[], p: Paging) => rows.slice(p.start, p.end)
