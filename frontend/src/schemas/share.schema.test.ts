import { describe, expect, it } from 'vitest'
import type { Share } from '#api/shares'
import i18n from '#lib/i18n'
import { toDateTimeLocal } from '#utils/datetime-local'
import {
  createShareFormSchema,
  createUploadFileSchema,
  FILE_MAX_SIZE_BYTES,
  SHARE_MAX_DOWNLOADS_LIMIT,
  shareFormDefaults,
  toCreateSharePayload,
  toUpdateSharePayload,
} from './share.schema'

const t = i18n.t.bind(i18n)

const share: Share = {
  id: 'photos',
  expiresAt: '2099-01-01T10:00:00.000Z',
  maxDownloads: 5,
  downloadCount: 1,
  disabled: false,
  fileCount: 0,
  totalSize: 0,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

const emptyValues = { slug: '', expiresAt: '', maxDownloads: '', disabled: false }

function parseForm(values: Partial<typeof emptyValues>) {
  return createShareFormSchema(t).safeParse({ ...emptyValues, ...values })
}

describe('createShareFormSchema', () => {
  it('accepts an empty form: slug generated, no expiry, no limit', () => {
    expect(parseForm({}).success).toBe(true)
  })

  it.each(['1', '42', String(SHARE_MAX_DOWNLOADS_LIMIT)])('accepts %s downloads', (maxDownloads) => {
    expect(parseForm({ maxDownloads }).success).toBe(true)
  })

  it.each(['0', '-1', '1.5', 'many', String(SHARE_MAX_DOWNLOADS_LIMIT + 1)])('refuses %s downloads', (maxDownloads) => {
    expect(parseForm({ maxDownloads }).success).toBe(false)
  })

  it('applies the slug rules of the links', () => {
    expect(parseForm({ slug: 'ab' }).success).toBe(false)
    expect(parseForm({ slug: 'api' }).success).toBe(false)
    expect(parseForm({ slug: 'mes photos' }).success).toBe(false)
  })

  it('requires a slug when editing', () => {
    const result = createShareFormSchema(t, share).safeParse({ ...shareFormDefaults(share), slug: '' })

    expect(result.success).toBe(false)
  })

  it('refuses an expiry in the past, unless it is the unchanged value', () => {
    const past = { ...share, expiresAt: '2020-01-01T10:00:00.000Z' }
    const schema = createShareFormSchema(t, past)

    expect(schema.safeParse(shareFormDefaults(past)).success).toBe(true)
    expect(parseForm({ expiresAt: '2020-01-01T10:00' }).success).toBe(false)
  })
})

describe('toCreateSharePayload', () => {
  it('leaves out what was not filled in', () => {
    expect(toCreateSharePayload(emptyValues)).toEqual({})
  })

  it('sends the filled fields, the limit as a number', () => {
    expect(toCreateSharePayload({ ...emptyValues, slug: 'photos', maxDownloads: '5' })).toEqual({
      slug: 'photos',
      maxDownloads: 5,
    })
  })
})

describe('toUpdateSharePayload', () => {
  it('sends nothing when nothing changed', () => {
    expect(toUpdateSharePayload(share, shareFormDefaults(share))).toEqual({})
  })

  it('sends only the changed field', () => {
    const values = { ...shareFormDefaults(share), maxDownloads: '10' }

    expect(toUpdateSharePayload(share, values)).toEqual({ maxDownloads: 10 })
  })

  it('clears the limit and the expiry with null', () => {
    const values = { ...shareFormDefaults(share), maxDownloads: '', expiresAt: '' }

    expect(toUpdateSharePayload(share, values)).toEqual({ maxDownloads: null, expiresAt: null })
  })

  it('sends a new expiry as an ISO date', () => {
    const expiresAt = toDateTimeLocal('2099-06-01T08:00:00.000Z')
    const values = { ...shareFormDefaults(share), expiresAt }

    expect(toUpdateSharePayload(share, values)).toEqual({ expiresAt: '2099-06-01T08:00:00.000Z' })
  })
})

describe('createUploadFileSchema', () => {
  const schema = createUploadFileSchema(t, '20 Go')

  it('accepts a file up to the backend limit', () => {
    expect(schema.safeParse({ name: 'a.iso', size: FILE_MAX_SIZE_BYTES }).success).toBe(true)
  })

  it('refuses a file over 20 GiB', () => {
    const result = schema.safeParse({ name: 'a.iso', size: FILE_MAX_SIZE_BYTES + 1 })

    expect(result.error?.issues[0].message).toBe('20 Go maximum par fichier')
  })

  it('refuses an empty file', () => {
    expect(schema.safeParse({ name: 'a.iso', size: 0 }).error?.issues[0].message).toBe('fichier vide')
  })

  it('refuses a name longer than the backend limit', () => {
    expect(schema.safeParse({ name: 'a'.repeat(256), size: 1 }).success).toBe(false)
  })
})
