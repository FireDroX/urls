import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicShare, requestShareDownload, type PublicShare } from '#api/public-shares'
import i18n from '#lib/i18n'
import { startDownload } from '#utils/start-download'
import { ShareDownload } from './ShareDownload'

vi.mock('#api/public-shares', () => ({
  getPublicShare: vi.fn(),
  requestShareDownload: vi.fn(),
}))

vi.mock('#utils/start-download', () => ({ startDownload: vi.fn() }))

vi.mock('#components/Turnstile', () => ({
  TurnstileWidget: ({ onVerify, resetKey = 0 }: { onVerify: (token: string) => void; resetKey?: number }) => {
    useEffect(() => {
      onVerify(`token-${resetKey}`)
    }, [onVerify, resetKey])
    return null
  },
}))

const share: PublicShare = {
  id: 'share123',
  expiresAt: null,
  fileCount: 2,
  totalSize: 3 * 1024 * 1024,
  files: [
    { id: 'file0001', name: 'rapport.pdf', size: 1024 * 1024 },
    { id: 'file0002', name: 'photos.zip', size: 2 * 1024 * 1024 },
  ],
}

function apiError(status: number, headers: Record<string, string> = {}): AxiosError {
  const response = {
    status,
    data: { error: 'failed' },
    headers: new AxiosHeaders(headers),
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('failed', undefined, undefined, undefined, response)
}

function renderAt(path = '/d/share123') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/d/:id" element={<ShareDownload />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(getPublicShare).mockResolvedValue(share)
  vi.mocked(requestShareDownload).mockResolvedValue('https://cdn.example/urls/key?X-Amz-Signature=abc')
})

afterEach(async () => {
  vi.resetAllMocks()
  await i18n.changeLanguage('fr')
})

describe('ShareDownload', () => {
  it('shows the files, their count, total size and expiry', async () => {
    renderAt()

    expect(await screen.findByRole('heading', { name: 'Fichiers partagés' })).toBeInTheDocument()
    expect(screen.getByText('2 fichiers · 3 Mio')).toBeInTheDocument()
    expect(screen.getByText("Sans date d'expiration")).toBeInTheDocument()
    expect(screen.getByText('rapport.pdf')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Télécharger photos.zip' })).toBeEnabled())
    expect(getPublicShare).toHaveBeenCalledWith('share123', expect.any(AbortSignal))
  })

  it('shows the expiration date', async () => {
    vi.mocked(getPublicShare).mockResolvedValue({ ...share, expiresAt: '2026-12-24T18:00:00.000Z' })

    renderAt()

    expect(await screen.findByText(/^Disponible jusqu'au .*2026/)).toBeInTheDocument()
  })

  it('downloads a file with the Turnstile token and asks a fresh token afterwards', async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(await screen.findByRole('button', { name: 'Télécharger rapport.pdf' }))
    await waitFor(() => expect(startDownload).toHaveBeenCalledWith('https://cdn.example/urls/key?X-Amz-Signature=abc'))
    expect(requestShareDownload).toHaveBeenCalledWith('share123', 'file0001', 'token-0')

    await user.click(screen.getByRole('button', { name: 'Télécharger photos.zip' }))
    await waitFor(() => expect(requestShareDownload).toHaveBeenLastCalledWith('share123', 'file0002', 'token-1'))
  })

  it.each([
    [404, 'Lien introuvable'],
    [410, 'Lien expiré'],
  ])('shows the %s page when the share cannot be served', async (status, heading) => {
    vi.mocked(getPublicShare).mockRejectedValue(apiError(status))

    renderAt()

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('shows the rate limit with its delay and lets the visitor retry', async () => {
    const user = userEvent.setup()
    vi.mocked(getPublicShare).mockRejectedValueOnce(apiError(429, { 'retry-after': '42' }))

    renderAt()

    expect(await screen.findByText('Trop de requêtes, réessayez dans 42 s.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: 'Fichiers partagés' })).toBeInTheDocument()
  })

  it('switches to the expired page when the last download was taken', async () => {
    const user = userEvent.setup()
    vi.mocked(requestShareDownload).mockRejectedValue(apiError(410))
    renderAt()

    await user.click(await screen.findByRole('button', { name: 'Télécharger rapport.pdf' }))

    expect(await screen.findByRole('heading', { name: 'Lien expiré' })).toBeInTheDocument()
    expect(startDownload).not.toHaveBeenCalled()
  })

  it('reloads the share when a file is no longer available', async () => {
    const user = userEvent.setup()
    vi.mocked(requestShareDownload).mockRejectedValue(apiError(404))
    renderAt()

    await user.click(await screen.findByRole('button', { name: 'Télécharger rapport.pdf' }))

    await waitFor(() => expect(getPublicShare).toHaveBeenCalledTimes(2))
  })

  it.each([
    [apiError(400), 'La vérification a échoué, réessayez.'],
    [apiError(429, { 'retry-after': '30' }), 'Trop de requêtes, réessayez dans 30 s.'],
  ])('explains a refused download', async (error, message) => {
    const user = userEvent.setup()
    vi.mocked(requestShareDownload).mockRejectedValue(error)
    renderAt()

    await user.click(await screen.findByRole('button', { name: 'Télécharger rapport.pdf' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(startDownload).not.toHaveBeenCalled()
  })

  it('follows the site language', async () => {
    await i18n.changeLanguage('en')

    renderAt()

    expect(await screen.findByRole('heading', { name: 'Shared files' })).toBeInTheDocument()
    expect(screen.getByText('2 files · 3 MiB')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download rapport.pdf' })).toBeInTheDocument()
  })
})
