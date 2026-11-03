import { useTranslation } from 'react-i18next'

export interface TopClicksEntry {
  key: string
  label: string
  clicks: number
}

interface TopClicksListProps {
  title: string
  entries: TopClicksEntry[]
  total: number
}

function share(clicks: number, total: number): number {
  return total > 0 ? (clicks / total) * 100 : 0
}

export function TopClicksList({ title, entries, total }: TopClicksListProps) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <ol className="flex flex-col gap-2.5">
        {entries.map((entry) => (
          <li key={entry.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate" title={entry.label}>
                {entry.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {t('linkStats.clicksCount', { count: entry.clicks })}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
              <div className="h-full rounded-full bg-primary" style={{ width: `${share(entry.clicks, total)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
