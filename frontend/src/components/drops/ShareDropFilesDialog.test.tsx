import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shareDropFiles, type DropFile } from '#api/drops'
import type { FileStatus, ShareDetail } from '#api/shares'
import { ShareDropFilesDialog } from './ShareDropFilesDialog'

vi.mock('#api/drops', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/drops')>()),
  shareDropFiles: vi.fn(),
}))

function dropFile(id: string, status: FileStatus = 'ready'): DropFile {
  return {
    id,
    name: `${id}.png`,
    size: 1024,
    mime: 'image/png',
    status,
    uploaderName: null,
    createdAt: '2026-11-02T10:00:00.000Z',
    completedAt: null,
  }
}

function apiError(status: number, message: string): AxiosError {
  const response = {
    status,
    data: { error: message },
    headers: new AxiosHeaders(),
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('failed', undefined, undefined, undefined, response)
}

const onShared = vi.fn()
const onStale = vi.fn()

function renderDialog(files = [dropFile('a1'), dropFile('b2'), dropFile('c3', 'verifying')]) {
  return render(
    <ShareDropFilesDialog
      open
      dropId="docs"
      files={files}
      onOpenChange={vi.fn()}
      onShared={onShared}
      onStale={onStale}
    />,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(shareDropFiles).mockResolvedValue({ id: 'newshare' } as ShareDetail)
})

describe('ShareDropFilesDialog', () => {
  it('lists only the ready files, all checked, with the drop closing by default', () => {
    renderDialog()

    expect(screen.getByRole('checkbox', { name: /a1\.png/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /b2\.png/ })).toBeChecked()
    expect(screen.queryByText('c3.png')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Fermer le dépôt' })).toBeChecked()
  })

  it('sends every ready file and closeDrop true by default', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Créer le partage' }))

    await waitFor(() =>
      expect(shareDropFiles).toHaveBeenCalledWith('docs', { fileIds: ['a1', 'b2'], closeDrop: true }),
    )
    expect(onShared).toHaveBeenCalledWith({ id: 'newshare' })
  })

  it('sends the chosen files, the options and closeDrop false once unchecked', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('checkbox', { name: /b2\.png/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Fermer le dépôt' }))
    await user.type(screen.getByLabelText('Slug (facultatif)'), 'mon-partage')
    await user.type(screen.getByLabelText(/Téléchargements maximum/), '3')
    await user.click(screen.getByRole('button', { name: 'Créer le partage' }))

    await waitFor(() =>
      expect(shareDropFiles).toHaveBeenCalledWith('docs', {
        fileIds: ['a1'],
        closeDrop: false,
        slug: 'mon-partage',
        maxDownloads: 3,
      }),
    )
  })

  it('blocks the submission when no file is selected', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('checkbox', { name: /a1\.png/ }))
    await user.click(screen.getByRole('checkbox', { name: /b2\.png/ }))
    await user.click(screen.getByRole('button', { name: 'Créer le partage' }))

    expect(await screen.findByText('Choisissez au moins un fichier')).toBeInTheDocument()
    expect(shareDropFiles).not.toHaveBeenCalled()
  })

  it('shows the slug conflict without refreshing the drop', async () => {
    const user = userEvent.setup()
    vi.mocked(shareDropFiles).mockRejectedValue(apiError(409, 'Slug already taken'))
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Créer le partage' }))

    expect(await screen.findByText('Ce slug est déjà pris.')).toBeInTheDocument()
    expect(onStale).not.toHaveBeenCalled()
    expect(onShared).not.toHaveBeenCalled()
  })

  it('shows a file that is no longer ready and refreshes the drop', async () => {
    const user = userEvent.setup()
    vi.mocked(shareDropFiles).mockRejectedValue(apiError(409, 'File is not ready'))
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Créer le partage' }))

    expect(await screen.findByText("Un fichier n'est plus prêt. La liste a été actualisée.")).toBeInTheDocument()
    expect(onStale).toHaveBeenCalled()
  })
})
