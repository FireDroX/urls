export type RedirectStatus = 'active' | 'expired' | 'notFound'

const GONE = 410

export function redirectPath(id: string): string {
  return `/r/${encodeURIComponent(id)}`
}

export async function getRedirectStatus(id: string, signal?: AbortSignal): Promise<RedirectStatus> {
  const response = await fetch(redirectPath(id), {
    redirect: 'manual',
    cache: 'no-store',
    credentials: 'omit',
    signal,
  })
  if (response.type === 'opaqueredirect') {
    return 'active'
  }
  return response.status === GONE ? 'expired' : 'notFound'
}
