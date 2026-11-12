export type RefusalReason = 'tooLarge' | 'noRoom' | 'closed'

export interface RefusedFile {
  id: number
  name: string
  reason: RefusalReason
}

export interface DropRoom {
  closed: boolean
  maxFileSize: number
  filesRemaining: number
  bytesRemaining: number
}

export interface FileSelection {
  accepted: File[]
  refused: Omit<RefusedFile, 'id'>[]
}

function refusalOf(file: File, room: DropRoom, filesLeft: number, bytesLeft: number): RefusalReason | null {
  if (room.closed) return 'closed'
  if (file.size > room.maxFileSize) return 'tooLarge'
  if (filesLeft < 1 || file.size > bytesLeft) return 'noRoom'
  return null
}

export function selectWithinRoom(files: readonly File[], room: DropRoom): FileSelection {
  const selection: FileSelection = { accepted: [], refused: [] }
  let filesLeft = room.filesRemaining
  let bytesLeft = room.bytesRemaining
  for (const file of files) {
    const reason = refusalOf(file, room, filesLeft, bytesLeft)
    if (reason) {
      selection.refused.push({ name: file.name, reason })
    } else {
      selection.accepted.push(file)
      filesLeft -= 1
      bytesLeft -= file.size
    }
  }
  return selection
}
