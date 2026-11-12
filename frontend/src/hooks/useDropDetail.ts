import { useCallback, useEffect, useState } from 'react'
import { getDrop, type DropDetail } from '#api/drops'
import { failureState, type LoadState } from '#hooks/useLinkDetail'
import { FILE_STATUS_POLL_MS } from '#hooks/useShareDetail'

export interface UseDropDetail {
  state: LoadState<DropDetail>
  reload: () => void
  refresh: () => void
  replace: (drop: DropDetail) => void
}

export function useDropDetail(id: string): UseDropDetail {
  const [state, setState] = useState<LoadState<DropDetail>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [refreshes, setRefreshes] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    getDrop(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setState({ status: 'ready', value })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState(failureState(error))
      })
    return () => controller.abort()
  }, [id, attempt])

  const silentRefresh = useCallback(
    (signal: AbortSignal) => {
      getDrop(id, signal)
        .then((value) => {
          if (!signal.aborted) setState({ status: 'ready', value })
        })
        .catch(() => undefined)
    },
    [id],
  )

  useEffect(() => {
    if (refreshes === 0) return
    const controller = new AbortController()
    silentRefresh(controller.signal)
    return () => controller.abort()
  }, [refreshes, silentRefresh])

  const verifying = state.status === 'ready' && state.value.files.some((file) => file.status === 'verifying')

  useEffect(() => {
    if (!verifying) return
    const controller = new AbortController()
    const timer = setInterval(() => silentRefresh(controller.signal), FILE_STATUS_POLL_MS)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [verifying, silentRefresh])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  const refresh = useCallback(() => setRefreshes((value) => value + 1), [])
  const replace = useCallback((value: DropDetail) => setState({ status: 'ready', value }), [])

  return { state, reload, refresh, replace }
}
