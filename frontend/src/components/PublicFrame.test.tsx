import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PublicFrame } from './PublicFrame'

describe('PublicFrame', () => {
  it('shows the brand linking home, the content and the footer', () => {
    render(
      <MemoryRouter>
        <PublicFrame footer="url.addrien.fr · partage privé">
          <p>contenu</p>
        </PublicFrame>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /url/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('main')).toHaveTextContent('contenu')
    expect(screen.getByText('url.addrien.fr · partage privé')).toBeInTheDocument()
  })
})
