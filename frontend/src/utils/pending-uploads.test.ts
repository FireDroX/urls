import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetShareUploads,
  forgetUpload,
  isSameFile,
  recallUpload,
  rememberUpload,
  type PendingUpload,
} from './pending-uploads'

const upload: PendingUpload = {
  shareId: 'photos',
  fileId: 'file1234',
  name: 'video.mp4',
  size: 3,
  lastModified: 1000,
  sha256: 'ab'.repeat(32),
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('pending uploads', () => {
  it('remembers metadata only, and finds it back by file id', () => {
    rememberUpload(upload)

    expect(recallUpload('file1234')).toEqual(upload)
    expect(recallUpload('unknown1')).toBeUndefined()
  })

  it('keeps the upload token of an upload', () => {
    rememberUpload({ ...upload, uploadToken: 'token-123' })

    expect(recallUpload('file1234')?.uploadToken).toBe('token-123')
  })

  it('still reads an entry stored without a token', () => {
    localStorage.setItem('pending-uploads', JSON.stringify([upload]))

    expect(recallUpload('file1234')).toEqual(upload)
  })

  it('replaces the entry of a file remembered twice', () => {
    rememberUpload(upload)
    rememberUpload({ ...upload, sha256: 'cd'.repeat(32) })

    expect(recallUpload('file1234')?.sha256).toBe('cd'.repeat(32))
  })

  it('forgets one upload', () => {
    rememberUpload(upload)
    forgetUpload('file1234')

    expect(recallUpload('file1234')).toBeUndefined()
  })

  it('forgets the uploads of a share except the kept ones', () => {
    rememberUpload(upload)
    rememberUpload({ ...upload, fileId: 'file5678' })
    rememberUpload({ ...upload, shareId: 'other', fileId: 'file9012' })

    forgetShareUploads('photos', new Set(['file5678']))

    expect(recallUpload('file1234')).toBeUndefined()
    expect(recallUpload('file5678')).toBeDefined()
    expect(recallUpload('file9012')).toBeDefined()
  })

  it('ignores a corrupted storage', () => {
    localStorage.setItem('pending-uploads', '{not json')

    expect(recallUpload('file1234')).toBeUndefined()
  })

  it('keeps working when storage refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    expect(() => rememberUpload(upload)).not.toThrow()
  })
})

describe('isSameFile', () => {
  const file = new File(['abc'], 'video.mp4', { lastModified: 1000 })

  it('recognizes a file by name, size and modification date', () => {
    expect(isSameFile(upload, file)).toBe(true)
  })

  it.each([
    ['name', new File(['abc'], 'other.mp4', { lastModified: 1000 })],
    ['size', new File(['abcd'], 'video.mp4', { lastModified: 1000 })],
    ['date', new File(['abc'], 'video.mp4', { lastModified: 2000 })],
  ])('refuses a different %s', (_, other) => {
    expect(isSameFile(upload, other)).toBe(false)
  })
})
