import { useTranslation } from 'react-i18next'
import type { FilesSummary } from '#api/files'
import { useFileSize } from '#hooks/useFileSize'

function percentOf(part: number, total: number): number {
  return total > 0 ? Math.min(100, (part / total) * 100) : 0
}

export function FilesUsage({ summary }: { summary: FilesSummary }) {
  const { t } = useTranslation()
  const formatSize = useFileSize()
  const { quotaUsedBytes, quotaLimitBytes, orphanBytes, storageUsedBytes } = summary
  const usedPercent = percentOf(quotaUsedBytes, quotaLimitBytes)
  const orphanShare = percentOf(orphanBytes, quotaUsedBytes)

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label={t('files.usage.title')}>
      <div
        className="h-2 rounded-full bg-accent"
        role="progressbar"
        aria-label={t('files.usage.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(usedPercent)}
      >
        <div className="relative h-2 overflow-hidden rounded-full bg-primary" style={{ width: `${usedPercent}%` }}>
          <div className="absolute inset-y-0 right-0 bg-destructive" style={{ width: `${orphanShare}%` }} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{t('files.usage.used', { used: formatSize(quotaUsedBytes), total: formatSize(quotaLimitBytes) })}</span>
        <span>{t('files.usage.orphans', { size: formatSize(orphanBytes) })}</span>
        <span>
          {storageUsedBytes === null
            ? t('files.usage.storageUnavailable')
            : t('files.usage.storage', { size: formatSize(storageUsedBytes) })}
        </span>
      </div>
    </section>
  )
}
