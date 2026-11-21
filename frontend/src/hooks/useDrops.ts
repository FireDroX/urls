import { useCallback, useEffect, useState } from 'react'
import type { ListParams } from '#api/list-params'
import { listDrops, type Drop } from '#api/drops'

export type DropsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; drops: Drop[]; total: number; page: number; pageSize: number }

export interface UseDrops {
  state: DropsState
  reload: () => void
  refresh: () => void
  replace: (previousId: string, drop: Drop) => void
}

export function useDrops(params: ListParams): UseDrops {
  const [state, setState] = useState<DropsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    listDrops(JSON.parse(key) as ListParams)
      .then((result) => {
        if (cancelled) return
        setState({ status: 'ready', drops: result.items, total: result.total, page: result.page, pageSize: result.pageSize })
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

  const replace = useCallback((previousId: string, drop: Drop) => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, drops: current.drops.map((item) => (item.id === previousId ? drop : item)) }
        : current,
    )
  }, [])

  return { state, reload, refresh, replace }
}
