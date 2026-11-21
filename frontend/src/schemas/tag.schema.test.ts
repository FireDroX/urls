import { describe, expect, it } from 'vitest'
import type { Tag } from '#api/tags'
import i18n from '#lib/i18n'
import {
  createTagFormSchema,
  DEFAULT_TAG_COLOR,
  tagFormDefaults,
  toCreateTagPayload,
  toUpdateTagPayload,
} from './tag.schema'

const schema = createTagFormSchema(i18n.t.bind(i18n))

const tag: Tag = {
  id: 'abc12345',
  name: 'Travail',
  color: '#ff8800',
  linkCount: 3,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

function parse(values: { name: string; color: string }) {
  return schema.safeParse(values)
}

describe('tag form schema', () => {
  it('starts from the default colour', () => {
    expect(tagFormDefaults()).toEqual({ name: '', color: DEFAULT_TAG_COLOR })
    expect(tagFormDefaults(tag)).toEqual({ name: 'Travail', color: '#ff8800' })
  })

  it('accepts a name of 50 characters and refuses 51', () => {
    expect(parse({ name: 'a'.repeat(50), color: DEFAULT_TAG_COLOR }).success).toBe(true)
    expect(parse({ name: 'a'.repeat(51), color: DEFAULT_TAG_COLOR }).success).toBe(false)
  })

  it('trims the name and refuses a blank one', () => {
    expect(parse({ name: '  idée  ', color: DEFAULT_TAG_COLOR })).toMatchObject({
      success: true,
      data: { name: 'idée' },
    })
    expect(parse({ name: '   ', color: DEFAULT_TAG_COLOR }).success).toBe(false)
  })

  it('refuses control characters', () => {
    expect(parse({ name: 'a\u0007b', color: DEFAULT_TAG_COLOR }).success).toBe(false)
  })

  it.each([
    ['#FF8800', true],
    ['#ff8800', true],
    ['ff8800', false],
    ['#ff880', false],
    ['#ff88000', false],
    ['#gg8800', false],
  ])('colour %s accepted: %s', (color, accepted) => {
    expect(parse({ name: 'a', color }).success).toBe(accepted)
  })

  it('lowercases the colour in the create payload', () => {
    expect(toCreateTagPayload({ name: 'a', color: '#FF8800' })).toEqual({ name: 'a', color: '#ff8800' })
  })

  it('sends only the changed fields when updating', () => {
    expect(toUpdateTagPayload(tag, { name: 'Travail', color: '#FF8800' })).toEqual({})
    expect(toUpdateTagPayload(tag, { name: 'Perso', color: '#ff8800' })).toEqual({ name: 'Perso' })
    expect(toUpdateTagPayload(tag, { name: 'Travail', color: '#00FF00' })).toEqual({ color: '#00ff00' })
  })
})
