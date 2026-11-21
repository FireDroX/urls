import { useCallback, useEffect, useState } from 'react'
import { getShare, type ShareDetail } from '#api/shares'
import { failureState, type LoadState } from '#hooks/useLinkDetail'

export const FILE_STATUS_POLL_MS = 3000

export interface UseShareDetail {
  state: LoadState<ShareDetail>
  reload: () => void
  replace: (share: ShareDetail) => void
}

export function useShareDetail(id: string, uploadsRevision: number): UseShareDetail {
  const [state, setState] = useState<LoadState<ShareDetail>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    getShare(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setState({ status: 'ready', value })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState(failureState(error))
      })
    return () => controller.abort()
  }, [id, attempt])

  const refresh = useCallback(
    (signal: AbortSignal) => {
      getShare(id, signal)
        .then((value) => {
          if (!signal.aborted) setState({ status: 'ready', value })
        })
        .catch(() => undefined)
    },
    [id],
  )

  useEffect(() => {
    if (uploadsRevision === 0) {
      return
    }
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [uploadsRevision, refresh])

  const verifying = state.status === 'ready' && state.value.files.some((file) => file.status === 'verifying')

  useEffect(() => {
    if (!verifying) {
      return
    }
    const controller = new AbortController()
    const timer = setInterval(() => refresh(controller.signal), FILE_STATUS_POLL_MS)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [verifying, refresh])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  const replace = useCallback((value: ShareDetail) => setState({ status: 'ready', value }), [])

  return { state, reload, replace }
}
