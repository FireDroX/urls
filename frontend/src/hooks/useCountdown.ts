import { useEffect, useState } from 'react'

export function useCountdown() {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (secondsRemaining === null) return
    if (secondsRemaining <= 0) {
      setSecondsRemaining(null)
      return
    }
    const timer = setTimeout(() => setSecondsRemaining((seconds) => (seconds ?? 0) - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsRemaining])

  return { secondsRemaining, start: setSecondsRemaining }
}
