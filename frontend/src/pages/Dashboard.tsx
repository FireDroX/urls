import { Link2 } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { useDocumentTitle } from '#hooks/useDocumentTitle'

const ROUTE_CODE = <code className="font-mono text-primary" />

export function Dashboard() {
  const { t } = useTranslation()
  useDocumentTitle(t('dashboard.title'))

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>
      <section
        aria-label={t('dashboard.linksRegion')}
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-muted-foreground">
          <Link2 className="size-5" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-lg font-semibold">{t('dashboard.emptyTitle')}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          <Trans i18nKey="dashboard.emptyBody" components={{ r: ROUTE_CODE, d: ROUTE_CODE, u: ROUTE_CODE }} />
        </p>
      </section>
    </>
  )
}
