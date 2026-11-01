import { useEffect, useId, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_ID = 'cf-turnstile-script'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        },
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve()
  }
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    return new Promise((resolve) => existing.addEventListener('load', () => resolve()))
  }
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.addEventListener('load', () => resolve())
    document.head.appendChild(script)
  })
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire: () => void
  resetKey?: number
}

export function TurnstileWidget({ onVerify, onExpire, resetKey = 0 }: TurnstileWidgetProps) {
  const containerId = useId()
  const widgetIdRef = useRef<string | null>(null)
  const callbacksRef = useRef({ onVerify, onExpire })
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire }
  })

  useEffect(() => {
    if (!siteKey) {
      callbacksRef.current.onVerify('')
      return
    }
    let cancelled = false
    void loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(`#${CSS.escape(containerId)}`, {
        sitekey: siteKey,
        callback: (token) => callbacksRef.current.onVerify(token),
        'expired-callback': () => callbacksRef.current.onExpire(),
        'error-callback': () => callbacksRef.current.onExpire(),
      })
    })
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey, containerId])

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
      callbacksRef.current.onExpire()
    }
  }, [resetKey])

  if (!siteKey) {
    return null
  }
  return <div id={containerId} className="min-h-[65px]" />
}
