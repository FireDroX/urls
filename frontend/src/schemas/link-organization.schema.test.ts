import { describe, expect, it } from 'vitest'
import i18n from '#lib/i18n'
import { z } from 'zod'
import {
  LINK_TAGS_MAX,
  linkOrganizationDefaults,
  linkOrganizationFields,
  toCreateOrganizationPayload,
  toggleTagId,
  toUpdateOrganizationPayload,
} from './link-organization.schema'

const t = i18n.t.bind(i18n)

const organization = {
  tags: [
    { id: 'a', name: 'A', color: '#ff0000' },
    { id: 'b', name: 'B', color: '#00ff00' },
  ],
  folder: { id: 'f1', name: 'Work' },
}

describe('linkOrganizationDefaults', () => {
  it('is empty without a link', () => {
    expect(linkOrganizationDefaults()).toEqual({ tagIds: [], folderId: null })
  })

  it('reads the ids of the link', () => {
    expect(linkOrganizationDefaults(organization)).toEqual({ tagIds: ['a', 'b'], folderId: 'f1' })
  })
})

describe('toCreateOrganizationPayload', () => {
  it('leaves out empty values', () => {
    expect(toCreateOrganizationPayload({ tagIds: [], folderId: null })).toEqual({})
  })

  it('sends the chosen tags and folder', () => {
    expect(toCreateOrganizationPayload({ tagIds: ['a'], folderId: 'f1' })).toEqual({ tagIds: ['a'], folderId: 'f1' })
  })
})

describe('toUpdateOrganizationPayload', () => {
  it('sends nothing when the same tags come in another order', () => {
    expect(toUpdateOrganizationPayload(organization, { tagIds: ['b', 'a'], folderId: 'f1' })).toEqual({})
  })

  it('sends tagIds only when the tags changed', () => {
    expect(toUpdateOrganizationPayload(organization, { tagIds: ['a'], folderId: 'f1' })).toEqual({ tagIds: ['a'] })
  })

  it('sends folderId only when the folder changed, null to leave it', () => {
    expect(toUpdateOrganizationPayload(organization, { tagIds: ['a', 'b'], folderId: 'f2' })).toEqual({ folderId: 'f2' })
    expect(toUpdateOrganizationPayload(organization, { tagIds: ['a', 'b'], folderId: null })).toEqual({ folderId: null })
  })
})

describe('toggleTagId', () => {
  it('adds and removes an id', () => {
    expect(toggleTagId(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleTagId(['a', 'b'], 'a', false)).toEqual(['b'])
  })

  it('refuses a tag beyond the maximum', () => {
    const full = Array.from({ length: LINK_TAGS_MAX }, (_, index) => `t${index}`)

    expect(toggleTagId(full, 'extra', true)).toEqual(full)
  })
})

describe('linkOrganizationFields', () => {
  const schema = z.object(linkOrganizationFields(t))

  it('rejects more than the maximum number of tags', () => {
    const tagIds = Array.from({ length: LINK_TAGS_MAX + 1 }, (_, index) => `t${index}`)

    expect(schema.safeParse({ tagIds, folderId: null }).success).toBe(false)
    expect(schema.safeParse({ tagIds: tagIds.slice(1), folderId: null }).success).toBe(true)
  })
})
