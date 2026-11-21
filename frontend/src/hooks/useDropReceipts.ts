import { useCallback, useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { getDropFile, type DropFile } from '#api/public-drops'
import { FILE_STATUS_POLL_MS } from '#hooks/useShareDetail'
import type { UploadedFile } from '#lib/upload-queue'

const NOT_FOUND = 404

export interface DropReceipt {
  fileId: string
  uploadToken?: string
  name: string
  size: number
  status: Exclude<DropFile['status'], 'uploading'> | 'unavailable'
}

export function useDropReceipts(dropId: string) {
  const [receipts, setReceipts] = useState<DropReceipt[]>([])
  const receiptsRef = useRef(receipts)
  const verifying = receipts.some(({ status }) => status === 'verifying')

  useEffect(() => {
    receiptsRef.current = receipts
  })

  const add = useCallback(({ fileId, uploadToken, name, size }: UploadedFile) => {
    setReceipts((current) => [
      ...current.filter((receipt) => receipt.fileId !== fileId),
      { fileId, uploadToken, name, size, status: 'verifying' },
    ])
  }, [])

  useEffect(() => {
    if (!verifying) {
      return
    }
    let active = true
    async function poll() {
      for (const { fileId, uploadToken, status } of receiptsRef.current) {
        if (status !== 'verifying') continue
        try {
          const file = await getDropFile(dropId, { fileId, uploadToken })
          const settled = file.status
          if (active && (settled === 'ready' || settled === 'rejected')) {
            setReceipts((current) =>
              current.map((receipt) => (receipt.fileId === fileId ? { ...receipt, status: settled } : receipt)),
            )
          }
        } catch (error) {
          if (active && isAxiosError(error) && error.response?.status === NOT_FOUND) {
            setReceipts((current) =>
              current.map((receipt) => (receipt.fileId === fileId ? { ...receipt, status: 'unavailable' } : receipt)),
            )
          }
        }
      }
    }
    const timer = setInterval(() => void poll(), FILE_STATUS_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [dropId, verifying])

  return { receipts, add }
}
