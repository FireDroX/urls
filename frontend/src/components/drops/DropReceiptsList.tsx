import { useTranslation } from 'react-i18next'
import { FileIcon } from 'lucide-react'
import { StatusBadge, type StatusTone } from '#components/StatusBadge'
import type { DropReceipt } from '#hooks/useDropReceipts'
import { useFileSize } from '#hooks/useFileSize'

const STATUS_VARIANTS = {
  verifying: 'outline',
  ready: 'success',
  rejected: 'danger',
  unavailable: 'neutral',
} as const satisfies Record<string, StatusTone>

export function DropReceiptsList({ receipts }: { receipts: DropReceipt[] }) {
  const { t } = useTranslation()
  const formatSize = useFileSize()

  if (receipts.length === 0) {
    return null
  }
  return (
    <section className="flex flex-col gap-2" aria-labelledby="drop-receipts-title">
      <h2 id="drop-receipts-title" className="text-sm font-semibold">
        {t('dropUpload.receipts.title')}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {receipts.map(({ fileId, name, size, status }) => (
          <li key={fileId} className="flex items-center gap-2.5 rounded-lg border p-3 text-sm">
            <FileIcon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate" title={name}>
              {name}
            </span>
            <span className="text-[13px] text-muted-foreground">{formatSize(size)}</span>
            <StatusBadge tone={STATUS_VARIANTS[status]}>{t(`dropUpload.receipts.${status}`)}</StatusBadge>
          </li>
        ))}
      </ul>
    </section>
  )
}
