import { useCallback, useEffect, useState } from 'react'
import type { ListParams } from '#api/list-params'
import { listLinks, type Link } from '#api/links'

export type LinksState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; links: Link[]; total: number; page: number; pageSize: number }

export interface UseLinks {
  state: LinksState
  reload: () => void
  refresh: () => void
  replace: (previousId: string, link: Link) => void
}

export function useLinks(params: ListParams): UseLinks {
  const [state, setState] = useState<LinksState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    listLinks(JSON.parse(key) as ListParams)
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

  const refresh = useCallback(() => setAttempt((value) => value + 1), [])

  const replace = useCallback((previousId: string, link: Link) => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, links: current.links.map((item) => (item.id === previousId ? link : item)) }
        : current,
    )
  }, [])

  return { state, reload, refresh, replace }
}
