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

export interface ActiveUpload {
  fileId: string | null
  size: number
}

export interface RemainingRoom {
  filesRemaining: number
  bytesRemaining: number
}

export function knownFileIds(
  items: readonly Pick<ActiveUpload, 'fileId'>[],
  pending: readonly { fileId: string }[],
): Set<string> {
  const ids = new Set(pending.map(({ fileId }) => fileId))
  for (const { fileId } of items) {
    if (fileId !== null) ids.add(fileId)
  }
  return ids
}

export function remainingRoom(
  drop: RemainingRoom,
  active: readonly ActiveUpload[],
  countedFileIds: ReadonlySet<string>,
): RemainingRoom {
  const uncounted = active.filter(({ fileId }) => fileId === null || !countedFileIds.has(fileId))
  const uncountedBytes = uncounted.reduce((total, { size }) => total + size, 0)
  return {
    filesRemaining: Math.max(0, drop.filesRemaining - uncounted.length),
    bytesRemaining: Math.max(0, drop.bytesRemaining - uncountedBytes),
  }
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
