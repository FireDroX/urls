import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DropStateBadge } from '#components/drops/DropStateBadge'
import { LinkHealthBadge } from '#components/links/LinkHealthBadge'
import { LinkStateBadge } from '#components/links/LinkStateBadge'

const status = { disabled: false, expiresAt: null }

describe('state badges', () => {
  it('shows an active link in green', () => {
    render(<LinkStateBadge link={status} />)

    expect(screen.getByText('Actif')).toHaveClass('bg-state-success-bg', 'text-state-success', 'border-transparent')
  })

  it('shows a disabled link in grey', () => {
    render(<LinkStateBadge link={{ ...status, disabled: true }} />)

    expect(screen.getByText('Désactivé')).toHaveClass('bg-state-neutral-bg', 'text-state-neutral')
  })

  it('shows an expired link in orange', () => {
    render(<LinkStateBadge link={{ ...status, expiresAt: '2000-01-01T00:00:00.000Z' }} />)

    expect(screen.getByText('Expiré')).toHaveClass('bg-state-expired-bg', 'text-state-expired')
  })

  it('shows an open drop in green and a full drop in orange', () => {
    const { rerender } = render(<DropStateBadge state="open" />)
    expect(screen.getByText('Ouvert')).toHaveClass('bg-state-success-bg')

    rerender(<DropStateBadge state="full" />)
    expect(screen.getByText('Plein')).toHaveClass('bg-state-expired-bg')
  })

  it('shows a broken redirect in red', () => {
    render(
      <LinkHealthBadge
        lastCheck={{ outcome: 'broken', statusCode: 500, errorKind: null, checkedAt: '2026-11-14T10:00:00.000Z', broken: true }}
      />,
    )

    expect(screen.getByText('Cassée')).toHaveClass('bg-state-danger-bg', 'text-state-danger')
  })

  it('uses the shared badge metrics', () => {
    render(<LinkStateBadge link={status} />)

    expect(screen.getByText('Actif')).toHaveClass('px-2', 'py-0.5', 'text-xs', 'font-semibold', 'rounded-full')
  })
})
