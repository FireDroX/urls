import { useEffect, useState } from 'react'
import { getLinksHealth } from '#api/links'
import { subscribeLinkHealthRefresh } from '#lib/link-health-refresh'

export function useBrokenLinksCount(): number | null {
  const [count, setCount] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => subscribeLinkHealthRefresh(() => setAttempt((value) => value + 1)), [])

  useEffect(() => {
    let cancelled = false
    getLinksHealth()
      .then(({ broken }) => {
        if (!cancelled) setCount(broken)
      })
      .catch(() => {
        if (!cancelled) setCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return count
}
