import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFolder, deleteFolder, listFolders, type Folder } from '#api/folders'
import { createTag, deleteTag, listTags, type Tag } from '#api/tags'
import { Organization } from './Organization'

vi.mock('#api/tags', () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

vi.mock('#api/folders', () => ({
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
}))

const tag: Tag = {
  id: 'tag00001',
  name: 'Travail',
  color: '#ff8800',
  linkCount: 3,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

const folder: Folder = {
  id: 'fld00001',
  name: 'Projets',
  linkCount: 5,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
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

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listTags).mockResolvedValue([tag])
  vi.mocked(listFolders).mockResolvedValue([folder])
})

describe('Organization page', () => {
  it('lists tags and folders with their link counts', async () => {
    render(<Organization />)

    const tagRow = (await screen.findByText('Travail')).closest('tr')!
    expect(within(tagRow).getByText('3')).toBeInTheDocument()
    const folderRow = (await screen.findByText('Projets')).closest('tr')!
    expect(within(folderRow).getByText('5')).toBeInTheDocument()
  })

  it('shows the empty states', async () => {
    vi.mocked(listTags).mockResolvedValue([])
    vi.mocked(listFolders).mockResolvedValue([])
    render(<Organization />)

    expect(await screen.findByText("Aucun tag pour l'instant")).toBeInTheDocument()
    expect(await screen.findByText("Aucun dossier pour l'instant")).toBeInTheDocument()
  })

  it('creates a tag with a lowercase colour', async () => {
    const user = userEvent.setup()
    vi.mocked(createTag).mockResolvedValue({ ...tag, id: 'tag00002', name: 'Perso', linkCount: 0 })
    render(<Organization />)

    await user.click(await screen.findByRole('button', { name: 'Nouveau tag' }))
    await user.type(screen.getByLabelText('Nom'), 'Perso')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(createTag).toHaveBeenCalledWith({ name: 'Perso', color: '#6b7280' }))
    expect(await screen.findByText('Perso')).toBeInTheDocument()
  })

  it('translates a taken tag name', async () => {
    const user = userEvent.setup()
    vi.mocked(createTag).mockRejectedValue(apiError(409))
    render(<Organization />)

    await user.click(await screen.findByRole('button', { name: 'Nouveau tag' }))
    await user.type(screen.getByLabelText('Nom'), 'Travail')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Un tag porte déjà ce nom.')).toBeInTheDocument()
  })

  it('translates a taken folder name', async () => {
    const user = userEvent.setup()
    vi.mocked(createFolder).mockRejectedValue(apiError(409))
    render(<Organization />)

    await user.click(await screen.findByRole('button', { name: 'Nouveau dossier' }))
    await user.type(screen.getByLabelText('Nom'), 'Projets')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByText('Un dossier porte déjà ce nom.')).toBeInTheDocument()
  })

  it('deletes a tag only after confirmation, reminding that links stay', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteTag).mockResolvedValue()
    render(<Organization />)

    await user.click(await screen.findByRole('button', { name: 'Actions pour le tag Travail' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    expect(deleteTag).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('sera retiré de ses 3 liens ; les liens restent.')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteTag).toHaveBeenCalledWith('tag00001'))
    await waitFor(() => expect(screen.queryByText('Travail')).not.toBeInTheDocument())
  })

  it('deletes a folder after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteFolder).mockResolvedValue()
    render(<Organization />)

    await user.click(await screen.findByRole('button', { name: 'Actions pour le dossier Projets' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Les 5 liens du dossier « Projets » restent')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith('fld00001'))
    await waitFor(() => expect(screen.queryByText('Projets')).not.toBeInTheDocument())
  })
})
