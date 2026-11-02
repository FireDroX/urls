import { useCallback, useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { getLink, getLinkStats, type Link, type LinkStats } from '#api/links'

const NOT_FOUND = 404

export type LoadState<T> = { status: 'loading' } | { status: 'notFound' } | { status: 'error' } | { status: 'ready'; value: T }

function failureState(error: unknown): LoadState<never> {
  return isAxiosError(error) && error.response?.status === NOT_FOUND ? { status: 'notFound' } : { status: 'error' }
}

function useLoader<T>(load: (signal: AbortSignal) => Promise<T>): { state: LoadState<T>; reload: () => void } {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setState({ status: 'ready', value })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState(failureState(error))
      })
    return () => controller.abort()
  }, [load, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, reload }
}

export function useLink(id: string) {
  const load = useCallback((signal: AbortSignal) => getLink(id, signal), [id])
  return useLoader<Link>(load)
}

export function useLinkStats(id: string, days: number) {
  const load = useCallback((signal: AbortSignal) => getLinkStats(id, days, signal), [id, days])
  return useLoader<LinkStats>(load)
}
