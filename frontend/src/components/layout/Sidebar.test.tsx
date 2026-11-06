import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageUsage } from '#api/storage'
import { refreshStorageUsage } from '#lib/storage-usage-refresh'
import { Sidebar } from './Sidebar'

vi.mock('#api/storage', () => ({
  getStorageUsage: vi.fn(),
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

    expect(await screen.findByText('1 Ko / 4 Ko')).toBeInTheDocument()
    act(() => refreshStorageUsage())

    expect(await screen.findByText('2 Ko / 4 Ko')).toBeInTheDocument()
    expect(getStorageUsage).toHaveBeenCalledTimes(2)
  })

  it('links every entry to its page', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: 'Tous les liens' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Redirections' })).toHaveAttribute('href', '/redirects')
    expect(screen.getByRole('link', { name: 'Partages' })).toHaveAttribute('href', '/shares')
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/settings')
  })
})
