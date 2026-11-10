import { useCallback, useEffect, useState } from 'react'
import { listDrops, type Drop } from '#api/drops'

export type DropsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; drops: Drop[] }

export interface UseDrops {
  state: DropsState
  reload: () => void
  add: (drop: Drop) => void
  replace: (previousId: string, drop: Drop) => void
  remove: (id: string) => void
}

export function useDrops(): UseDrops {
  const [state, setState] = useState<DropsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    listDrops()
      .then((drops) => {
        if (!cancelled) setState({ status: 'ready', drops })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const update = useCallback((change: (drops: Drop[]) => Drop[]) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', drops: change(current.drops) } : current))
  }, [])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const add = useCallback((drop: Drop) => update((drops) => [drop, ...drops]), [update])

  const replace = useCallback(
    (previousId: string, drop: Drop) => update((drops) => drops.map((item) => (item.id === previousId ? drop : item))),
    [update],
  )

  const remove = useCallback((id: string) => update((drops) => drops.filter((item) => item.id !== id)), [update])

  return { state, reload, add, replace, remove }
}
