import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listFolders } from '#api/folders'
import { createDrop, deleteDrop, listDrops, updateDrop, type Drop } from '#api/drops'
import { listTags } from '#api/tags'
import { dropFormDefaults } from '#schemas/drop.schema'
import { Drops } from './Drops'

function pageOf<T>(items: T[]) {
  return { items, total: items.length, page: 1, pageSize: 100 }
}

vi.mock('#api/drops', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/drops')>()),
  listDrops: vi.fn(),
  createDrop: vi.fn(),
  updateDrop: vi.fn(),
  deleteDrop: vi.fn(),
}))

vi.mock('#api/tags', () => ({ listTags: vi.fn() }))
vi.mock('#api/folders', () => ({ listFolders: vi.fn() }))

const GIB = 1024 ** 3

const drop: Drop = {
  id: 'docs',
  title: 'Documents',
  maxTotalBytes: 2 * GIB,
  maxFiles: 5,
  expiresAt: null,
  disabled: false,
  fileCount: 2,
  totalSize: 2048,
  state: 'open',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  tags: [],
  folder: null,
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

function renderDrops() {
  return render(
    <MemoryRouter>
      <Drops />
    </MemoryRouter>,
  )
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Actions pour docs' }))
}

async function openCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Nouveau dépôt' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listTags).mockResolvedValue([])
  vi.mocked(listFolders).mockResolvedValue([])
  vi.mocked(listDrops).mockResolvedValue(pageOf([drop]))
})

describe('Drops page', () => {
  it('lists the drops with title, URL, files, size, state and expiry', async () => {
    renderDrops()

    const row = (await screen.findByText(`${window.location.origin}/u/docs`)).closest('tr')!
    expect(within(row).getByText('Documents')).toBeInTheDocument()
    expect(within(row).getByText('2 / 5')).toBeInTheDocument()
    expect(within(row).getByText('2 Kio / 2 Gio')).toBeInTheDocument()
    expect(within(row).getByText('Ouvert')).toBeInTheDocument()
    expect(within(row).getByText('Jamais')).toBeInTheDocument()
  })

  it('links the title to the drop detail', async () => {
    renderDrops()

    expect(await screen.findByRole('link', { name: 'Documents' })).toHaveAttribute('href', '/drops/docs')
  })

  it('falls back to a translated title for an untitled drop', async () => {
    vi.mocked(listDrops).mockResolvedValue(pageOf([{ ...drop, title: null, state: 'full' }]))
    renderDrops()

    expect(await screen.findByText('Sans titre')).toBeInTheDocument()
    expect(screen.getByText('Plein')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    vi.mocked(listDrops).mockResolvedValue(pageOf([]))
    renderDrops()

    expect(await screen.findByText("Aucun dépôt pour l'instant")).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup()
    vi.mocked(listDrops).mockRejectedValueOnce(new Error('down'))
    renderDrops()

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Documents')).toBeInTheDocument()
  })

  it('copies the full /u/ URL', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderDrops()

    await user.click(await screen.findByRole('button', { name: 'Copier le lien docs' }))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/u/docs`)
  })

  it('proposes a 7 day expiry and posts the creation', async () => {
    const user = userEvent.setup()
    const created = { ...drop, id: 'recus', title: 'Reçus' }
    vi.mocked(createDrop).mockResolvedValue(created)
    vi.mocked(listDrops).mockResolvedValueOnce(pageOf([drop])).mockResolvedValue(pageOf([created, drop]))
    renderDrops()

    await openCreateForm(user)
    const expectedExpiry = dropFormDefaults().expiresAt
    expect(screen.getByLabelText('Expiration (facultatif)')).toHaveValue(expectedExpiry)
    await user.type(screen.getByLabelText('Titre (facultatif)'), 'Reçus')
    await user.type(screen.getByLabelText('Slug (facultatif)'), 'recus')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createDrop).toHaveBeenCalled())
    expect(vi.mocked(createDrop).mock.calls[0][0]).toMatchObject({
      title: 'Reçus',
      slug: 'recus',
      maxFiles: 10,
      maxTotalBytes: GIB,
      expiresAt: new Date(expectedExpiry).toISOString(),
    })
    expect(await screen.findByText(`${window.location.origin}/u/recus`)).toBeInTheDocument()
  })

  it('creates a drop without expiry once cleared', async () => {
    const user = userEvent.setup()
    vi.mocked(createDrop).mockResolvedValue(drop)
    renderDrops()

    await openCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Aucune' }))
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createDrop).toHaveBeenCalledWith({ maxFiles: 10, maxTotalBytes: GIB }))
  })

  it.each([
    ['Nombre de fichiers maximum', '0', 'Nombre entier de 1 à 50'],
    ['Nombre de fichiers maximum', '51', 'Nombre entier de 1 à 50'],
    ['Taille totale maximum', '0', 'Nombre entier supérieur à 0'],
    ['Taille totale maximum', '76', '75 Gio au maximum'],
  ])('refuses %s = %s before calling the API', async (label, value, message) => {
    const user = userEvent.setup()
    renderDrops()

    await openCreateForm(user)
    const input = screen.getByLabelText(label)
    await user.clear(input)
    await user.type(input, value)
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(createDrop).not.toHaveBeenCalled()
  })

  it('refuses a title that is too long', async () => {
    const user = userEvent.setup()
    renderDrops()

    await openCreateForm(user)
    await user.click(screen.getByLabelText('Titre (facultatif)'))
    await user.paste('a'.repeat(121))
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('120 caractères maximum')).toBeInTheDocument()
    expect(createDrop).not.toHaveBeenCalled()
  })

  it('translates a taken slug', async () => {
    const user = userEvent.setup()
    vi.mocked(createDrop).mockRejectedValue(apiError(409))
    renderDrops()

    await openCreateForm(user)
    await user.type(screen.getByLabelText('Slug (facultatif)'), 'docs')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Ce slug est déjà pris.')).toBeInTheDocument()
  })

  it('translates a throttled creation', async () => {
    const user = userEvent.setup()
    vi.mocked(createDrop).mockRejectedValue(apiError(429, { 'retry-after': '30' }))
    renderDrops()

    await openCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Trop de requêtes, réessayez dans 30 s.')).toBeInTheDocument()
  })

  it('sends only the changed fields when editing', async () => {
    const user = userEvent.setup()
    vi.mocked(updateDrop).mockResolvedValue({ ...drop, maxFiles: 8 })
    vi.mocked(listDrops).mockResolvedValueOnce(pageOf([drop])).mockResolvedValue(pageOf([{ ...drop, maxFiles: 8 }]))
    renderDrops()

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifier' }))
    const maxFiles = screen.getByLabelText('Nombre de fichiers maximum')
    await user.clear(maxFiles)
    await user.type(maxFiles, '8')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateDrop).toHaveBeenCalledWith('docs', { maxFiles: 8 }))
    expect(await screen.findByText('2 / 8')).toBeInTheDocument()
  })

  it('calls no API when nothing changed', async () => {
    const user = userEvent.setup()
    renderDrops()

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifier' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateDrop).not.toHaveBeenCalled()
  })

  it('translates a drop that no longer exists when editing', async () => {
    const user = userEvent.setup()
    vi.mocked(updateDrop).mockRejectedValue(apiError(404))
    renderDrops()

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifier' }))
    await user.type(screen.getByLabelText('Titre (facultatif)'), ' 2')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText("Ce dépôt n'existe plus.")).toBeInTheDocument()
  })

  it('disables a drop', async () => {
    const user = userEvent.setup()
    vi.mocked(updateDrop).mockResolvedValue({ ...drop, disabled: true, state: 'disabled' })
    renderDrops()

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Désactiver' }))

    expect(updateDrop).toHaveBeenCalledWith('docs', { disabled: true })
    expect(await screen.findByText('Désactivé')).toBeInTheDocument()
  })

  it('deletes a drop only after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteDrop).mockResolvedValue()
    vi.mocked(listDrops).mockResolvedValueOnce(pageOf([drop])).mockResolvedValue(pageOf([]))
    renderDrops()

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    expect(deleteDrop).not.toHaveBeenCalled()
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteDrop).toHaveBeenCalledWith('docs'))
    await waitFor(() => expect(screen.queryByText('Documents')).not.toBeInTheDocument())
  })

  it('keeps the dialog open with a translated error when the deletion fails', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteDrop).mockRejectedValue(apiError(404))
    renderDrops()

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText("Ce dépôt n'existe plus.")).toBeInTheDocument()
  })
})

describe('Drops page (tags and folder)', () => {
  it('shows the tags and the folder of a row', async () => {
    vi.mocked(listDrops).mockResolvedValue(pageOf([{ ...drop, tags: [{ id: 'tagA', name: 'Docs', color: '#112233' }], folder: { id: 'f1', name: 'Projects' } }]))
    render(<Drops />, { wrapper: MemoryRouter })

    const row = (await screen.findByText('Documents')).closest('tr')!
    expect(within(row).getByText('Docs')).toBeInTheDocument()
    expect(within(row).getByText('Projects')).toBeInTheDocument()
  })
})

describe('Drops page (filters)', () => {
  it('reads the drop states from the URL and shows the filtered empty state', async () => {
    vi.mocked(listDrops).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 })
    render(
      <MemoryRouter initialEntries={['/drops?state=full&q=x']}>
        <Drops />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Aucun résultat')).toBeInTheDocument()
    expect(listDrops).toHaveBeenCalledWith({ q: 'x', state: 'full', page: 1, pageSize: 50 })
  })
})
