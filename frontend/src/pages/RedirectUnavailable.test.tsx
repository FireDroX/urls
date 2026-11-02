import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRedirectStatus } from '#api/redirects'
import i18n from '#lib/i18n'
import { RedirectUnavailable } from './RedirectUnavailable'

vi.mock('#api/redirects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/redirects')>()),
  getRedirectStatus: vi.fn(),
}))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/r/:id" element={<RedirectUnavailable />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(async () => {
  vi.mocked(getRedirectStatus).mockReset()
  await i18n.changeLanguage('fr')
})

describe('RedirectUnavailable', () => {
  it('shows the expired page for an expired link', async () => {
    vi.mocked(getRedirectStatus).mockResolvedValue('expired')

    renderAt('/r/abc123')

    expect(await screen.findByRole('heading', { name: 'Lien expiré' })).toBeInTheDocument()
    expect(getRedirectStatus).toHaveBeenCalledWith('abc123', expect.any(AbortSignal))
  })

  it('shows the not found page for a missing, disabled or deleted link', async () => {
    vi.mocked(getRedirectStatus).mockResolvedValue('notFound')

    renderAt('/r/abc123')

    expect(await screen.findByRole('heading', { name: 'Lien introuvable' })).toBeInTheDocument()
  })

  it('shows the not found page when the status cannot be read', async () => {
    vi.mocked(getRedirectStatus).mockRejectedValue(new TypeError('Failed to fetch'))

    renderAt('/r/abc123')

    expect(await screen.findByRole('heading', { name: 'Lien introuvable' })).toBeInTheDocument()
  })

  it('follows the site language', async () => {
    await i18n.changeLanguage('en')
    vi.mocked(getRedirectStatus).mockResolvedValue('expired')

    renderAt('/r/abc123')

    expect(await screen.findByRole('heading', { name: 'Link expired' })).toBeInTheDocument()
  })
})
