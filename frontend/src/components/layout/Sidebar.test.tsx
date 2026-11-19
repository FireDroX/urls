import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getLinksHealth } from '#api/links'
import { getStorageUsage } from '#api/storage'
import { refreshLinkHealth } from '#lib/link-health-refresh'
import { refreshStorageUsage } from '#lib/storage-usage-refresh'
import { Sidebar } from './Sidebar'

vi.mock('#api/storage', () => ({
  getStorageUsage: vi.fn(),
}))

vi.mock('#api/links', () => ({
  getLinksHealth: vi.fn(),
}))

const ENTRIES = ['Tous les liens', 'Redirections', 'Partages', 'Fichiers', 'Réglages']

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  )
}

function activeEntries(): string[] {
  return ENTRIES.filter((name) => screen.getByRole('link', { name }).getAttribute('aria-current') === 'page')
}

beforeEach(() => {
  vi.mocked(getStorageUsage).mockReturnValue(new Promise(() => {}))
  vi.mocked(getLinksHealth).mockResolvedValue({ broken: 0 })
})

describe('Sidebar', () => {
  it.each([
    ['/', ['Tous les liens']],
    ['/redirects', ['Redirections']],
    ['/redirects/docs', ['Redirections']],
    ['/shares', ['Partages']],
    ['/shares/photos', ['Partages']],
    ['/files', ['Fichiers']],
    ['/settings', ['Réglages']],
    ['/settings/extra', []],
    ['/unknown', []],
  ])('highlights the right entry on %s', (path, expected) => {
    renderAt(path)

    expect(activeEntries()).toEqual(expected)
  })

  it('reloads the storage gauge when a refresh is requested', async () => {
    vi.mocked(getStorageUsage)
      .mockResolvedValueOnce({ usedBytes: 1024, quotaBytes: 4096 })
      .mockResolvedValueOnce({ usedBytes: 2048, quotaBytes: 4096 })
    renderAt('/')

    expect(await screen.findByText('1 Kio / 4 Kio')).toBeInTheDocument()
    act(() => refreshStorageUsage())

    expect(await screen.findByText('2 Kio / 4 Kio')).toBeInTheDocument()
    expect(getStorageUsage).toHaveBeenCalledTimes(2)
  })

  it('shows the number of broken redirects next to Redirections', async () => {
    vi.mocked(getLinksHealth).mockResolvedValue({ broken: 3 })
    renderAt('/')

    expect(await screen.findByRole('img', { name: '3 redirections cassées' })).toHaveTextContent('3')
  })

  it('shows no counter when no redirect is broken', async () => {
    renderAt('/')

    await waitFor(() => expect(getLinksHealth).toHaveBeenCalled())
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('hides the counter when the count cannot be read', async () => {
    vi.mocked(getLinksHealth).mockRejectedValue(new Error('offline'))
    renderAt('/')

    await waitFor(() => expect(getLinksHealth).toHaveBeenCalled())
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('reads the counter again when a refresh is requested', async () => {
    vi.mocked(getLinksHealth)
      .mockResolvedValueOnce({ broken: 2 })
      .mockResolvedValueOnce({ broken: 1 })
    renderAt('/')

    expect(await screen.findByRole('img', { name: '2 redirections cassées' })).toBeInTheDocument()
    act(() => refreshLinkHealth())

    expect(await screen.findByRole('img', { name: '1 redirection cassée' })).toBeInTheDocument()
  })

  it('links every entry to its page', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: 'Tous les liens' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Redirections' })).toHaveAttribute('href', '/redirects')
    expect(screen.getByRole('link', { name: 'Partages' })).toHaveAttribute('href', '/shares')
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/settings')
  })
})
