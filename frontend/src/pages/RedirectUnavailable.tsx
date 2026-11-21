import { useParams } from 'react-router'
import { useRedirectStatus } from '#hooks/useRedirectStatus'
import { LinkExpired } from '#pages/LinkExpired'
import { NotFound } from '#pages/NotFound'

export function RedirectUnavailable() {
  const { id = '' } = useParams()
  const status = useRedirectStatus(id)

  if (status === 'loading') {
    return null
  }
  return status === 'expired' ? <LinkExpired /> : <NotFound />
}
