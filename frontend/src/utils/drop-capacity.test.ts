import { describe, expect, it } from 'vitest'
import { knownFileIds, remainingRoom, selectWithinRoom, type DropRoom } from './drop-capacity'

describe('remainingRoom', () => {
  const drop = { filesRemaining: 1, bytesRemaining: 100 }

  it('does not subtract a resumed upload the server already counts, and accepts a new file', () => {
    const counted = knownFileIds([{ fileId: 'resumed' }], [{ fileId: 'resumed' }])
    const room = remainingRoom(drop, [{ fileId: 'resumed', size: 60 }], counted)

    expect(room).toEqual({ filesRemaining: 1, bytesRemaining: 100 })
    const { accepted } = selectWithinRoom([new File([new Uint8Array(50)], 'new')], {
      closed: false,
      maxFileSize: 100,
      ...room,
    })
    expect(accepted).toHaveLength(1)
  })

  it('subtracts uploads not announced yet and uploads announced after the preview', () => {
    const room = remainingRoom(
      { filesRemaining: 3, bytesRemaining: 100 },
      [
        { fileId: null, size: 10 },
        { fileId: 'later', size: 20 },
        { fileId: 'known', size: 40 },
      ],
      new Set(['known']),
    )

    expect(room).toEqual({ filesRemaining: 1, bytesRemaining: 70 })
  })

  it('never goes below zero', () => {
    expect(remainingRoom(drop, [{ fileId: null, size: 500 }, { fileId: null, size: 1 }], new Set())).toEqual({
      filesRemaining: 0,
      bytesRemaining: 0,
    })
  })
})

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
