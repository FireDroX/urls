import { useCallback, useEffect, useState } from 'react'
import type { ListParams } from '#api/list-params'
import { listShares, type Share } from '#api/shares'

export type SharesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; shares: Share[]; total: number; page: number; pageSize: number }

export interface UseShares {
  state: SharesState
  reload: () => void
  refresh: () => void
  replace: (previousId: string, share: Share) => void
}

export function useShares(params: ListParams): UseShares {
  const [state, setState] = useState<SharesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    listShares(JSON.parse(key) as ListParams)
      .then((result) => {
        if (cancelled) return
        setState({ status: 'ready', shares: result.items, total: result.total, page: result.page, pageSize: result.pageSize })
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

  const replace = useCallback((previousId: string, share: Share) => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, shares: current.shares.map((item) => (item.id === previousId ? share : item)) }
        : current,
    )
  }, [])

  return { state, reload, refresh, replace }
}
