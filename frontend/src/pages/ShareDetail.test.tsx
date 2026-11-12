import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteShare,
  deleteShareFile,
  getShare,
  updateShare,
  type FileStatus,
  type ShareDetail as ShareDetailData,
  type ShareFile,
} from '#api/shares'
import { UploadsProvider } from '#components/UploadsProvider'
import { FILE_STATUS_POLL_MS } from '#hooks/useShareDetail'
import { DifferentFileError, UploadCanceledError } from '#lib/share-errors'
import { resumeFile, uploadNewFile, type UploadRequest } from '#lib/share-upload'
import { FILE_MAX_SIZE_BYTES } from '#schemas/share.schema'
import { recallUpload, rememberUpload } from '#utils/pending-uploads'
import { ShareDetail } from './ShareDetail'

vi.mock('#api/shares', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/shares')>()),
  getShare: vi.fn(),
  updateShare: vi.fn(),
  deleteShare: vi.fn(),
  deleteShareFile: vi.fn(),
}))

vi.mock('#lib/share-upload', () => ({ uploadNewFile: vi.fn(), resumeFile: vi.fn() }))

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: vi.fn(), error: vi.fn() },
}))

function shareFile(status: FileStatus, overrides: Partial<ShareFile> = {}): ShareFile {
  return {
    id: 'file1234',
    name: 'video.mp4',
    size: 1024,
    mime: null,
    status,
    createdAt: '2026-11-01T10:00:00.000Z',
    completedAt: null,
    ...overrides,
  }
}

function shareWith(...files: ShareFile[]): ShareDetailData {
  return {
    id: 'photos',
    expiresAt: null,
    maxDownloads: 10,
    downloadCount: 3,
    disabled: false,
    fileCount: files.length,
    totalSize: 2048,
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
  render(
    <MemoryRouter initialEntries={['/shares/photos']}>
      <UploadsProvider>
        <Routes>
          <Route path="/shares" element={<p>liste des partages</p>} />
          <Route path="/shares/:id" element={<ShareDetail />} />
        </Routes>
      </UploadsProvider>
    </MemoryRouter>,
  )
}

function dropInput(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('input[type="file"][multiple]')!
}

function neverEnding(): Promise<void> {
  return new Promise(() => {})
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  vi.mocked(getShare).mockResolvedValue(shareWith())
  vi.mocked(deleteShareFile).mockResolvedValue()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ShareDetail page', () => {
  it('shows the link, views, downloads and total size', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: '/d/photos' })).toBeInTheDocument()
    expect(screen.getByText('Vues').nextSibling).toHaveTextContent('7')
    expect(screen.getByText('Téléchargements').nextSibling).toHaveTextContent('3 / 10')
    expect(screen.getByText('Taille totale').nextSibling).toHaveTextContent('2 Kio')
  })

  it('shows a not found state for an unknown share', async () => {
    vi.mocked(getShare).mockRejectedValue(apiError(404))
    renderPage()

    expect(await screen.findByText('Partage introuvable')).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup()
    vi.mocked(getShare).mockRejectedValueOnce(new Error('down'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('heading', { name: '/d/photos' })).toBeInTheDocument()
  })

  it.each([
    ['uploading', 'Envoi inachevé'],
    ['verifying', 'Vérification'],
    ['ready', 'Prêt'],
    ['rejected', 'Rejeté'],
  ] as const)('shows the %s status', async (status, label) => {
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile(status)))
    renderPage()

    const row = (await screen.findByText('video.mp4')).closest('tr')!
    expect(within(row).getByText(label)).toBeInTheDocument()
    expect(within(row).getByText('1 Kio')).toBeInTheDocument()
  })

  it('follows a file from verifying to ready, then stops asking', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(getShare).mockResolvedValueOnce(shareWith(shareFile('verifying')))
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('ready')))
    renderPage()
    expect(await screen.findByText('Vérification')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(FILE_STATUS_POLL_MS))

    expect(await screen.findByText('Prêt')).toBeInTheDocument()
    const calls = vi.mocked(getShare).mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(FILE_STATUS_POLL_MS * 3))
    expect(getShare).toHaveBeenCalledTimes(calls)
  })

  it('shows when a file ends rejected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(getShare).mockResolvedValueOnce(shareWith(shareFile('verifying')))
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('rejected')))
    renderPage()
    await screen.findByText('Vérification')

    await act(() => vi.advanceTimersByTimeAsync(FILE_STATUS_POLL_MS))

    expect(await screen.findByText('Rejeté')).toBeInTheDocument()
  })

  it('offers to resume an unfinished file only', async () => {
    vi.mocked(getShare).mockResolvedValue(
      shareWith(shareFile('uploading'), shareFile('ready', { id: 'file5678', name: 'done.mp4' })),
    )
    renderPage()

    const ready = (await screen.findByText('done.mp4')).closest('tr')!
    expect(within(ready).queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
  })

  it('resumes with the selected file', async () => {
    const user = userEvent.setup()
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('uploading')))
    vi.mocked(resumeFile).mockImplementation(neverEnding)
    renderPage()
    const selected = new File(['abc'], 'video.mp4')

    await user.upload(await screen.findByLabelText("Reprendre l'envoi de video.mp4"), selected)

    await waitFor(() =>
      expect(resumeFile).toHaveBeenCalledWith(
        expect.objectContaining({ shareId: 'photos', fileId: 'file1234', file: selected }),
      ),
    )
    expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument()
  })

  it('refuses another file explicitly and offers to resume again', async () => {
    const user = userEvent.setup()
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('uploading')))
    vi.mocked(resumeFile).mockRejectedValue(new DifferentFileError())
    renderPage()

    await user.upload(await screen.findByLabelText("Reprendre l'envoi de video.mp4"), new File(['x'], 'other.mp4'))

    expect(
      await screen.findByText("Ce n'est pas le fichier de l'envoi interrompu : rien n'a été envoyé."),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
  })

  it('clears a refused resume when its file is deleted', async () => {
    const user = userEvent.setup()
    const refusal = "Ce n'est pas le fichier de l'envoi interrompu : rien n'a été envoyé."
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('uploading')))
    vi.mocked(resumeFile).mockRejectedValue(new DifferentFileError())
    renderPage()

    await user.upload(await screen.findByLabelText("Reprendre l'envoi de video.mp4"), new File(['x'], 'other.mp4'))
    expect(await screen.findByText(refusal)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Supprimer video.mp4' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteShareFile).toHaveBeenCalledWith('photos', 'file1234'))
    await waitFor(() => expect(screen.queryByText(refusal)).not.toBeInTheDocument())
  })

  describe('upload', () => {
    function startUpload(run: (request: UploadRequest) => Promise<void>) {
      vi.mocked(uploadNewFile).mockImplementation(run)
    }

    it('shows the hash progress on its own while hashing', async () => {
      const user = userEvent.setup()
      startUpload(({ observer }) => {
        observer.onPhase('hashing')
        observer.onHashed(2)
        return neverEnding()
      })
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })

      await user.upload(dropInput(), new File(['abcd'], 'a.bin'))

      const bar = await screen.findByRole('progressbar', { name: "Calcul de l'empreinte" })
      expect(bar).toHaveAttribute('aria-valuenow', '50')
      expect(screen.queryByRole('progressbar', { name: 'Envoi' })).not.toBeInTheDocument()
    })

    it('shows both progress bars while sending', async () => {
      const user = userEvent.setup()
      startUpload(({ observer }) => {
        observer.onHashed(4)
        observer.onPhase('uploading')
        observer.onSent(1)
        return neverEnding()
      })
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })

      await user.upload(dropInput(), new File(['abcd'], 'a.bin'))

      expect(await screen.findByRole('progressbar', { name: 'Envoi' })).toHaveAttribute('aria-valuenow', '25')
      expect(screen.getByRole('progressbar', { name: "Calcul de l'empreinte" })).toHaveAttribute('aria-valuenow', '100')
    })

    it('hides the file row of a running upload, which has its own progress', async () => {
      const user = userEvent.setup()
      vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('uploading', { name: 'a.bin' })))
      startUpload(({ observer }) => {
        observer.onOpened('file1234')
        return neverEnding()
      })
      renderPage()
      await screen.findByRole('button', { name: 'Reprendre' })

      await user.upload(dropInput(), new File(['abcd'], 'a.bin'))

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument())
    })

    it('cancels an upload with the DELETE route', async () => {
      const user = userEvent.setup()
      startUpload(({ observer, signal }) => {
        observer.onOpened('file1234')
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new UploadCanceledError()))
        })
      })
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })

      await user.upload(dropInput(), new File(['abcd'], 'a.bin'))
      await user.click(await screen.findByRole('button', { name: "Annuler l'envoi de a.bin" }))

      await waitFor(() => expect(deleteShareFile).toHaveBeenCalledWith('photos', 'file1234'))
      await waitFor(() => expect(screen.queryByText('a.bin')).not.toBeInTheDocument())
    })

    it('reloads the files once an upload is finished', async () => {
      const user = userEvent.setup()
      startUpload(() => Promise.resolve())
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })
      vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('verifying', { name: 'a.bin' })))

      await user.upload(dropInput(), new File(['abcd'], 'a.bin'))

      expect(await screen.findByText('Vérification')).toBeInTheDocument()
    })

    it.each([
      [413, 'Trop volumineux : limite du fichier, du partage ou du stockage atteinte.'],
      [409, "Cet envoi n'est plus en cours, ou des parts manquent encore."],
      [404, "Ce fichier ou ce partage n'existe plus."],
      [400, 'Ce fichier a été refusé : nom, taille ou part invalide.'],
    ])('translates a %i and lets the error be dismissed', async (status, message) => {
      const user = userEvent.setup()
      startUpload(() => Promise.reject(apiError(status)))
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })

      await user.upload(dropInput(), new File(['abcd'], 'a.bin'))

      expect(await screen.findByText(message)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: "Fermer l'erreur de a.bin" }))
      expect(screen.queryByText(message)).not.toBeInTheDocument()
    })

    it('keeps the local memory of an upload cut before the page listed its file', async () => {
      const user = userEvent.setup()
      startUpload(({ shareId, file, observer }) => {
        const { name, size, lastModified } = file
        rememberUpload({ shareId, fileId: 'file1234', name, size, lastModified, sha256: 'ab' })
        observer.onOpened('file1234')
        return Promise.reject(new Error('network down'))
      })
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })
      vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('uploading', { name: 'a.bin' })))

      await user.upload(dropInput(), new File(['abcd'], 'a.bin'))

      expect(await screen.findByRole('button', { name: 'Reprendre' })).toBeInTheDocument()
      expect(recallUpload('file1234')).toBeDefined()
    })

    it('refuses an empty file before hashing anything', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })

      await user.upload(dropInput(), new File([], 'empty.bin'))

      expect(toast.error).toHaveBeenCalledWith('empty.bin refusé : fichier vide')
      expect(uploadNewFile).not.toHaveBeenCalled()
    })

    it('refuses a file over the limit and keeps the others of the selection', async () => {
      const user = userEvent.setup()
      startUpload(neverEnding)
      renderPage()
      await screen.findByRole('heading', { name: '/d/photos' })
      const tooLarge = new File(['x'], 'huge.iso')
      Object.defineProperty(tooLarge, 'size', { value: FILE_MAX_SIZE_BYTES + 1 })

      await user.upload(dropInput(), [tooLarge, new File(['abc'], 'ok.bin')])

      expect(toast.error).toHaveBeenCalledWith('huge.iso refusé : 20 Gio maximum par fichier')
      expect(await screen.findByText('ok.bin')).toBeInTheDocument()
      expect(screen.queryByText('huge.iso')).not.toBeInTheDocument()
    })
  })

  it('deletes a file after confirmation and updates the page', async () => {
    const user = userEvent.setup()
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('ready')))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer video.mp4' }))
    expect(deleteShareFile).not.toHaveBeenCalled()
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteShareFile).toHaveBeenCalledWith('photos', 'file1234'))
    await waitFor(() => expect(screen.queryByText('video.mp4')).not.toBeInTheDocument())
  })

  it('keeps the dialog open with a translated error when the file deletion fails', async () => {
    const user = userEvent.setup()
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('ready')))
    vi.mocked(deleteShareFile).mockRejectedValue(apiError(404))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer video.mp4' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText("Ce fichier ou ce partage n'existe plus.")).toBeInTheDocument()
  })

  it('edits the settings and follows a new slug', async () => {
    const user = userEvent.setup()
    vi.mocked(updateShare).mockResolvedValue({ ...shareWith(), id: 'vacances' })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    const slug = screen.getByLabelText('Slug')
    await user.clear(slug)
    await user.type(slug, 'vacances')
    vi.mocked(getShare).mockResolvedValue({ ...shareWith(), id: 'vacances' })
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateShare).toHaveBeenCalledWith('photos', { slug: 'vacances' })
    expect(await screen.findByRole('heading', { name: '/d/vacances' })).toBeInTheDocument()
  })

  it('locks the slug during an upload, whose parts target it', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadNewFile).mockImplementation(neverEnding)
    renderPage()
    await screen.findByRole('heading', { name: '/d/photos' })

    await user.upload(dropInput(), new File(['abcd'], 'a.bin'))
    await user.click(await screen.findByRole('button', { name: 'Modifier' }))

    expect(screen.getByLabelText('Slug')).toBeDisabled()
    expect(screen.getByText('Le slug ne peut pas changer pendant un envoi.')).toBeInTheDocument()
  })

  it('disables the share', async () => {
    const user = userEvent.setup()
    vi.mocked(updateShare).mockResolvedValue({ ...shareWith(), disabled: true })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Désactiver' }))

    expect(updateShare).toHaveBeenCalledWith('photos', { disabled: true })
    expect(await screen.findByRole('button', { name: 'Réactiver' })).toBeInTheDocument()
  })

  it('deletes the share after confirmation and goes back to the list', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteShare).mockResolvedValue()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('liste des partages')).toBeInTheDocument()
    expect(deleteShare).toHaveBeenCalledWith('photos')
  })

  it('forgets the local memory of files that are no longer uploading', async () => {
    localStorage.setItem(
      'pending-uploads',
      JSON.stringify([
        { shareId: 'photos', fileId: 'gone1234', name: 'a', size: 1, lastModified: 1, sha256: 'ab' },
        { shareId: 'photos', fileId: 'file1234', name: 'b', size: 1, lastModified: 1, sha256: 'ab' },
      ]),
    )
    vi.mocked(getShare).mockResolvedValue(shareWith(shareFile('uploading')))
    renderPage()
    await screen.findByText('video.mp4')

    const stored = JSON.parse(localStorage.getItem('pending-uploads') ?? '[]') as { fileId: string }[]
    expect(stored.map(({ fileId }) => fileId)).toEqual(['file1234'])
  })
})
