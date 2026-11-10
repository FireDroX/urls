import { describe, expect, it } from 'vitest'
import type { Drop } from '#api/drops'
import i18n from '#lib/i18n'
import { toDateTimeLocal } from '#utils/datetime-local'
import {
  createDropFormSchema,
  DROP_MAX_FILES_LIMIT,
  DROP_TITLE_MAX_LENGTH,
  dropFormDefaults,
  toCreateDropPayload,
  toUpdateDropPayload,
} from './drop.schema'

const t = i18n.t.bind(i18n)
const GIB = 1024 ** 3

const drop: Drop = {
  id: 'docs',
  title: 'Documents',
  maxTotalBytes: 2 * GIB,
  maxFiles: 5,
  expiresAt: '2099-01-01T10:00:00.000Z',
  disabled: false,
  fileCount: 1,
  totalSize: 10,
  state: 'open',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

const validValues = { ...dropFormDefaults(undefined, new Date('2026-11-10T10:00:00')), expiresAt: '' }

function parseForm(values: Partial<typeof validValues>) {
  return createDropFormSchema(t).safeParse({ ...validValues, ...values })
}

describe('createDropFormSchema', () => {
  it('accepts the defaults', () => {
    expect(parseForm({}).success).toBe(true)
  })

  it.each(['1', '10', String(DROP_MAX_FILES_LIMIT)])('accepts %s files', (maxFiles) => {
    expect(parseForm({ maxFiles }).success).toBe(true)
  })

  it.each(['0', '51', '-1', '1.5', 'abc', ''])('refuses %j files', (maxFiles) => {
    expect(parseForm({ maxFiles }).success).toBe(false)
  })

  it('accepts a size up to 75 GiB and refuses beyond', () => {
    expect(parseForm({ maxTotalSize: '75', maxTotalUnit: 'GiB' }).success).toBe(true)
    expect(parseForm({ maxTotalSize: '76', maxTotalUnit: 'GiB' }).success).toBe(false)
    expect(parseForm({ maxTotalSize: '76800', maxTotalUnit: 'MiB' }).success).toBe(true)
    expect(parseForm({ maxTotalSize: '76801', maxTotalUnit: 'MiB' }).success).toBe(false)
  })

  it('refuses an empty or zero size', () => {
    expect(parseForm({ maxTotalSize: '0' }).success).toBe(false)
    expect(parseForm({ maxTotalSize: '' }).success).toBe(false)
  })

  it('accepts a 120 character title and refuses 121', () => {
    expect(parseForm({ title: 'a'.repeat(DROP_TITLE_MAX_LENGTH) }).success).toBe(true)
    expect(parseForm({ title: 'a'.repeat(DROP_TITLE_MAX_LENGTH + 1) }).success).toBe(false)
  })
})

describe('dropFormDefaults', () => {
  it('proposes an expiry in 7 days on creation', () => {
    const now = new Date('2026-11-10T10:00:00')

    const values = dropFormDefaults(undefined, now)

    expect(values.expiresAt).toBe(toDateTimeLocal(new Date('2026-11-17T10:00:00').toISOString()))
    expect(values.maxFiles).toBe('10')
    expect(values.maxTotalSize).toBe('1')
    expect(values.maxTotalUnit).toBe('GiB')
  })

  it('derives the size from the drop, in GiB when it divides evenly and MiB otherwise', () => {
    expect(dropFormDefaults(drop)).toMatchObject({ maxTotalSize: '2', maxTotalUnit: 'GiB' })
    expect(dropFormDefaults({ ...drop, maxTotalBytes: 1024 ** 2 * 5 })).toMatchObject({
      maxTotalSize: '5',
      maxTotalUnit: 'MiB',
    })
    expect(dropFormDefaults({ ...drop, maxTotalBytes: 1024 ** 2 + 1 })).toMatchObject({
      maxTotalSize: '2',
      maxTotalUnit: 'MiB',
    })
  })
})

describe('payloads', () => {
  it('builds a creation payload without the empty optional fields', () => {
    expect(toCreateDropPayload({ ...validValues, maxFiles: '3', maxTotalSize: '2' })).toEqual({
      maxFiles: 3,
      maxTotalBytes: 2 * GIB,
    })
  })

  it('includes title, slug and expiry when filled', () => {
    const payload = toCreateDropPayload({
      ...validValues,
      title: 'Docs',
      slug: 'docs',
      expiresAt: '2099-01-01T10:00',
    })

    expect(payload).toMatchObject({ title: 'Docs', slug: 'docs', expiresAt: new Date('2099-01-01T10:00').toISOString() })
  })

  it('sends nothing when nothing changed', () => {
    expect(toUpdateDropPayload(drop, dropFormDefaults(drop))).toEqual({})
  })

  it('sends only the changed fields', () => {
    const values = { ...dropFormDefaults(drop), maxFiles: '8', maxTotalSize: '1024', maxTotalUnit: 'MiB' as const }

    expect(toUpdateDropPayload(drop, values)).toEqual({ maxFiles: 8, maxTotalBytes: 1024 ** 3 })
  })

  it('sends null when the title or the expiry is cleared', () => {
    const values = { ...dropFormDefaults(drop), title: '', expiresAt: '' }

    expect(toUpdateDropPayload(drop, values)).toEqual({ title: null, expiresAt: null })
  })
})
