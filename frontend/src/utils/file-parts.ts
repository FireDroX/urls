export interface FilePart {
  partNumber: number
  start: number
  end: number
}

export interface PartSize {
  partNumber: number
  size: number
}

export function partSizeOf({ start, end }: FilePart): number {
  return end - start
}

export function splitIntoParts(fileSize: number, partSize: number): FilePart[] {
  return Array.from({ length: Math.ceil(fileSize / partSize) }, (_, index) => ({
    partNumber: index + 1,
    start: index * partSize,
    end: Math.min((index + 1) * partSize, fileSize),
  }))
}

export function missingParts(fileSize: number, partSize: number, received: readonly PartSize[]): FilePart[] {
  const receivedSizes = new Map(received.map((part) => [part.partNumber, part.size]))
  return splitIntoParts(fileSize, partSize).filter((part) => receivedSizes.get(part.partNumber) !== partSizeOf(part))
}
