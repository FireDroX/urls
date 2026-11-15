import { describe, expect, it } from 'vitest'
import i18n from '#lib/i18n'
import { createFolderFormSchema, folderFormDefaults, toFolderPayload } from './folder.schema'

const schema = createFolderFormSchema(i18n.t.bind(i18n))

describe('folder form schema', () => {
  it('accepts a name of 100 characters and refuses 101', () => {
    expect(schema.safeParse({ name: 'a'.repeat(100) }).success).toBe(true)
    expect(schema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false)
  })

  it('trims the name and refuses a blank one', () => {
    expect(schema.safeParse({ name: '  Projets  ' })).toMatchObject({ success: true, data: { name: 'Projets' } })
    expect(schema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('refuses control characters', () => {
    expect(schema.safeParse({ name: 'a\nb' }).success).toBe(false)
  })

  it('builds defaults and payload', () => {
    expect(folderFormDefaults()).toEqual({ name: '' })
    expect(toFolderPayload({ name: 'Projets' })).toEqual({ name: 'Projets' })
  })
})
