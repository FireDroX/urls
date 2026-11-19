import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listFolders } from '#api/folders'
import { listAllLinks, type AnyLink } from '#api/links'
import { listTags } from '#api/tags'
import { Dashboard } from './Dashboard'

vi.mock('#api/links', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/links')>()),
  listAllLinks: vi.fn(),
}))
vi.mock('#api/tags', () => ({ listTags: vi.fn() }))
vi.mock('#api/folders', () => ({ listFolders: vi.fn() }))

const base: AnyLink = {
  type: 'redirect',
  id: 'x',
  destination: 'https://example.com/docs',
  title: null,
  state: 'active',
  expiresAt: null,
  disabled: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  tags: [],
  folder: null,
}

const links: AnyLink[] = [
  base,
  { ...base, type: 'share', id: 'y', destination: null, state: 'expired' },
  { ...base, type: 'drop', id: 'z', destination: null, title: 'Photos', state: 'full' },
]

function renderAt(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/redirects/:id" element={<p>fiche redirection</p>} />
        <Route path="/shares/:id" element={<p>fiche partage</p>} />
        <Route path="/drops/:id" element={<p>fiche dépôt</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listAllLinks).mockResolvedValue({ items: links, total: 3, page: 1, pageSize: 50 })
  vi.mocked(listTags).mockResolvedValue([])
  vi.mocked(listFolders).mockResolvedValue([])
})

describe('Dashboard page', () => {
  it('renders every type with its badge, target and state', async () => {
    renderAt()

    const redirectRow = (await screen.findByRole('link', { name: 'x' })).closest('tr')!
    expect(within(redirectRow).getByText('Redirection')).toBeInTheDocument()
    expect(within(redirectRow).getByText('https://example.com/docs')).toBeInTheDocument()
    expect(within(redirectRow).getByText('Actif')).toBeInTheDocument()
    const shareRow = screen.getByRole('link', { name: 'y' }).closest('tr')!
    expect(within(shareRow).getByText('Partage')).toBeInTheDocument()
    expect(within(shareRow).getByText('Expiré')).toBeInTheDocument()
    const dropRow = screen.getByRole('link', { name: 'z' }).closest('tr')!
    expect(within(dropRow).getByText('Dépôt')).toBeInTheDocument()
    expect(within(dropRow).getByText('Photos')).toBeInTheDocument()
    expect(within(dropRow).getByText('Plein')).toBeInTheDocument()
  })

  it('links each row to the detail page of its type', async () => {
    renderAt()

    expect(await screen.findByRole('link', { name: 'x' })).toHaveAttribute('href', '/redirects/x')
    expect(screen.getByRole('link', { name: 'y' })).toHaveAttribute('href', '/shares/y')
    expect(screen.getByRole('link', { name: 'z' })).toHaveAttribute('href', '/drops/z')
  })

  it('asks the API for the type chosen in the filter', async () => {
    const user = userEvent.setup()
    renderAt()

    await user.click(await screen.findByRole('combobox', { name: 'Filtrer par type' }))
    await user.click(await screen.findByRole('option', { name: 'Partage' }))

    await waitFor(() => expect(vi.mocked(listAllLinks).mock.calls.at(-1)?.[0]).toMatchObject({ type: 'share', page: 1 }))
  })

  it('reads the type from the URL and ignores an unknown one', async () => {
    renderAt('/?type=drop')
    await waitFor(() => expect(listAllLinks).toHaveBeenCalledWith(expect.objectContaining({ type: 'drop' })))

    vi.mocked(listAllLinks).mockClear()
    renderAt('/?type=file')
    await waitFor(() => expect(listAllLinks).toHaveBeenCalled())
    expect(vi.mocked(listAllLinks).mock.calls[0]?.[0]).not.toHaveProperty('type')
  })

  it('keeps the initial empty state when no link exists', async () => {
    vi.mocked(listAllLinks).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 })
    renderAt()

    expect(await screen.findByText("Aucun lien pour l'instant")).toBeInTheDocument()
    expect(screen.queryByText('Aucun résultat')).not.toBeInTheDocument()
  })

  it('shows the filtered empty state when a filter matches nothing', async () => {
    vi.mocked(listAllLinks).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 })
    renderAt('/?type=share')

    expect(await screen.findByText('Aucun résultat')).toBeInTheDocument()
  })
})
