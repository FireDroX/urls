import { useCallback, useEffect, useState } from 'react'
import type { ListParams } from '#api/list-params'
import { listAllLinks, type AnyLink } from '#api/links'

export type AllLinksState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; links: AnyLink[]; total: number; page: number; pageSize: number }

export interface UseAllLinks {
  state: AllLinksState
  reload: () => void
}

export function useAllLinks(params: ListParams): UseAllLinks {
  const [state, setState] = useState<AllLinksState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    listAllLinks(JSON.parse(key) as ListParams)
      .then((result) => {
        if (cancelled) return
        setState({ status: 'ready', links: result.items, total: result.total, page: result.page, pageSize: result.pageSize })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  return { state, reload }
}
