import { useCallback, useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { getPublicShare, type PublicShare } from '#api/public-shares'
import { extractErrorMessage } from '#lib/api-errors'

const NOT_FOUND = 404
const GONE = 410

export type PublicShareState =
  | { status: 'loading' }
  | { status: 'ready'; share: PublicShare }
  | { status: 'notFound' }
  | { status: 'expired' }
  | { status: 'failed'; message: string }

function unavailableState(error: unknown): PublicShareState {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === NOT_FOUND) {
    return { status: 'notFound' }
  }
  if (status === GONE) {
    return { status: 'expired' }
  }
  return { status: 'failed', message: extractErrorMessage(error) }
}

export function usePublicShare(id: string) {
  const [state, setState] = useState<PublicShareState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    getPublicShare(id, controller.signal)
      .then((share) => setState({ status: 'ready', share }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState(unavailableState(error))
        }
      })
    return () => controller.abort()
  }, [id, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  const expire = useCallback(() => setState({ status: 'expired' }), [])

  return { state, expire, reload }
}
