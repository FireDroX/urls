import { useTranslation } from 'react-i18next'
import { useFileSize } from '#hooks/useFileSize'
import { useStorageUsage } from '#hooks/useStorageUsage'

export function StorageMeter() {
  const { t } = useTranslation()
  const formatSize = useFileSize()
  const state = useStorageUsage()

  if (state.status === 'loading') {
    return <MeterFrame label="…" percent={0} />
  }
  if (state.status === 'error') {
    return <MeterFrame label={t('layout.storageUnavailable')} percent={0} />
  }

  const { usedBytes, quotaBytes } = state.usage
  const used = usedBytes ?? 0
  const label = quotaBytes ? `${formatSize(used)} / ${formatSize(quotaBytes)}` : formatSize(used)
  const percent = quotaBytes ? Math.min(100, (used / quotaBytes) * 100) : 0
  return <MeterFrame label={label} percent={percent} />
}

function MeterFrame({ label, percent }: { label: string; percent: number }) {
  const { t } = useTranslation()

  return (
    <div className="border-t border-sidebar-border px-2.5 pt-3 pb-1">
      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
        <span>{t('layout.storage')}</span>
        <span>{label}</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-accent"
        role="progressbar"
        aria-label={t('layout.storageUsed')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className="h-1.5 rounded-full bg-sidebar-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
