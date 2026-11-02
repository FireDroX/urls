import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getLink, getLinkStats, type Link, type LinkStats } from '#api/links'
import { RedirectDetail } from './RedirectDetail'

vi.mock('#api/links', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/links')>()),
  getLink: vi.fn(),
  getLinkStats: vi.fn(),
}))

const link: Link = {
  id: 'docs',
  type: 'redirect',
  destination: 'https://example.com/docs',
  expiresAt: null,
  disabled: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

function buildStats(overrides: Partial<LinkStats> = {}): LinkStats {
  return {
    id: 'docs',
    days: 30,
    since: '2026-10-04',
    timeZone: 'UTC',
    total: 0,
    daily: [],
    referers: [],
    countries: [],
    ...overrides,
  }
}

function apiError(status: number): AxiosError {
  const response = {
    status,
    data: { error: 'failed' },
    headers: new AxiosHeaders(),
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('failed', undefined, undefined, undefined, response)
}

function renderPage(path = '/redirects/docs') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/redirects/:id" element={<RedirectDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getLink).mockResolvedValue(link)
  vi.mocked(getLinkStats).mockResolvedValue(buildStats())
})

describe('RedirectDetail page', () => {
  it('shows the link and a clean empty state when there is no click', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: '/r/docs' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://example.com/docs' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(await screen.findByRole('heading', { name: 'Aucun clic sur cette période' })).toBeInTheDocument()
    expect(screen.getByText('Jours comptés en UTC.')).toBeInTheDocument()
    expect(screen.queryByText('Principales sources')).not.toBeInTheDocument()
    expect(getLinkStats).toHaveBeenCalledWith('docs', 30, expect.any(AbortSignal))
  })

  it('shows the total, the top sources and the top countries', async () => {
    vi.mocked(getLinkStats).mockResolvedValue(
      buildStats({
        total: 5,
        daily: [{ date: '2026-11-02', clicks: 5 }],
        referers: [
          { referer: 'https://news.example/post', clicks: 3 },
          { referer: null, clicks: 2 },
        ],
        countries: [
          { country: 'FR', clicks: 4 },
          { country: null, clicks: 1 },
        ],
      }),
    )
    renderPage()

    expect(await screen.findByText('clics sur les 30 derniers jours')).toBeInTheDocument()
    expect(screen.getByText('Principales sources')).toBeInTheDocument()
    expect(screen.getByText('news.example')).toHaveAttribute('title', 'https://news.example/post')
    expect(screen.getByText('Direct')).toBeInTheDocument()
    expect(screen.getByText('France')).toBeInTheDocument()
    expect(screen.getByText('Inconnu')).toBeInTheDocument()
    expect(screen.getByText('3 clics')).toBeInTheDocument()
  })

  it('reads the period from the URL', async () => {
    renderPage('/redirects/docs?days=7')

    await screen.findByRole('heading', { name: 'Aucun clic sur cette période' })
    expect(getLinkStats).toHaveBeenCalledWith('docs', 7, expect.any(AbortSignal))
  })

  it('falls back to the default period for an out-of-range value', async () => {
    renderPage('/redirects/docs?days=9999')

    await screen.findByRole('heading', { name: 'Aucun clic sur cette période' })
    expect(getLinkStats).toHaveBeenCalledWith('docs', 30, expect.any(AbortSignal))
  })

  it('reloads the stats when another period is chosen', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('combobox', { name: 'Période' }))
    await user.click(await screen.findByRole('option', { name: '90 derniers jours' }))

    expect(getLinkStats).toHaveBeenLastCalledWith('docs', 90, expect.any(AbortSignal))
  })

  it('shows a not found state for an unknown link', async () => {
    vi.mocked(getLink).mockRejectedValue(apiError(404))
    renderPage('/redirects/missing')

    expect(await screen.findByRole('heading', { name: 'Redirection introuvable' })).toBeInTheDocument()
    expect(getLinkStats).not.toHaveBeenCalled()
  })

  it('offers a retry when the stats cannot be loaded', async () => {
    const user = userEvent.setup()
    vi.mocked(getLinkStats).mockRejectedValueOnce(apiError(500))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('heading', { name: 'Aucun clic sur cette période' })).toBeInTheDocument()
    expect(getLinkStats).toHaveBeenCalledTimes(2)
  })
})
