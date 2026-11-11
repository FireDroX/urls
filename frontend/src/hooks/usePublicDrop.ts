import { useCallback, useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { getPublicDrop, type PublicDrop } from '#api/public-drops'
import { extractErrorMessage } from '#lib/api-errors'

const NOT_FOUND = 404
const GONE = 410

export type PublicDropState =
  | { status: 'loading' }
  | { status: 'ready'; drop: PublicDrop; closedWhileOpen: boolean }
  | { status: 'notFound' }
  | { status: 'closed' }
  | { status: 'failed'; message: string }

function unavailableState(error: unknown): PublicDropState {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === NOT_FOUND) {
    return { status: 'notFound' }
  }
  if (status === GONE) {
    return { status: 'closed' }
  }
  return { status: 'failed', message: extractErrorMessage(error) }
}

export function usePublicDrop(id: string) {
  const [state, setState] = useState<PublicDropState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    getPublicDrop(id, controller.signal)
      .then((drop) => setState({ status: 'ready', drop, closedWhileOpen: false }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState(unavailableState(error))
        }
      })
    return () => controller.abort()
  }, [id, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  const refresh = useCallback(() => {
    getPublicDrop(id)
      .then((drop) => setState({ status: 'ready', drop, closedWhileOpen: false }))
      .catch((error: unknown) => {
        const status = isAxiosError(error) ? error.response?.status : undefined
        if (status === GONE || status === NOT_FOUND) {
          setState((current) => (current.status === 'ready' ? { ...current, closedWhileOpen: true } : current))
        }
      })
  }, [id])

  return { state, reload, refresh }
}
