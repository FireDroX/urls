import { describe, expect, it } from 'vitest'
import type { Link } from '#api/links'
import i18n from '#lib/i18n'
import { toDateTimeLocal } from '#utils/datetime-local'
import {
  createLinkFormSchema,
  LINK_DESTINATION_MAX_LENGTH,
  LINK_SLUG_MAX_LENGTH,
  linkFormDefaults,
  toCreateLinkPayload,
  toUpdateLinkPayload,
  type LinkFormValues,
} from './link.schema'

const t = i18n.t
const HOUR_MS = 60 * 60 * 1000

const link: Link = {
  id: 'docs',
  type: 'redirect',
  destination: 'https://example.com/',
  expiresAt: null,
  disabled: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

function values(overrides: Partial<LinkFormValues> = {}): LinkFormValues {
  return { destination: 'https://example.com/', slug: '', expiresAt: '', disabled: false, ...overrides }
}

function localIn(ms: number): string {
  return toDateTimeLocal(new Date(Date.now() + ms).toISOString())
}

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }): string | undefined {
  return result.error?.issues[0]?.message
}

describe('createLinkFormSchema (creation)', () => {
  const schema = createLinkFormSchema(t)

  it('accepts a destination alone and trims it', () => {
    const result = schema.safeParse(values({ destination: '  https://example.com/a  ' }))

    expect(result.success).toBe(true)
    expect(result.data?.destination).toBe('https://example.com/a')
  })

  it('requires a destination', () => {
    expect(firstError(schema.safeParse(values({ destination: '   ' })))).toBe('Destination requise')
  })

  it.each(['ftp://example.com', 'javascript:alert(1)', 'example.com', 'mailto:me@example.com'])(
    'rejects the non-http destination %s',
    (destination) => {
      expect(firstError(schema.safeParse(values({ destination })))).toBe('Adresse http:// ou https:// attendue')
    },
  )

  it('rejects a destination over the backend limit', () => {
    const destination = `https://example.com/${'a'.repeat(LINK_DESTINATION_MAX_LENGTH)}`

    expect(firstError(schema.safeParse(values({ destination })))).toBe('2048 caractères maximum')
  })

  it('accepts a valid custom slug', () => {
    expect(schema.safeParse(values({ slug: 'My_link-2' })).success).toBe(true)
  })

  it.each([
    ['ab', 'Au moins 3 caractères'],
    ['a'.repeat(LINK_SLUG_MAX_LENGTH + 1), '64 caractères maximum'],
    ['with space', 'Lettres, chiffres, « - » et « _ » uniquement'],
    ['été', 'Lettres, chiffres, « - » et « _ » uniquement'],
    ['API', 'Ce slug est réservé'],
    ['settings', 'Ce slug est réservé'],
  ])('rejects the slug %s', (slug, message) => {
    expect(firstError(schema.safeParse(values({ slug })))).toBe(message)
  })

  it('accepts an expiry in the future and rejects one in the past', () => {
    expect(schema.safeParse(values({ expiresAt: localIn(HOUR_MS) })).success).toBe(true)
    expect(firstError(schema.safeParse(values({ expiresAt: localIn(-HOUR_MS) })))).toBe(
      "La date d'expiration doit être dans le futur",
    )
  })
})

describe('createLinkFormSchema (edition)', () => {
  it('requires the slug', () => {
    const schema = createLinkFormSchema(t, link)

    expect(firstError(schema.safeParse(values({ slug: '' })))).toBe('Au moins 3 caractères')
  })

  it('keeps an already past expiry when it is left unchanged', () => {
    const expired = { ...link, expiresAt: new Date(Date.now() - HOUR_MS).toISOString() }
    const schema = createLinkFormSchema(t, expired)

    expect(schema.safeParse(linkFormDefaults(expired)).success).toBe(true)
    expect(schema.safeParse({ ...linkFormDefaults(expired), expiresAt: localIn(-2 * HOUR_MS) }).success).toBe(false)
  })
})

describe('toCreateLinkPayload', () => {
  it('omits the empty slug and expiry', () => {
    expect(toCreateLinkPayload(values())).toEqual({ destination: 'https://example.com/' })
  })

  it('sends the slug and the expiry as an ISO date', () => {
    const expiresAt = '2030-01-02T03:04'

    expect(toCreateLinkPayload(values({ slug: 'docs', expiresAt }))).toEqual({
      destination: 'https://example.com/',
      slug: 'docs',
      expiresAt: new Date(expiresAt).toISOString(),
    })
  })
})

describe('toUpdateLinkPayload', () => {
  it('is empty when nothing changed', () => {
    expect(toUpdateLinkPayload(link, linkFormDefaults(link))).toEqual({})
  })

  it('sends only the changed fields', () => {
    const changed = { ...linkFormDefaults(link), destination: 'https://example.org/', disabled: true }

    expect(toUpdateLinkPayload(link, changed)).toEqual({ destination: 'https://example.org/', disabled: true })
  })

  it('sends a new slug', () => {
    expect(toUpdateLinkPayload(link, { ...linkFormDefaults(link), slug: 'guides' })).toEqual({ slug: 'guides' })
  })

  it('sends null to remove the expiry', () => {
    const expiring = { ...link, expiresAt: '2030-01-02T03:04:00.000Z' }

    expect(toUpdateLinkPayload(expiring, { ...linkFormDefaults(expiring), expiresAt: '' })).toEqual({
      expiresAt: null,
    })
  })
})
