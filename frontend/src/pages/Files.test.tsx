import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileDownloadUrl, deleteFile, listFiles, type FilesList, type StoredFile } from '#api/files'
import { refreshStorageUsage } from '#lib/storage-usage-refresh'
import { startDownload } from '#utils/start-download'
import { Files } from './Files'

vi.mock('#api/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/files')>()),
  listFiles: vi.fn(),
  deleteFile: vi.fn(),
  createFileDownloadUrl: vi.fn(),
}))
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('#utils/start-download', () => ({ startDownload: vi.fn() }))
vi.mock('#lib/storage-usage-refresh', () => ({ refreshStorageUsage: vi.fn() }))

const file: StoredFile = {
  publicId: 'f1',
  name: 'photo.jpg',
  size: 2048,
  mime: 'image/jpeg',
  status: 'ready',
  createdAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:01:00.000Z',
  inUse: true,
  link: { type: 'share', publicId: 'photos', deleted: false, disabled: false, expired: false },
}

const orphan: StoredFile = {
  ...file,
  publicId: 'f2',
  name: 'old.zip',
  mime: null,
  inUse: false,
  link: { ...file.link, publicId: 'gone', deleted: true },
}

function list(files: StoredFile[], storageUsedBytes: number | null = 4096): FilesList {
  return {
    files,
    summary: { quotaUsedBytes: 1024, quotaLimitBytes: 4096, orphanBytes: 512, storageUsedBytes },
  }
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

function Search() {
  return <p data-testid="search">{useLocation().search}</p>
}

function renderAt(path: string) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/files"
            element={
              <>
                {children}
                <Search />
              </>
            }
          />
          <Route path="/shares/:id" element={<p>fiche du partage</p>} />
        </Routes>
      </MemoryRouter>
    )
  }
  return render(<Files />, { wrapper: Wrapper })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listFiles).mockResolvedValue(list([file, orphan]))
})

describe('Files page', () => {
  it('shows the status and the origin of each file', async () => {
    renderAt('/files')

    const row = (await screen.findByText('photo.jpg')).closest('tr')!
    expect(within(row).getByText('Prêt')).toBeInTheDocument()
    expect(within(row).getByText('image/jpeg')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Partage photos' })).toHaveAttribute('href', '/shares/photos')

    const orphanRow = screen.getByText('old.zip').closest('tr')!
    expect(within(orphanRow).getByText('Partage gone')).toBeInTheDocument()
    expect(within(orphanRow).getByText('partage supprimé')).toBeInTheDocument()
    expect(within(orphanRow).queryByRole('link')).not.toBeInTheDocument()
  })

  it.each([
    ['uploading', 'Envoi inachevé'],
    ['verifying', 'Vérification'],
    ['rejected', 'Rejeté'],
  ] as const)('shows the %s status', async (status, label) => {
    vi.mocked(listFiles).mockResolvedValue(list([{ ...orphan, status }]))
    renderAt('/files')

    expect(await screen.findByText(label)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Télécharger/ })).not.toBeInTheDocument()
  })

  it('shows a drop box origin as plain text', async () => {
    vi.mocked(listFiles).mockResolvedValue(list([{ ...orphan, link: { ...orphan.link, type: 'drop' } }]))
    renderAt('/files')

    expect(await screen.findByText('Dépôt gone')).toBeInTheDocument()
    expect(screen.getByText('lien supprimé')).toBeInTheDocument()
  })

  it('shows a loading state, then the empty states', async () => {
    vi.mocked(listFiles).mockResolvedValue(list([]))
    const { container } = renderAt('/files')

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText('Aucun fichier stocké')).toBeInTheDocument()
  })

  it('shows the orphan-specific empty state with the usage bar', async () => {
    vi.mocked(listFiles).mockResolvedValue(list([]))
    renderAt('/files?orphans=true')

    expect(await screen.findByText('Aucun fichier orphelin')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('reads the orphan filter from the URL', async () => {
    renderAt('/files?orphans=true')

    await screen.findByText('photo.jpg')
    expect(listFiles).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Orphelins' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ignores an invalid filter value', async () => {
    renderAt('/files?orphans=false')

    await screen.findByText('photo.jpg')
    expect(listFiles).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('updates the URL and refetches when the filter changes', async () => {
    const user = userEvent.setup()
    renderAt('/files')
    await screen.findByText('photo.jpg')

    await user.click(screen.getByRole('button', { name: 'Orphelins' }))

    await waitFor(() => expect(listFiles).toHaveBeenLastCalledWith(true))
    expect(screen.getByTestId('search')).toHaveTextContent('?orphans=true')

    await user.click(screen.getByRole('button', { name: 'Tous' }))

    await waitFor(() => expect(listFiles).toHaveBeenLastCalledWith(false))
    expect(screen.getByTestId('search')).toBeEmptyDOMElement()
  })

  it('shows the space used and the real storage usage', async () => {
    renderAt('/files')

    expect(await screen.findByText('1 Ko utilisés sur 4 Ko')).toBeInTheDocument()
    expect(screen.getByText('dont 512 o de fichiers orphelins')).toBeInTheDocument()
    expect(screen.getByText('Usage réel du stockage : 4 Ko')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  })

  it('mentions an unavailable storage usage', async () => {
    vi.mocked(listFiles).mockResolvedValue(list([file], null))
    renderAt('/files')

    expect(await screen.findByText('Usage réel du stockage indisponible')).toBeInTheDocument()
  })

  it('disables the delete button of a file in use, with a hint', async () => {
    renderAt('/files')

    const button = await screen.findByRole('button', { name: 'Supprimer photo.jpg' })
    expect(button).toBeDisabled()
    expect(button.parentElement).toHaveAttribute('title', expect.stringContaining('encore attaché'))
  })

  it('confirms the deletion, then refreshes the list and the usage', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteFile).mockResolvedValue()
    vi.mocked(listFiles)
      .mockResolvedValueOnce(list([file, orphan]))
      .mockResolvedValueOnce({ files: [file], summary: { ...list([]).summary, quotaUsedBytes: 512 } })
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Supprimer old.zip' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/old\.zip \(2 Ko\)/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('f2'))
    await waitFor(() => expect(screen.queryByText('old.zip')).not.toBeInTheDocument())
    expect(await screen.findByText('512 o utilisés sur 4 Ko')).toBeInTheDocument()
  })

  it('refreshes the sidebar gauge after a deletion', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteFile).mockResolvedValue()
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Supprimer old.zip' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(refreshStorageUsage).toHaveBeenCalledTimes(1))
  })

  it('translates a conflict on deletion and refreshes the list', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteFile).mockRejectedValue(apiError(409))
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Supprimer old.zip' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    expect(await within(dialog).findByText('Ce fichier est encore attaché à un partage ou à un dépôt.')).toBeInTheDocument()
    await waitFor(() => expect(listFiles).toHaveBeenCalledTimes(2))
  })

  it('translates a 404 on deletion, then refreshes the list and the gauge', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteFile).mockRejectedValue(apiError(404))
    vi.mocked(listFiles)
      .mockResolvedValueOnce(list([file, orphan]))
      .mockResolvedValueOnce(list([file]))
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Supprimer old.zip' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    expect(await within(dialog).findByText('Fichier introuvable.')).toBeInTheDocument()
    await waitFor(() => expect(listFiles).toHaveBeenCalledTimes(2))
    expect(refreshStorageUsage).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('old.zip')).not.toBeInTheDocument())
  })

  it('does not refresh after a 503 on deletion', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteFile).mockRejectedValue(apiError(503))
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Supprimer old.zip' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await within(dialog).findByText(/Stockage injoignable/)
    expect(listFiles).toHaveBeenCalledTimes(1)
    expect(refreshStorageUsage).not.toHaveBeenCalled()
  })

  it('translates an unreachable storage on deletion', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteFile).mockRejectedValue(apiError(503))
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Supprimer old.zip' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    expect(await within(dialog).findByText(/Stockage injoignable/)).toBeInTheDocument()
  })

  it('downloads a ready file', async () => {
    const user = userEvent.setup()
    vi.mocked(createFileDownloadUrl).mockResolvedValue('https://cdn.example/f1')
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Télécharger photo.jpg' }))

    await waitFor(() => expect(startDownload).toHaveBeenCalledWith('https://cdn.example/f1'))
    expect(createFileDownloadUrl).toHaveBeenCalledWith('f1')
  })

  it.each([
    [409, "Ce fichier n'est pas encore prêt."],
    [404, 'Fichier introuvable.'],
  ])('translates a %i on download', async (status, message) => {
    const user = userEvent.setup()
    vi.mocked(createFileDownloadUrl).mockRejectedValue(apiError(status))
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Télécharger photo.jpg' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message))
    expect(startDownload).not.toHaveBeenCalled()
  })

  it('shows the retry delay on a 429', async () => {
    const user = userEvent.setup()
    vi.mocked(createFileDownloadUrl).mockRejectedValue(apiError(429, { 'retry-after': '12' }))
    renderAt('/files')

    await user.click(await screen.findByRole('button', { name: 'Télécharger photo.jpg' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('12')))
  })

  it('shows the list failure and retries', async () => {
    const user = userEvent.setup()
    vi.mocked(listFiles).mockRejectedValueOnce(apiError(503))
    renderAt('/files')

    expect(await screen.findByText('Impossible de charger les fichiers')).toBeInTheDocument()
    expect(screen.getByText(/Stockage injoignable/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('photo.jpg')).toBeInTheDocument()
  })
})
