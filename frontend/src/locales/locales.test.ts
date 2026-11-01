import { describe, expect, it } from 'vitest'
import en from './en.json'
import fr from './fr.json'

function keysOf(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
}

describe('locales', () => {
  it('have the same keys in French and English', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort())
  })
})
