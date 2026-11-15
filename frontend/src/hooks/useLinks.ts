import { useCallback, useEffect, useState } from 'react'
import { fetchAllPages } from '#utils/fetch-all-pages'
import { listLinks, type Link } from '#api/links'

export type LinksState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; links: Link[] }

export interface UseLinks {
  state: LinksState
  reload: () => void
  add: (link: Link) => void
  replace: (previousId: string, link: Link) => void
  remove: (id: string) => void
}

export function useLinks(): UseLinks {
  const [state, setState] = useState<LinksState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchAllPages(listLinks)
      .then((links) => {
        if (!cancelled) setState({ status: 'ready', links })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const update = useCallback((change: (links: Link[]) => Link[]) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', links: change(current.links) } : current))
  }, [])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const add = useCallback((link: Link) => update((links) => [link, ...links]), [update])

  const replace = useCallback(
    (previousId: string, link: Link) => update((links) => links.map((item) => (item.id === previousId ? link : item))),
    [update],
  )

  const remove = useCallback((id: string) => update((links) => links.filter((item) => item.id !== id)), [update])

  return { state, reload, add, replace, remove }
}
