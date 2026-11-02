import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLink, deleteLink, listLinks, updateLink, type Link } from '#api/links'
import { Redirects } from './Redirects'

vi.mock('#api/links', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/links')>()),
  listLinks: vi.fn(),
  createLink: vi.fn(),
  updateLink: vi.fn(),
  deleteLink: vi.fn(),
}))

const link: Link = {
  id: 'docs',
  type: 'redirect',
  destination: 'https://example.com/docs',
  expiresAt: null,
  disabled: false,
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

async function openRowMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Actions pour docs' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listLinks).mockResolvedValue([link])
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
    vi.mocked(createLink).mockResolvedValue({ ...link, id: 'new-one', destination: 'https://example.org/' })
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

  it('edits only the changed fields and updates the row', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockResolvedValue({ ...link, id: 'guides' })
    render(<Redirects />, { wrapper: MemoryRouter })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifier' }))
    const slug = screen.getByLabelText('Slug')
    await user.clear(slug)
    await user.type(slug, 'guides')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateLink).toHaveBeenCalledWith('docs', { slug: 'guides' })
    expect(await screen.findByText('/r/guides')).toBeInTheDocument()
  })

  it('disables a redirect from the row menu', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLink).mockResolvedValue({ ...link, disabled: true })
    render(<Redirects />, { wrapper: MemoryRouter })

    await openRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: 'Désactiver' }))

    expect(updateLink).toHaveBeenCalledWith('docs', { disabled: true })
    expect(await screen.findByText('Désactivé')).toBeInTheDocument()
  })

  it('deletes a redirect after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteLink).mockResolvedValue()
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
