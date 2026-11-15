import { describe, expect, it } from 'vitest'
import { insertByName } from './insert-by-name'

const names = (items: { name: string }[]) => items.map((item) => item.name)

describe('insertByName', () => {
  const items = [{ name: 'alpha' }, { name: 'Charlie' }, { name: 'echo' }]

  it('inserts in the middle', () => {
    expect(names(insertByName(items, { name: 'bravo' }))).toEqual(['alpha', 'bravo', 'Charlie', 'echo'])
  })

  it('inserts first and last', () => {
    expect(names(insertByName(items, { name: 'Aardvark' }))).toEqual(['Aardvark', 'alpha', 'Charlie', 'echo'])
    expect(names(insertByName(items, { name: 'zulu' }))).toEqual(['alpha', 'Charlie', 'echo', 'zulu'])
  })

  it('handles an empty list', () => {
    expect(names(insertByName([], { name: 'a' }))).toEqual(['a'])
  })
})
