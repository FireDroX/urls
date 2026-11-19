import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LinkLastCheck } from '#api/links'
import { LinkHealthBadge } from './LinkHealthBadge'

const base: LinkLastCheck = {
  outcome: 'broken',
  statusCode: 500,
  errorKind: null,
  checkedAt: '2026-11-14T10:00:00.000Z',
  broken: true,
}

describe('LinkHealthBadge', () => {
  it('shows a broken badge with the HTTP status in the tooltip', () => {
    render(<LinkHealthBadge lastCheck={base} />)

    const title = screen.getByText('Cassée').closest('span[title]')?.getAttribute('title')
    expect(title).toContain('HTTP 500')
  })

  it('names the error kind when there is no status code', () => {
    render(<LinkHealthBadge lastCheck={{ ...base, statusCode: null, errorKind: 'dns' }} />)

    expect(screen.getByText('Cassée').closest('span[title]')?.getAttribute('title')).toContain('Nom de domaine introuvable')
  })

  it('shows an unchecked badge without any check', () => {
    render(<LinkHealthBadge lastCheck={null} />)

    expect(screen.getByText('Non vérifiée').closest('span[title]')?.getAttribute('title')).toBe('Jamais vérifiée')
  })

  it('shows an unchecked badge for a skipped check below the threshold', () => {
    render(<LinkHealthBadge lastCheck={{ ...base, outcome: 'skipped', statusCode: null, broken: false }} />)

    expect(screen.getByText('Non vérifiée')).toBeInTheDocument()
  })

  it('shows nothing for a healthy or barely failing redirect', () => {
    const { container, rerender } = render(
      <LinkHealthBadge lastCheck={{ ...base, outcome: 'ok', statusCode: 200, broken: false }} />,
    )
    expect(container).toBeEmptyDOMElement()

    rerender(<LinkHealthBadge lastCheck={{ ...base, broken: false }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
