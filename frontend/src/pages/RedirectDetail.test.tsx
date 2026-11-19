import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listFolders } from '#api/folders'
import { checkLink, deleteLink, getLink, getLinkStats, updateLink, type Link, type LinkStats } from '#api/links'
import { listTags } from '#api/tags'
import { RedirectDetail } from './RedirectDetail'

vi.mock('#api/links', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/links')>()),
  getLink: vi.fn(),
  getLinkStats: vi.fn(),
  updateLink: vi.fn(),
  deleteLink: vi.fn(),
  checkLink: vi.fn(),
}))

vi.mock('#api/tags', () => ({ listTags: vi.fn() }))
vi.mock('#api/folders', () => ({ listFolders: vi.fn() }))
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: vi.fn(), error: vi.fn() },
}))

const link: Link = {
  id: 'docs',
  type: 'redirect',
  destination: 'https://example.com/docs',
  expiresAt: null,
  disabled: false,
  lastCheck: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  tags: [],
  folder: null,
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
        <Route path="/redirects" element={<p>liste des redirections</p>} />
        <Route path="/redirects/:id" element={<RedirectDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getLink).mockResolvedValue(link)
  vi.mocked(getLinkStats).mockResolvedValue(buildStats())
  vi.mocked(listTags).mockResolvedValue([])
  vi.mocked(listFolders).mockResolvedValue([])
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
          { host: 'news.example', clicks: 3 },
          { host: null, clicks: 2 },
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
    expect(screen.getByText('news.example')).toBeInTheDocument()
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

  it('shows the tags and the folder under the title', async () => {
    vi.mocked(getLink).mockResolvedValue({
      ...link,
      tags: [{ id: 'tagA', name: 'Docs', color: '#112233' }],
      folder: { id: 'f1', name: 'Projects' },
    })
    renderPage()

    expect(await screen.findAllByText('Docs')).toHaveLength(2)
    expect(screen.getAllByText('Projects')).toHaveLength(2)
  })

  it('edits the destination and sends only that field', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockResolvedValue({ ...link, destination: 'https://example.org/new' })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    const destination = screen.getByLabelText('Destination')
    await user.clear(destination)
    await user.type(destination, 'https://example.org/new')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateLink).toHaveBeenCalledWith('docs', { destination: 'https://example.org/new' }))
    expect(await screen.findByRole('link', { name: 'https://example.org/new' })).toBeInTheDocument()
  })

  it('shows a redirect never checked', async () => {
    renderPage()

    const section = (await screen.findByRole('heading', { name: 'Dernière vérification' })).closest('section')!
    expect(within(section).getByText('Jamais vérifiée')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Vérifier maintenant' })).toBeEnabled()
  })

  it('shows the last check with its code and a relative date', async () => {
    vi.mocked(getLink).mockResolvedValue({
      ...link,
      lastCheck: {
        outcome: 'broken',
        statusCode: 404,
        errorKind: null,
        checkedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        broken: true,
      },
    })
    renderPage()

    const section = (await screen.findByRole('heading', { name: 'Dernière vérification' })).closest('section')!
    expect(within(section).getByText('Cassée')).toBeInTheDocument()
    expect(within(section).getByText('HTTP 404')).toBeInTheDocument()
    expect(within(section).getByText('il y a 3 heures')).toBeInTheDocument()
  })

  it('checks now, then shows the new result', async () => {
    const user = userEvent.setup()
    vi.mocked(checkLink).mockResolvedValue({
      id: 'docs',
      outcome: 'ok',
      statusCode: 200,
      errorKind: null,
      consecutiveFailures: 0,
      checkedAt: new Date().toISOString(),
    })
    vi.mocked(getLink)
      .mockResolvedValueOnce(link)
      .mockResolvedValueOnce({
        ...link,
        lastCheck: { outcome: 'ok', statusCode: 200, errorKind: null, checkedAt: new Date().toISOString(), broken: false },
      })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Vérifier maintenant' }))

    expect(checkLink).toHaveBeenCalledWith('docs')
    expect(await screen.findByText('HTTP 200')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Vérification terminée.')
  })

  it('shows the delay of a rate limited check', async () => {
    const user = userEvent.setup()
    const error = apiError(429)
    error.response!.headers = new AxiosHeaders({ 'retry-after': '42' })
    vi.mocked(checkLink).mockRejectedValue(error)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Vérifier maintenant' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('42')))
  })

  it('shows the settings of the redirect', async () => {
    renderPage()

    const settings = (await screen.findByRole('heading', { name: 'Réglages' })).closest('section')!
    expect(within(settings).getByText('docs')).toBeInTheDocument()
    expect(within(settings).getByText('Jamais')).toBeInTheDocument()
    expect(within(settings).getByText('Aucun tag')).toBeInTheDocument()
    expect(within(settings).getByText('Aucun')).toBeInTheDocument()
  })

  it('shows the tags and the folder in the settings', async () => {
    vi.mocked(getLink).mockResolvedValue({
      ...link,
      tags: [{ id: 't1', name: 'Docs', color: '#ff0000' }],
      folder: { id: 'f1', name: 'Work' },
    })
    renderPage()

    const settings = (await screen.findByRole('heading', { name: 'Réglages' })).closest('section')!
    expect(within(settings).getByText('Docs')).toBeInTheDocument()
    expect(within(settings).getByText('Work')).toBeInTheDocument()
    expect(within(settings).queryByText('Aucun tag')).not.toBeInTheDocument()
  })

  it('follows a new slug and keeps the period', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockResolvedValue({ ...link, id: 'guides' })
    renderPage('/redirects/docs?days=7')

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    const slug = screen.getByLabelText('Slug')
    await user.clear(slug)
    await user.type(slug, 'guides')
    vi.mocked(getLink).mockResolvedValue({ ...link, id: 'guides' })
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('heading', { name: '/r/guides' })).toBeInTheDocument()
    expect(getLinkStats).toHaveBeenLastCalledWith('guides', 7, expect.any(AbortSignal))
    expect(vi.mocked(getLink).mock.calls.filter(([id]) => id === 'guides')).toHaveLength(1)
    expect(vi.mocked(getLinkStats).mock.calls.filter(([id]) => id === 'guides')).toHaveLength(1)
  })

  it('translates a taken slug when editing', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockRejectedValue(apiError(409))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    const slug = screen.getByLabelText('Slug')
    await user.clear(slug)
    await user.type(slug, 'guides')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce slug est déjà pris.')
  })

  it('disables the redirect', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockResolvedValue({ ...link, disabled: true })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Désactiver' }))

    expect(updateLink).toHaveBeenCalledWith('docs', { disabled: true })
    expect(await screen.findByRole('button', { name: 'Réactiver' })).toBeInTheDocument()
  })

  it('translates a redirect that no longer exists when toggling it', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockRejectedValue(apiError(404))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Désactiver' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('deletes the redirect after confirmation and goes back to the list', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteLink).mockResolvedValue()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(deleteLink).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('liste des redirections')).toBeInTheDocument()
    expect(deleteLink).toHaveBeenCalledWith('docs')
  })
})
