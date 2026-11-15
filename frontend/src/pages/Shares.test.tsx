import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listFolders } from '#api/folders'
import { createShare, deleteShare, listShares, updateShare, type Share, type ShareDetail } from '#api/shares'
import { listTags } from '#api/tags'
import { UploadsProvider } from '#components/UploadsProvider'
import { Shares } from './Shares'

function pageOf<T>(items: T[]) {
  return { items, total: items.length, page: 1, pageSize: 100 }
}

vi.mock('#api/shares', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/shares')>()),
  listShares: vi.fn(),
  createShare: vi.fn(),
  updateShare: vi.fn(),
  deleteShare: vi.fn(),
}))

vi.mock('#api/tags', () => ({ listTags: vi.fn() }))
vi.mock('#api/folders', () => ({ listFolders: vi.fn() }))

const share: Share = {
  id: 'photos',
  expiresAt: null,
  maxDownloads: 10,
  downloadCount: 3,
  disabled: false,
  fileCount: 2,
  totalSize: 2048,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  tags: [],
  folder: null,
}

const detail: ShareDetail = { ...share, viewCount: 0, files: [] }

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

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/shares']}>
      <UploadsProvider>
        <Routes>
          <Route path="/shares" element={children} />
          <Route path="/shares/:id" element={<p>fiche du partage</p>} />
        </Routes>
      </UploadsProvider>
    </MemoryRouter>
  )
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Actions pour photos' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listShares).mockResolvedValue(pageOf([share]))
  vi.mocked(listTags).mockResolvedValue([])
  vi.mocked(listFolders).mockResolvedValue([])
})

describe('Shares page', () => {
  it('lists the shares with their files, downloads and state', async () => {
    render(<Shares />, { wrapper: Wrapper })

    const row = (await screen.findByText('/d/photos')).closest('tr')!
    expect(within(row).getByText('2 fichiers · 2 Kio')).toBeInTheDocument()
    expect(within(row).getByText('3 / 10')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()
    expect(within(row).getByText('Jamais')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    vi.mocked(listShares).mockResolvedValue(pageOf([]))
    render(<Shares />, { wrapper: Wrapper })

    expect(await screen.findByText("Aucun partage pour l'instant")).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup()
    vi.mocked(listShares).mockRejectedValueOnce(new Error('down'))
    render(<Shares />, { wrapper: Wrapper })

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('/d/photos')).toBeInTheDocument()
  })

  it('copies the full /d/ URL', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<Shares />, { wrapper: Wrapper })

    await user.click(await screen.findByRole('button', { name: 'Copier le lien photos' }))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/d/photos`)
  })

  it('creates a share and opens its page to drop files', async () => {
    const user = userEvent.setup()
    vi.mocked(createShare).mockResolvedValue({ ...detail, id: 'vacances' })
    render(<Shares />, { wrapper: Wrapper })

    await user.click(await screen.findByRole('button', { name: 'Nouveau partage' }))
    await user.type(screen.getByLabelText('Slug (facultatif)'), 'vacances')
    await user.type(screen.getByLabelText('Téléchargements maximum (facultatif)'), '5')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('fiche du partage')).toBeInTheDocument()
    expect(createShare).toHaveBeenCalledWith({ slug: 'vacances', maxDownloads: 5 })
  })

  it('refuses an invalid limit before calling the API', async () => {
    const user = userEvent.setup()
    render(<Shares />, { wrapper: Wrapper })

    await user.click(await screen.findByRole('button', { name: 'Nouveau partage' }))
    await user.type(screen.getByLabelText('Téléchargements maximum (facultatif)'), '0')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Nombre entier de 1 à 1000000')).toBeInTheDocument()
    expect(createShare).not.toHaveBeenCalled()
  })

  it('translates a taken slug', async () => {
    const user = userEvent.setup()
    vi.mocked(createShare).mockRejectedValue(apiError(409))
    render(<Shares />, { wrapper: Wrapper })

    await user.click(await screen.findByRole('button', { name: 'Nouveau partage' }))
    await user.type(screen.getByLabelText('Slug (facultatif)'), 'photos')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Ce slug est déjà pris.')).toBeInTheDocument()
  })

  it('sends only the changed fields when editing', async () => {
    const user = userEvent.setup()
    vi.mocked(updateShare).mockResolvedValue({ ...detail, maxDownloads: 20 })
    render(<Shares />, { wrapper: Wrapper })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifier' }))
    const limit = screen.getByLabelText('Téléchargements maximum (facultatif)')
    await user.clear(limit)
    await user.type(limit, '20')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(updateShare).toHaveBeenCalledWith('photos', { maxDownloads: 20 }))
    expect(await screen.findByText('3 / 20')).toBeInTheDocument()
  })

  it('calls no API when nothing changed', async () => {
    const user = userEvent.setup()
    render(<Shares />, { wrapper: Wrapper })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifier' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateShare).not.toHaveBeenCalled()
  })

  it('disables a share', async () => {
    const user = userEvent.setup()
    vi.mocked(updateShare).mockResolvedValue({ ...detail, disabled: true })
    render(<Shares />, { wrapper: Wrapper })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Désactiver' }))

    expect(updateShare).toHaveBeenCalledWith('photos', { disabled: true })
    expect(await screen.findByText('Désactivé')).toBeInTheDocument()
  })

  it('deletes a share only after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteShare).mockResolvedValue()
    render(<Shares />, { wrapper: Wrapper })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    expect(deleteShare).not.toHaveBeenCalled()
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteShare).toHaveBeenCalledWith('photos'))
    await waitFor(() => expect(screen.queryByText('/d/photos')).not.toBeInTheDocument())
  })

  it('keeps the dialog open with a translated error when the deletion fails', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteShare).mockRejectedValue(apiError(404))
    render(<Shares />, { wrapper: Wrapper })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText("Ce partage n'existe plus.")).toBeInTheDocument()
  })
})

describe('Shares page (tags and folder)', () => {
  it('shows the tags and the folder of a row', async () => {
    vi.mocked(listShares).mockResolvedValue(pageOf([{ ...share, tags: [{ id: 'tagA', name: 'Docs', color: '#112233' }], folder: { id: 'f1', name: 'Projects' } }]))
    render(<Shares />, { wrapper: Wrapper })

    const row = (await screen.findByText('/d/photos')).closest('tr')!
    expect(within(row).getByText('Docs')).toBeInTheDocument()
    expect(within(row).getByText('Projects')).toBeInTheDocument()
  })
})
