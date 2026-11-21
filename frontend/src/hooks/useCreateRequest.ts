import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

export const CREATE_REQUEST_STATE = { create: true } as const

export function useCreateRequest(onRequest: () => void) {
  const location = useLocation()
  const navigate = useNavigate()
  const requested = (location.state as { create?: unknown } | null)?.create === true

  useEffect(() => {
    if (!requested) return
    onRequest()
    void navigate(location.pathname + location.search, { replace: true, state: null })
  }, [requested, onRequest, navigate, location.pathname, location.search])
}
