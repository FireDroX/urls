import { useTranslation } from 'react-i18next'
import type { PublicDrop } from '#api/public-drops'
import { useFileSize } from '#hooks/useFileSize'
import { formatRelativeTime } from '#utils/relative-time'

function LimitTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 basis-[120px] flex-col gap-0.5 rounded-[8px] bg-state-neutral-bg px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

export function DropHeader({ drop }: { drop: PublicDrop }) {
  const { t, i18n } = useTranslation()
  const formatSize = useFileSize()
  const closes = drop.expiresAt
    ? formatRelativeTime(new Date(drop.expiresAt), new Date(), i18n.language)
    : t('dropUpload.noExpiry')

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold">{drop.title ?? t('dropUpload.untitled')}</h1>
        <p className="text-sm text-muted-foreground">{t('dropUpload.subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <LimitTile
          label={t('dropUpload.limits.files')}
          value={`${drop.maxFiles - drop.filesRemaining} / ${drop.maxFiles}`}
        />
        <LimitTile
          label={t('dropUpload.limits.size')}
          value={`${formatSize(drop.maxTotalBytes - drop.bytesRemaining)} / ${formatSize(drop.maxTotalBytes)}`}
        />
        <LimitTile label={t('dropUpload.limits.closes')} value={closes} />
      </div>
    </>
  )
}
