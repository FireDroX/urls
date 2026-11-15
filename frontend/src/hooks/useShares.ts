import { useCallback, useEffect, useState } from 'react'
import { fetchAllPages } from '#utils/fetch-all-pages'
import { listShares, type Share } from '#api/shares'

export type SharesState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; shares: Share[] }

export interface UseShares {
  state: SharesState
  reload: () => void
  add: (share: Share) => void
  replace: (previousId: string, share: Share) => void
  remove: (id: string) => void
}

export function useShares(): UseShares {
  const [state, setState] = useState<SharesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchAllPages(listShares)
      .then((shares) => {
        if (!cancelled) setState({ status: 'ready', shares })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const update = useCallback((change: (shares: Share[]) => Share[]) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', shares: change(current.shares) } : current))
  }, [])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const add = useCallback((share: Share) => update((shares) => [share, ...shares]), [update])

  const replace = useCallback(
    (previousId: string, share: Share) =>
      update((shares) => shares.map((item) => (item.id === previousId ? share : item))),
    [update],
  )

  const remove = useCallback((id: string) => update((shares) => shares.filter((item) => item.id !== id)), [update])

  return { state, reload, add, replace, remove }
}
