import { describe, expect, it } from 'vitest'
import { missingParts, partSizeOf, splitIntoParts } from './file-parts'

const MIB = 1024 ** 2
const PART_SIZE = 32 * MIB

describe('splitIntoParts', () => {
  it('cuts a file into full parts and a shorter last part', () => {
    expect(splitIntoParts(25, 10)).toEqual([
      { partNumber: 1, start: 0, end: 10 },
      { partNumber: 2, start: 10, end: 20 },
      { partNumber: 3, start: 20, end: 25 },
    ])
  })

  it('gives a single part to a file smaller than a part', () => {
    expect(splitIntoParts(5, 10)).toEqual([{ partNumber: 1, start: 0, end: 5 }])
  })

  it('has no empty last part when the size is an exact multiple', () => {
    expect(splitIntoParts(20, 10).map(partSizeOf)).toEqual([10, 10])
  })

  it('covers a 20 GiB file with 32 MiB parts, each under the 100 MB tunnel limit', () => {
    const fileSize = 20 * 1024 * MIB
    const parts = splitIntoParts(fileSize, PART_SIZE)

    expect(parts).toHaveLength(640)
    expect(parts.at(-1)?.end).toBe(fileSize)
    expect(Math.max(...parts.map(partSizeOf))).toBe(PART_SIZE)
  })
})

describe('missingParts', () => {
  it('keeps every part when nothing was received', () => {
    expect(missingParts(25, 10, []).map((part) => part.partNumber)).toEqual([1, 2, 3])
  })

  it('keeps only the parts that did not arrive', () => {
    const received = [
      { partNumber: 1, size: 10 },
      { partNumber: 3, size: 5 },
    ]

    expect(missingParts(25, 10, received)).toEqual([{ partNumber: 2, start: 10, end: 20 }])
  })

  it('keeps a part received with the wrong size', () => {
    const received = [
      { partNumber: 1, size: 10 },
      { partNumber: 2, size: 7 },
      { partNumber: 3, size: 5 },
    ]

    expect(missingParts(25, 10, received).map((part) => part.partNumber)).toEqual([2])
  })

  it('is empty when every part arrived', () => {
    const received = [
      { partNumber: 1, size: 10 },
      { partNumber: 2, size: 10 },
    ]

    expect(missingParts(20, 10, received)).toEqual([])
  })
})
