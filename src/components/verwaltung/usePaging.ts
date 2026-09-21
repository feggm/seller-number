import { useState } from 'react'

export const PAGE = 20

export type PagingState = {
  size: number
  page: number
  all: boolean
  setPage: (page: number) => void
  setAll: (all: boolean) => void
}

export type PageView<T> = {
  rows: T[]
  start: number
  end: number
  total: number
  page: number
  pages: number
  state: PagingState
}

/**
 * Twenty rows at a time, with "alle anzeigen". `resetKey` names what the list depends on
 * (filter, sort, event …) — when it changes the paging goes back to the first page. The hook
 * holds only the state, so it can sit above a component's early returns; `pageOf` does the
 * cutting once the rows are known.
 */
export const usePaging = (resetKey: string, size = PAGE): PagingState => {
  const [page, setPage] = useState(0)
  const [all, setAll] = useState(false)
  const [seenKey, setSeenKey] = useState(resetKey)
  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setPage(0)
  }
  return { size, page, all, setPage, setAll }
}

export const pageOf = <T,>(rows: T[], state: PagingState): PageView<T> => {
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / state.size))
  const page = Math.min(state.page, pages - 1)
  const start = state.all ? 0 : page * state.size
  const end = state.all ? total : Math.min(total, start + state.size)
  return { rows: rows.slice(start, end), start, end, total, page, pages, state }
}
