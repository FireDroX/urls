import { describe, expect, it } from 'vitest'
import { selectWithinRoom, type DropRoom } from './drop-capacity'

const room: DropRoom = { closed: false, maxFileSize: 100, filesRemaining: 2, bytesRemaining: 150 }

function file(name: string, size: number): File {
  return new File([new Uint8Array(size)], name)
}

describe('selectWithinRoom', () => {
  it('accepts files that fit and consumes the room as it goes', () => {
    const { accepted, refused } = selectWithinRoom([file('a', 80), file('b', 80), file('c', 1)], room)

    expect(accepted.map(({ name }) => name)).toEqual(['a', 'c'])
    expect(refused).toEqual([{ name: 'b', reason: 'noRoom' }])
  })

  it('refuses a file once no file slot is left', () => {
    const { accepted, refused } = selectWithinRoom([file('a', 1), file('b', 1), file('c', 1)], room)

    expect(accepted).toHaveLength(2)
    expect(refused).toEqual([{ name: 'c', reason: 'noRoom' }])
  })

  it('refuses a file larger than the maximum file size', () => {
    expect(selectWithinRoom([file('big', 101)], room).refused).toEqual([{ name: 'big', reason: 'tooLarge' }])
  })

  it('refuses everything once the drop is closed', () => {
    expect(selectWithinRoom([file('a', 1)], { ...room, closed: true }).refused).toEqual([
      { name: 'a', reason: 'closed' },
    ])
  })
})
