import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  announceDropUpload,
  cancelDropUpload,
  completeDropUpload,
  getDropFile,
  getPublicDrop,
  listDropParts,
  uploadDropPart,
  type DropFile,
  type PublicDrop,
} from '#api/public-drops'
import { hashFile } from '#lib/file-hash'
import i18n from '#lib/i18n'
import { FILE_MAX_SIZE_BYTES } from '#schemas/share.schema'
import { PENDING_UPLOAD_TOKEN_TTL_MS, recallUpload, rememberUpload } from '#utils/pending-uploads'
import { DropUpload } from './DropUpload'

vi.mock('#api/public-drops', () => ({
  getPublicDrop: vi.fn(),
  announceDropUpload: vi.fn(),
  getDropFile: vi.fn(),
  listDropParts: vi.fn(),
  uploadDropPart: vi.fn(),
  completeDropUpload: vi.fn(),
  cancelDropUpload: vi.fn(),
}))

vi.mock('#lib/file-hash', () => ({ hashFile: vi.fn() }))

vi.mock('#components/Turnstile', () => ({
  TurnstileWidget: ({ onVerify, resetKey = 0 }: { onVerify: (token: string) => void; resetKey?: number }) => {
    const [solved, setSolved] = useState(0)
    return (
      <>
        <span data-testid="reset-key">{resetKey}</span>
        <button
          type="button"
          onClick={() => {
            setSolved(solved + 1)
            onVerify(`tok-${solved + 1}`)
          }}
        >
          solve
        </button>
      </>
    )
  },
}))

const SHA256 = 'ab'.repeat(32)
const DROP_ID = 'drop1234'
const DROP_HEADING = 'Photos de vacances'

const drop: PublicDrop = {
  id: DROP_ID,
  title: DROP_HEADING,
  maxFiles: 10,
  maxTotalBytes: 100 * 1024 ** 2,
  filesRemaining: 4,
  bytesRemaining: 50 * 1024 ** 2,
  expiresAt: null,
}

function dropFile(status: DropFile['status'], id = 'file0001'): DropFile {
  return { id, name: 'a.bin', size: 3, mime: null, status, createdAt: '2026-11-01T10:00:00.000Z', completedAt: null }
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

function announced(n: number) {
  return {
    fileId: `file000${n}`,
    partSize: 10,
    partCount: 1,
    uploadToken: `upl-${n}`,
    file: dropFile('uploading', `file000${n}`),
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/u/${DROP_ID}`]}>
      <Routes>
        <Route path="/u/:id" element={<DropUpload />} />
      </Routes>
    </MemoryRouter>,
  )
}

function zoneInput(): HTMLInputElement {
  const label = screen.getByText('Déposez vos fichiers ici, ou cliquez pour les choisir').closest('label')
  return label!.querySelector('input')!
}

function solve() {
  return userEvent.click(screen.getByRole('button', { name: 'solve' }))
}

function bin(name = 'a.bin', content = 'abc') {
  return new File([content], name, { lastModified: 1000 })
}

beforeEach(() => {
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key')
  localStorage.clear()
  vi.mocked(getPublicDrop).mockResolvedValue(drop)
  vi.mocked(hashFile).mockResolvedValue(SHA256)
  vi.mocked(announceDropUpload).mockResolvedValueOnce(announced(1)).mockResolvedValueOnce(announced(2))
  vi.mocked(uploadDropPart).mockResolvedValue()
  vi.mocked(completeDropUpload).mockResolvedValue()
  vi.mocked(getDropFile).mockResolvedValue(dropFile('verifying'))
})

afterEach(async () => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  await i18n.changeLanguage('fr')
})

describe('DropUpload page states', () => {
  it('shows the title, the counters, the name field and the drop zone', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: DROP_HEADING })).toBeInTheDocument()
    expect(screen.getByText('4 fichiers restants sur 10')).toBeInTheDocument()
    expect(screen.getByText(/^50.* restants sur 100/)).toBeInTheDocument()
    expect(screen.getByText('Pas de date de fermeture')).toBeInTheDocument()
    expect(screen.getByLabelText('Votre nom (facultatif)')).toHaveAttribute('maxlength', '80')
    expect(screen.getByText(/Encore .* disponibles/)).toBeInTheDocument()
    expect(screen.getByText('Une vérification est demandée pour chaque fichier.')).toBeInTheDocument()
  })

  it('shows the closing date when there is one', async () => {
    vi.mocked(getPublicDrop).mockResolvedValue({ ...drop, expiresAt: '2026-12-24T18:00:00.000Z' })

    renderPage()

    expect(await screen.findByText(/^Fermeture le .*2026/)).toBeInTheDocument()
  })

  it('shows an untitled drop with its default title', async () => {
    vi.mocked(getPublicDrop).mockResolvedValue({ ...drop, title: null })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Dépôt de fichiers' })).toBeInTheDocument()
  })

  it.each([
    [404, 'Lien introuvable'],
    [410, 'Ce dépôt est fermé'],
  ])('shows the page of a %s', async (status, heading) => {
    vi.mocked(getPublicDrop).mockRejectedValue(apiError(status))

    renderPage()

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('shows the Retry-After delay of a 429 and lets the visitor retry', async () => {
    const user = userEvent.setup()
    vi.mocked(getPublicDrop).mockRejectedValueOnce(apiError(429, { 'retry-after': '30' })).mockResolvedValue(drop)

    renderPage()

    expect(await screen.findByText('Trop de requêtes, réessayez dans 30 s.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: DROP_HEADING })).toBeInTheDocument()
  })

  it('follows the site language', async () => {
    await i18n.changeLanguage('en')

    renderPage()

    expect(await screen.findByLabelText('Your name (optional)')).toBeInTheDocument()
    expect(screen.getByText('4 files left out of 10')).toBeInTheDocument()
  })

  it('purges the expired pending uploads when it loads', async () => {
    const entry = { shareId: 'other', name: 'a', size: 1, lastModified: 1, sha256: SHA256, uploadToken: 't' }
    localStorage.setItem(
      'pending-uploads',
      JSON.stringify([
        { ...entry, fileId: 'old00001', savedAt: Date.now() - PENDING_UPLOAD_TOKEN_TTL_MS - 1 },
        { ...entry, fileId: 'fresh001', savedAt: Date.now() },
      ]),
    )

    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    expect(recallUpload('old00001')).toBeUndefined()
    expect(recallUpload('fresh001')).toBeDefined()
  })
})

describe('DropUpload sending', () => {
  it('hashes first, then waits for a Turnstile token, then announces', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())

    await waitFor(() => expect(hashFile).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(announceDropUpload).not.toHaveBeenCalled()

    await solve()

    await waitFor(() => expect(announceDropUpload).toHaveBeenCalledOnce())
    expect(vi.mocked(hashFile).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(announceDropUpload).mock.invocationCallOrder[0],
    )
    expect(announceDropUpload).toHaveBeenCalledWith(
      DROP_ID,
      expect.objectContaining({ name: 'a.bin', size: 3, sha256: SHA256, turnstileToken: 'tok-1' }),
    )
  })

  it('asks one token per file and resets the widget after each one', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })
    expect(screen.getByTestId('reset-key')).toHaveTextContent('0')

    await user.upload(zoneInput(), [bin('a.bin'), bin('b.bin')])
    await solve()
    await waitFor(() => expect(announceDropUpload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('reset-key')).toHaveTextContent('1'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(announceDropUpload).toHaveBeenCalledTimes(1)

    await solve()
    await waitFor(() => expect(announceDropUpload).toHaveBeenCalledTimes(2))

    const tokens = vi.mocked(announceDropUpload).mock.calls.map(([, body]) => body.turnstileToken)
    expect(tokens).toEqual(['tok-1', 'tok-2'])
    expect(screen.getByTestId('reset-key')).toHaveTextContent('2')
  })

  it('sends the name of the sender, trimmed', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.type(screen.getByLabelText('Votre nom (facultatif)'), '  Ada  ')
    await user.upload(zoneInput(), bin())
    await solve()

    await waitFor(() =>
      expect(announceDropUpload).toHaveBeenCalledWith(DROP_ID, expect.objectContaining({ uploaderName: 'Ada' })),
    )
  })

  it('sends no name when the field is empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())
    await solve()

    await waitFor(() =>
      expect(announceDropUpload).toHaveBeenCalledWith(DROP_ID, expect.objectContaining({ uploaderName: null })),
    )
  })

  it('sends the parts with the upload token and completes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())
    await solve()

    await waitFor(() => expect(completeDropUpload).toHaveBeenCalledWith(DROP_ID, { fileId: 'file0001', uploadToken: 'upl-1' }))
    expect(uploadDropPart).toHaveBeenCalledWith(
      DROP_ID,
      { fileId: 'file0001', uploadToken: 'upl-1' },
      1,
      expect.anything(),
      expect.anything(),
    )
    expect(recallUpload('file0001')).toBeUndefined()
  })

  it('moves a received file from checking to received, or rejected', async () => {
    const user = userEvent.setup()
    vi.mocked(getDropFile).mockImplementation((_id, { fileId }) =>
      Promise.resolve(dropFile(fileId === 'file0001' ? 'ready' : 'rejected', fileId)),
    )
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), [bin('a.bin'), bin('b.bin')])
    await solve()
    await waitFor(() => expect(announceDropUpload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('reset-key')).toHaveTextContent('1'))
    await solve()

    expect(await screen.findAllByText('Vérification…')).toHaveLength(2)
    expect(await screen.findByText('Reçu', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(await screen.findByText('Rejeté')).toBeInTheDocument()
    expect(getDropFile).toHaveBeenCalledWith(DROP_ID, { fileId: 'file0001', uploadToken: 'upl-1' })
  }, 15000)

  it('refreshes the drop after an upload and shows the closed notice when it closed meanwhile', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })
    vi.mocked(getPublicDrop).mockRejectedValue(apiError(410))

    await user.upload(zoneInput(), bin())
    await solve()

    expect(await screen.findByText(/Ce dépôt vient de se fermer/)).toBeInTheDocument()
    expect(zoneInput()).toBeDisabled()
    expect(screen.getByRole('heading', { name: DROP_HEADING })).toBeInTheDocument()
    expect(await screen.findByText('a.bin')).toBeInTheDocument()
  })

  it('shows the closed notice when the drop is gone during a refresh', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })
    vi.mocked(getPublicDrop).mockRejectedValue(apiError(404))

    await user.upload(zoneInput(), bin())
    await solve()

    expect(await screen.findByText(/Ce dépôt vient de se fermer/)).toBeInTheDocument()
    expect(zoneInput()).toBeDisabled()
    expect(screen.getByRole('heading', { name: DROP_HEADING })).toBeInTheDocument()
  })

  it('warns before closing the tab while an upload runs', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadDropPart).mockReturnValue(new Promise(() => undefined))
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())
    await solve()
    await waitFor(() => expect(uploadDropPart).toHaveBeenCalled())

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('cancels an upload through the public API with its token', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadDropPart).mockImplementation(
      (_id, _handle, _part, _body, { signal }) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    vi.mocked(cancelDropUpload).mockResolvedValue()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())
    await solve()
    await waitFor(() => expect(uploadDropPart).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: "Annuler l'envoi de a.bin" }))

    await waitFor(() => expect(cancelDropUpload).toHaveBeenCalledWith(DROP_ID, { fileId: 'file0001', uploadToken: 'upl-1' }))
    expect(recallUpload('file0001')).toBeUndefined()
  })
})

describe('DropUpload refusals', () => {
  it('refuses a file over the size limit without hashing nor sending it', async () => {
    const user = userEvent.setup()
    vi.mocked(getPublicDrop).mockResolvedValue({ ...drop, bytesRemaining: FILE_MAX_SIZE_BYTES * 2 })
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })
    const huge = bin('huge.iso')
    Object.defineProperty(huge, 'size', { value: FILE_MAX_SIZE_BYTES + 1 })

    await user.upload(zoneInput(), huge)

    expect(await screen.findByText('Ce fichier dépasse la taille maximale d\'un fichier.')).toBeInTheDocument()
    expect(screen.getByText('huge.iso')).toBeInTheDocument()
    expect(hashFile).not.toHaveBeenCalled()
    expect(announceDropUpload).not.toHaveBeenCalled()
  })

  it('refuses the files that do not fit in the remaining room', async () => {
    const user = userEvent.setup()
    vi.mocked(getPublicDrop).mockResolvedValue({ ...drop, filesRemaining: 1 })
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), [bin('first.bin'), bin('second.bin')])

    expect(await screen.findByText('Il ne reste pas assez de place dans ce dépôt pour ce fichier.')).toBeInTheDocument()
    await waitFor(() => expect(hashFile).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Fermer le refus de second.bin' }))
    expect(screen.queryByText('Il ne reste pas assez de place dans ce dépôt pour ce fichier.')).not.toBeInTheDocument()
  })

  it('refuses a file larger than the remaining bytes', async () => {
    const user = userEvent.setup()
    vi.mocked(getPublicDrop).mockResolvedValue({ ...drop, bytesRemaining: 2 })
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())

    expect(await screen.findByText('Il ne reste pas assez de place dans ce dépôt pour ce fichier.')).toBeInTheDocument()
    expect(hashFile).not.toHaveBeenCalled()
  })

  it.each([
    [413, 'Ce fichier est trop gros ou il ne reste pas assez de place dans le dépôt.'],
    [410, 'Le dépôt est fermé.'],
    [400, 'La vérification a échoué, réessayez.'],
  ])('shows the reason of a %i refused by the server', async (status, message) => {
    const user = userEvent.setup()
    vi.mocked(announceDropUpload).mockReset()
    vi.mocked(announceDropUpload).mockRejectedValue(apiError(status))
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())
    await solve()

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(recallUpload('file0001')).toBeUndefined()
  })

  it('shows the delay of a throttled announce', async () => {
    const user = userEvent.setup()
    vi.mocked(announceDropUpload).mockReset()
    vi.mocked(announceDropUpload).mockRejectedValue(apiError(429, { 'retry-after': '9' }))
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })

    await user.upload(zoneInput(), bin())
    await solve()

    expect(await screen.findByText('Trop de requêtes, réessayez dans 9 s.')).toBeInTheDocument()
  })
})

describe('DropUpload resuming', () => {
  function pendingEntry(overrides = {}) {
    rememberUpload({
      shareId: DROP_ID,
      fileId: 'file0001',
      name: 'a.bin',
      size: 3,
      lastModified: 1000,
      sha256: SHA256,
      uploadToken: 'upl-1',
      ...overrides,
    })
  }

  function resumeInput(): HTMLInputElement {
    return screen.getByLabelText('Reprendre l\'envoi de a.bin') as HTMLInputElement
  }

  beforeEach(() => {
    vi.mocked(listDropParts).mockResolvedValue({
      size: 3,
      sha256: SHA256,
      partSize: 2,
      parts: [{ partNumber: 1, size: 2 }],
    })
  })

  it('lists the interrupted uploads of this drop only', async () => {
    pendingEntry()
    pendingEntry({ shareId: 'other', fileId: 'file9999', name: 'z.bin' })

    renderPage()

    expect(await screen.findByText('Envois interrompus')).toBeInTheDocument()
    expect(screen.getByText('a.bin')).toBeInTheDocument()
    expect(screen.queryByText('z.bin')).not.toBeInTheDocument()
  })

  it('resumes with the same file, sending only the missing parts with the token', async () => {
    const user = userEvent.setup()
    pendingEntry()
    renderPage()
    await screen.findByText('Envois interrompus')

    await user.upload(resumeInput(), bin())

    await waitFor(() =>
      expect(completeDropUpload).toHaveBeenCalledWith(DROP_ID, { fileId: 'file0001', uploadToken: 'upl-1' }),
    )
    expect(listDropParts).toHaveBeenCalledWith(DROP_ID, { fileId: 'file0001', uploadToken: 'upl-1' })
    expect(uploadDropPart).toHaveBeenCalledTimes(1)
    expect(uploadDropPart).toHaveBeenCalledWith(
      DROP_ID,
      { fileId: 'file0001', uploadToken: 'upl-1' },
      2,
      expect.anything(),
      expect.anything(),
    )
    expect(announceDropUpload).not.toHaveBeenCalled()
  })

  it.each([
    ['files', { maxFiles: 2, filesRemaining: 1 }, 'second.bin', 'abc'],
    ['bytes', { bytesRemaining: 8 }, 'second.bin', 'abcdef'],
  ])('accepts a new file after resuming an upload the server already counts (%s)', async (_name, room, name, content) => {
    const user = userEvent.setup()
    vi.mocked(getPublicDrop).mockResolvedValue({ ...drop, ...room })
    pendingEntry()
    renderPage()
    await screen.findByText('Envois interrompus')
    let releasePart = () => {}
    vi.mocked(uploadDropPart).mockReturnValue(new Promise<void>((resolve) => (releasePart = resolve)))
    await user.upload(resumeInput(), bin())
    await waitFor(() => expect(uploadDropPart).toHaveBeenCalledTimes(1))

    await user.upload(zoneInput(), bin(name, content))
    expect(screen.queryByText('Il ne reste pas assez de place dans ce dépôt pour ce fichier.')).not.toBeInTheDocument()
    releasePart()
    await waitFor(() => expect(completeDropUpload).toHaveBeenCalledTimes(1))
    await solve()

    await waitFor(() => expect(announceDropUpload).toHaveBeenCalledTimes(1))
    expect(announceDropUpload).toHaveBeenCalledWith(
      DROP_ID,
      expect.objectContaining({ name, size: content.length }),
    )
    expect(screen.queryByText('Il ne reste pas assez de place dans ce dépôt pour ce fichier.')).not.toBeInTheDocument()
  })

  it('refuses another file without sending anything', async () => {
    const user = userEvent.setup()
    pendingEntry()
    renderPage()
    await screen.findByText('Envois interrompus')

    await user.upload(resumeInput(), bin('other.bin'))

    expect(await screen.findByText("Ce fichier n'est pas celui dont l'envoi a été interrompu.")).toBeInTheDocument()
    expect(uploadDropPart).not.toHaveBeenCalled()
    expect(completeDropUpload).not.toHaveBeenCalled()
  })

  it('abandons an interrupted upload with its token and forgets it', async () => {
    const user = userEvent.setup()
    pendingEntry()
    vi.mocked(cancelDropUpload).mockResolvedValue()
    renderPage()
    await screen.findByText('Envois interrompus')

    await user.click(screen.getByRole('button', { name: "Abandonner l'envoi de a.bin" }))

    await waitFor(() => expect(screen.queryByText('Envois interrompus')).not.toBeInTheDocument())
    expect(cancelDropUpload).toHaveBeenCalledWith(DROP_ID, { fileId: 'file0001', uploadToken: 'upl-1' })
    expect(recallUpload('file0001')).toBeUndefined()
  })

  it('forgets an upload the server no longer knows when abandoning it', async () => {
    const user = userEvent.setup()
    pendingEntry()
    vi.mocked(cancelDropUpload).mockRejectedValue(apiError(404))
    renderPage()
    await screen.findByText('Envois interrompus')

    await user.click(screen.getByRole('button', { name: "Abandonner l'envoi de a.bin" }))

    await waitFor(() => expect(recallUpload('file0001')).toBeUndefined())
  })

  it('keeps the entry and shows the delay when abandoning is throttled', async () => {
    const user = userEvent.setup()
    pendingEntry()
    vi.mocked(cancelDropUpload).mockRejectedValue(apiError(429, { 'retry-after': '30' }))
    renderPage()
    await screen.findByText('Envois interrompus')

    await user.click(screen.getByRole('button', { name: "Abandonner l'envoi de a.bin" }))

    expect(await screen.findByText(/30/)).toBeInTheDocument()
    expect(recallUpload('file0001')).toBeDefined()
    expect(screen.getByText('a.bin')).toBeInTheDocument()
  })
})

describe('DropUpload failed uploads', () => {
  const handle = { fileId: 'file0001', uploadToken: 'upl-1' }

  async function failFirstPart() {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.mocked(uploadDropPart).mockRejectedValueOnce(apiError(400))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: DROP_HEADING })
    await user.upload(zoneInput(), bin())
    await solve()
    await screen.findByRole('button', { name: "Abandonner l'envoi de a.bin" })
    return user
  }

  it('resumes a failed upload in the same session with the token, even without localStorage', async () => {
    vi.mocked(listDropParts).mockResolvedValue({
      size: 3,
      sha256: SHA256,
      partSize: 2,
      parts: [{ partNumber: 1, size: 2 }],
    })
    const user = await failFirstPart()

    await user.upload(screen.getByLabelText("Reprendre l'envoi de a.bin"), bin())

    await waitFor(() => expect(completeDropUpload).toHaveBeenCalledWith(DROP_ID, handle))
    expect(listDropParts).toHaveBeenCalledWith(DROP_ID, handle)
    expect(uploadDropPart).toHaveBeenLastCalledWith(DROP_ID, handle, 2, expect.anything(), expect.anything())
    expect(announceDropUpload).toHaveBeenCalledTimes(1)
  })

  it('abandons a failed upload with its token and removes the row', async () => {
    vi.mocked(cancelDropUpload).mockResolvedValue()
    const user = await failFirstPart()

    await user.click(screen.getByRole('button', { name: "Abandonner l'envoi de a.bin" }))

    await waitFor(() => expect(screen.queryByText('a.bin')).not.toBeInTheDocument())
    expect(cancelDropUpload).toHaveBeenCalledWith(DROP_ID, handle)
  })

  it('keeps the failed row with the reason when the cancel fails', async () => {
    vi.mocked(cancelDropUpload).mockRejectedValue(apiError(503))
    const user = await failFirstPart()

    await user.click(screen.getByRole('button', { name: "Abandonner l'envoi de a.bin" }))

    await waitFor(() => expect(cancelDropUpload).toHaveBeenCalledWith(DROP_ID, handle))
    expect(screen.getByText('a.bin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Abandonner l'envoi de a.bin" })).toBeInTheDocument()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  })
})
