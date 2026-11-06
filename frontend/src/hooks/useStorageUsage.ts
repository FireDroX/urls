import { useEffect, useState } from 'react'
import { getStorageUsage, type StorageUsage } from '#api/storage'
import { subscribeStorageUsageRefresh } from '#lib/storage-usage-refresh'

export type StorageUsageState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; usage: StorageUsage }

export function useStorageUsage(): StorageUsageState {
  const [state, setState] = useState<StorageUsageState>({ status: 'loading' })

  const [attempt, setAttempt] = useState(0)

  useEffect(
    () => subscribeStorageUsageRefresh(() => setAttempt((value) => value + 1)),
    [],
  )

  useEffect(() => {
    let cancelled = false
    getStorageUsage()
      .then((usage) => {
        if (!cancelled) setState({ status: 'ready', usage })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return state
}
