import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listFolders } from '#api/folders'
import { createLink, deleteLink, listLinks, updateLink, type Link } from '#api/links'
import { listTags } from '#api/tags'
import { Redirects } from './Redirects'

function pageOf<T>(items: T[]) {
  return { items, total: items.length, page: 1, pageSize: 100 }
}

vi.mock('#api/links', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/links')>()),
  listLinks: vi.fn(),
  createLink: vi.fn(),
  updateLink: vi.fn(),
  deleteLink: vi.fn(),
}))

vi.mock('#api/tags', () => ({ listTags: vi.fn() }))
vi.mock('#api/folders', () => ({ listFolders: vi.fn() }))

const link: Link = {
  id: 'docs',
  type: 'redirect',
  destination: 'https://example.com/docs',
  expiresAt: null,
  disabled: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  tags: [],
  folder: null,
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

function renderRedirects() {
  return render(
    <MemoryRouter initialEntries={['/redirects']}>
      <Routes>
        <Route path="/redirects" element={<Redirects />} />
        <Route path="/redirects/:id" element={<p>fiche de la redirection</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Actions pour docs' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listLinks).mockResolvedValue(pageOf([link]))
  vi.mocked(listTags).mockResolvedValue([
    { id: 'tagA', name: 'Docs', color: '#112233', linkCount: 0, createdAt: '', updatedAt: '' },
    { id: 'tagB', name: 'Work', color: '#fde047', linkCount: 0, createdAt: '', updatedAt: '' },
  ])
  vi.mocked(listFolders).mockResolvedValue([{ id: 'f1', name: 'Projects', linkCount: 0, createdAt: '', updatedAt: '' }])
})

describe('Redirects page', () => {
  it('lists the redirects with their state and expiry', async () => {
    render(<Redirects />, { wrapper: MemoryRouter })

    const row = (await screen.findByText('/r/docs')).closest('tr')!
    expect(within(row).getByText('https://example.com/docs')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()
    expect(within(row).getByText('Jamais')).toBeInTheDocument()
  })

  it('copies the full public URL', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<Redirects />, { wrapper: MemoryRouter })

    await user.click(await screen.findByRole('button', { name: 'Copier le lien docs' }))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/r/docs`)
  })

  it('creates a redirect and adds it to the list', async () => {
    const user = userEvent.setup()
    const created = { ...link, id: 'new-one', destination: 'https://example.org/' }
    vi.mocked(createLink).mockResolvedValue(created)
    vi.mocked(listLinks).mockResolvedValueOnce(pageOf([link])).mockResolvedValueOnce(pageOf([created, link]))
    render(<Redirects />, { wrapper: MemoryRouter })

    await user.click(await screen.findByRole('button', { name: 'Nouvelle redirection' }))
    await user.type(screen.getByLabelText('Destination'), 'https://example.org/')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(createLink).toHaveBeenCalledWith({ destination: 'https://example.org/' })
    expect(await screen.findByText('/r/new-one')).toBeInTheDocument()
  })

  it('validates the form before calling the API', async () => {
    const user = userEvent.setup()
    render(<Redirects />, { wrapper: MemoryRouter })

    await user.click(await screen.findByRole('button', { name: 'Nouvelle redirection' }))
    await user.type(screen.getByLabelText('Destination'), 'ftp://example.org')
    await user.type(screen.getByLabelText('Slug (facultatif)'), 'api')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Adresse http:// ou https:// attendue')).toBeInTheDocument()
    expect(screen.getByText('Ce slug est réservé')).toBeInTheDocument()
    expect(createLink).not.toHaveBeenCalled()
  })

  it('translates a taken slug', async () => {
    const user = userEvent.setup()
    vi.mocked(createLink).mockRejectedValue(apiError(409))
    render(<Redirects />, { wrapper: MemoryRouter })

    await user.click(await screen.findByRole('button', { name: 'Nouvelle redirection' }))
    await user.type(screen.getByLabelText('Destination'), 'https://example.org/')
    await user.type(screen.getByLabelText('Slug (facultatif)'), 'docs')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce slug est déjà pris.')
  })

  it('opens the detail page from the edit action', async () => {
    const user = userEvent.setup()
    renderRedirects()

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifier' }))

    expect(await screen.findByText('fiche de la redirection')).toBeInTheDocument()
    expect(updateLink).not.toHaveBeenCalled()
  })

  it('disables a redirect from the row menu', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockResolvedValue({ ...link, disabled: true })
    vi.mocked(listLinks).mockResolvedValueOnce(pageOf([link])).mockResolvedValue(pageOf([{ ...link, disabled: true }]))
    render(<Redirects />, { wrapper: MemoryRouter })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Désactiver' }))

    expect(updateLink).toHaveBeenCalledWith('docs', { disabled: true })
    expect(await screen.findByText('Désactivé')).toBeInTheDocument()
  })

  it('deletes a redirect after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteLink).mockResolvedValue()
    vi.mocked(listLinks).mockResolvedValueOnce(pageOf([link])).mockResolvedValue(pageOf([]))
    render(<Redirects />, { wrapper: MemoryRouter })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(deleteLink).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    expect(deleteLink).toHaveBeenCalledWith('docs')
    await waitFor(() => expect(screen.queryByText('/r/docs')).not.toBeInTheDocument())
  })

  it('offers a retry when the list cannot be loaded', async () => {
    const user = userEvent.setup()
    vi.mocked(listLinks).mockRejectedValueOnce(apiError(500))
    render(<Redirects />, { wrapper: MemoryRouter })

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('/r/docs')).toBeInTheDocument()
    expect(listLinks).toHaveBeenCalledTimes(2)
  })

  it('links each row to its statistics page', async () => {
    render(<Redirects />, { wrapper: MemoryRouter })

    expect(await screen.findByRole('link', { name: '/r/docs' })).toHaveAttribute('href', '/redirects/docs')
  })

  it('opens the statistics page from the row menu', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/redirects']}>
        <Routes>
          <Route path="/redirects" element={<Redirects />} />
          <Route path="/redirects/:id" element={<p>stats-page</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Statistiques' }))

    expect(await screen.findByText('stats-page')).toBeInTheDocument()
  })
})

describe('Redirects page (tags and folder)', () => {
  it('shows the tags and the folder of a row', async () => {
    vi.mocked(listLinks).mockResolvedValue(pageOf([
      { ...link, tags: [{ id: 'tagA', name: 'Docs', color: '#112233' }], folder: { id: 'f1', name: 'Projects' } },
    ]))
    render(<Redirects />, { wrapper: MemoryRouter })

    const row = (await screen.findByText('/r/docs')).closest('tr')!
    expect(within(row).getByText('Docs')).toBeInTheDocument()
    expect(within(row).getByText('Projects')).toBeInTheDocument()
  })

  it('creates a redirect with the chosen tag and folder', async () => {
    const user = userEvent.setup()
    vi.mocked(createLink).mockResolvedValue({ ...link, id: 'new-one' })
    render(<Redirects />, { wrapper: MemoryRouter })

    await user.click(await screen.findByRole('button', { name: 'Nouvelle redirection' }))
    await user.type(screen.getByLabelText('Destination'), 'https://example.org/')
    await waitFor(() => expect(screen.getByLabelText('Tags')).toBeEnabled())
    await user.click(screen.getByLabelText('Tags'))
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Docs' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByLabelText('Dossier'))
    await user.click(await screen.findByRole('option', { name: 'Projects' }))
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(createLink).toHaveBeenCalledWith({ destination: 'https://example.org/', tagIds: ['tagA'], folderId: 'f1' })
  })

  it('translates a tag that disappeared and reloads the choices', async () => {
    const user = userEvent.setup()
    const missing = apiError(404)
    missing.response!.data = { error: 'Tag not found' }
    vi.mocked(createLink).mockRejectedValue(missing)
    render(<Redirects />, { wrapper: MemoryRouter })

    await user.click(await screen.findByRole('button', { name: 'Nouvelle redirection' }))
    await user.type(screen.getByLabelText('Destination'), 'https://example.org/')
    await waitFor(() => expect(listTags).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("n'existe plus")
    await waitFor(() => expect(listTags).toHaveBeenCalledTimes(3))
  })
})

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Redirects />
    </MemoryRouter>,
  )
}

describe('Redirects page (filters and pagination)', () => {
  it('asks the API for the filters found in the URL', async () => {
    renderAt('/redirects?q=docs&tag=tagA&folder=none&state=expired&sort=slug_asc&page=2&bogus=1')

    await waitFor(() => expect(listLinks).toHaveBeenCalled())

    expect(listLinks).toHaveBeenCalledWith({
      q: 'docs',
      tag: 'tagA',
      folder: 'none',
      state: 'expired',
      sort: 'slug_asc',
      page: 2,
      pageSize: 50,
    })
  })

  it('shows the filtered empty state and clears the filters', async () => {
    const user = userEvent.setup()
    vi.mocked(listLinks).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 50 })
    renderAt('/redirects?q=x')

    expect(await screen.findByText('Aucun résultat')).toBeInTheDocument()
    expect(screen.queryByText(/Aucune redirection pour/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }))

    expect(await screen.findByText('/r/docs')).toBeInTheDocument()
    expect(vi.mocked(listLinks).mock.calls.at(-1)?.[0]).toEqual({ page: 1, pageSize: 50 })
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('shows the plain empty state when there is no filter', async () => {
    vi.mocked(listLinks).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 })
    renderAt('/redirects')

    expect(await screen.findByText(/Aucune redirection pour/)).toBeInTheDocument()
    expect(screen.queryByText('Aucun résultat')).not.toBeInTheDocument()
  })

  it('filters by a tag clicked in the table', async () => {
    const user = userEvent.setup()
    vi.mocked(listLinks).mockResolvedValue(
      pageOf([{ ...link, tags: [{ id: 'tagA', name: 'Docs', color: '#112233' }], folder: { id: 'f1', name: 'Projects' } }]),
    )
    renderAt('/redirects')

    await user.click(await screen.findByRole('button', { name: 'Filtrer par le tag Docs' }))
    await waitFor(() => expect(vi.mocked(listLinks).mock.calls.at(-1)?.[0]).toMatchObject({ tag: 'tagA', page: 1 }))

    await user.click(await screen.findByRole('button', { name: 'Filtrer par le dossier Projects' }))
    await waitFor(() => expect(vi.mocked(listLinks).mock.calls.at(-1)?.[0]).toMatchObject({ tag: 'tagA', folder: 'f1' }))
  })

  it('shows the total and requests the next page', async () => {
    const user = userEvent.setup()
    vi.mocked(listLinks).mockResolvedValue({ items: [link], total: 120, page: 1, pageSize: 50 })
    renderAt('/redirects')

    expect(await screen.findByText('120 résultats')).toBeInTheDocument()
    expect(screen.getByText('Page 1 sur 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Page suivante' }))

    await waitFor(() => expect(vi.mocked(listLinks).mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }))
  })
})
