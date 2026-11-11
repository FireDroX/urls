import { useTranslation } from 'react-i18next'
import { Badge } from '#components/ui/badge'
import type { DropReceipt } from '#hooks/useDropReceipts'
import { useFileSize } from '#hooks/useFileSize'

const STATUS_VARIANTS = {
  verifying: 'secondary',
  ready: 'default',
  rejected: 'destructive',
} as const

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
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {receipts.map(({ fileId, name, size, status }) => (
          <li key={fileId} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={name}>
                {name}
              </p>
              <p className="text-xs text-muted-foreground">{formatSize(size)}</p>
            </div>
            <Badge variant={STATUS_VARIANTS[status]}>{t(`dropUpload.receipts.${status}`)}</Badge>
          </li>
        ))}
      </ul>
    </section>
  )
}
