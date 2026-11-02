import { useEffect, useState } from 'react'
import { getRedirectStatus, redirectPath, type RedirectStatus } from '#api/redirects'

type UnavailableRedirectStatus = Exclude<RedirectStatus, 'active'>

export function useRedirectStatus(id: string): UnavailableRedirectStatus | 'loading' {
  const [status, setStatus] = useState<UnavailableRedirectStatus | 'loading'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getRedirectStatus(id, controller.signal)
      .then((result) => {
        if (result === 'active') {
          window.location.replace(redirectPath(id))
          return
        }
        setStatus(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('notFound')
        }
      })
    return () => controller.abort()
  }, [id])

  return status
}
