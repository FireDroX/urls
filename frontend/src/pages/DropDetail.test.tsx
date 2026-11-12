import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDropFile, getDrop, type DropDetail as DropDetailData, type DropFile } from '#api/drops'
import { createFileDownloadUrl } from '#api/files'
import type { FileStatus } from '#api/shares'
import { FILE_STATUS_POLL_MS } from '#hooks/useShareDetail'
import { startDownload } from '#utils/start-download'
import { DropDetail } from './DropDetail'

vi.mock('#api/drops', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/drops')>()),
  getDrop: vi.fn(),
  deleteDropFile: vi.fn(),
}))
vi.mock('#api/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/files')>()),
  createFileDownloadUrl: vi.fn(),
}))
vi.mock('#utils/start-download', () => ({ startDownload: vi.fn() }))
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: vi.fn(), error: vi.fn() },
}))

function dropFile(status: FileStatus, overrides: Partial<DropFile> = {}): DropFile {
  return {
    id: 'file1234',
    name: 'photo.png',
    size: 1024,
    mime: 'image/png',
    status,
    uploaderName: 'Alice',
    createdAt: '2026-11-02T10:00:00.000Z',
    completedAt: null,
    ...overrides,
  }
}

function dropWith(...files: DropFile[]): DropDetailData {
  return {
    id: 'docs',
    title: 'Documents',
    maxTotalBytes: 1024 ** 3,
    maxFiles: 5,
    expiresAt: null,
    disabled: false,
    fileCount: files.length,
    totalSize: 2048,
    state: 'open',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    viewCount: 7,
    files,
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/drops/docs']}>
      <Routes>
        <Route path="/drops" element={<p>liste des dépôts</p>} />
        <Route path="/drops/:id" element={<DropDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function confirmFileDeletion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Supprimer photo.png' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getDrop).mockResolvedValue(dropWith(dropFile('ready')))
  vi.mocked(deleteDropFile).mockResolvedValue()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DropDetail page', () => {
  it('shows the settings, the views and the received files with their sender', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument()
    expect(screen.getByText(`${window.location.origin}/u/docs`)).toBeInTheDocument()
    expect(screen.getByText('Vues').nextSibling).toHaveTextContent('7')
    expect(screen.getByText('Fichiers reçus', { selector: 'dt' }).nextSibling).toHaveTextContent('1 / 5')
    const row = screen.getByText('photo.png').closest('tr')!
    expect(within(row).getByText('Alice')).toBeInTheDocument()
    expect(within(row).getByText('Prêt')).toBeInTheDocument()
  })

  it('labels an anonymous sender', async () => {
    vi.mocked(getDrop).mockResolvedValue(dropWith(dropFile('ready', { uploaderName: null })))
    renderPage()

    expect(await screen.findByText('Anonyme')).toBeInTheDocument()
  })

  it('renders a hostile sender name as literal text', async () => {
    const hostile = '<img src=x onerror=alert(1)>'
    vi.mocked(getDrop).mockResolvedValue(dropWith(dropFile('ready', { uploaderName: hostile })))
    const { container } = renderPage()

    expect(await screen.findByText(hostile)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows a not found state for an unknown drop', async () => {
    vi.mocked(getDrop).mockRejectedValue(apiError(404))
    renderPage()

    expect(await screen.findByText('Dépôt introuvable')).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup()
    vi.mocked(getDrop).mockRejectedValueOnce(new Error('down'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument()
  })

  it('shows an empty state without files', async () => {
    vi.mocked(getDrop).mockResolvedValue(dropWith())
    renderPage()

    expect(await screen.findByText(/Aucun fichier reçu/)).toBeInTheDocument()
  })

  it('polls while a file is verifying, then stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(getDrop).mockResolvedValueOnce(dropWith(dropFile('verifying')))
    vi.mocked(getDrop).mockResolvedValue(dropWith(dropFile('ready')))
    renderPage()
    expect(await screen.findByText('Vérification')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(FILE_STATUS_POLL_MS))

    expect(await screen.findByText('Prêt')).toBeInTheDocument()
    const calls = vi.mocked(getDrop).mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(FILE_STATUS_POLL_MS * 3))
    expect(getDrop).toHaveBeenCalledTimes(calls)
  })

  it('downloads a ready file directly', async () => {
    const user = userEvent.setup()
    vi.mocked(createFileDownloadUrl).mockResolvedValue('https://cdn.example/x')
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Télécharger photo.png' }))

    await waitFor(() => expect(startDownload).toHaveBeenCalledWith('https://cdn.example/x'))
    expect(createFileDownloadUrl).toHaveBeenCalledWith('file1234')
  })

  it('disables the download of a file that is not ready', async () => {
    vi.mocked(getDrop).mockResolvedValue(dropWith(dropFile('verifying')))
    renderPage()

    expect(await screen.findByRole('button', { name: 'Télécharger photo.png' })).toBeDisabled()
  })

  it('deletes a file after confirmation and refreshes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('photo.png')
    vi.mocked(getDrop).mockResolvedValue(dropWith())

    await confirmFileDeletion(user)

    await waitFor(() => expect(deleteDropFile).toHaveBeenCalledWith('docs', 'file1234'))
    await waitFor(() => expect(screen.queryByText('photo.png')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('Fichier supprimé.')
    await waitFor(() => expect(getDrop).toHaveBeenCalledTimes(2))
  })

  it('explains an unreachable storage and keeps the file', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteDropFile).mockRejectedValue(apiError(503))
    renderPage()
    await screen.findByText('photo.png')

    await confirmFileDeletion(user)

    expect(await screen.findByText(/Le stockage est injoignable/)).toBeInTheDocument()
    expect(screen.getAllByText('photo.png').length).toBeGreaterThan(0)
  })

  it('refreshes when the file no longer exists', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteDropFile).mockRejectedValue(apiError(404))
    renderPage()
    await screen.findByText('photo.png')
    vi.mocked(getDrop).mockResolvedValue(dropWith())

    await confirmFileDeletion(user)

    expect(await screen.findByText("Ce fichier n'existe plus.")).toBeInTheDocument()
    await waitFor(() => expect(getDrop).toHaveBeenCalledTimes(2))
  })
})
