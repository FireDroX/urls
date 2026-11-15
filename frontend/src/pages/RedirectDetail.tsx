import { useMemo } from 'react'
import { ArrowLeft, ChartColumn, Copy, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useParams, useSearchParams } from 'react-router'
import { redirectPath } from '#api/redirects'
import type { Link, LinkStats } from '#api/links'
import { ClicksChart } from '#components/links/ClicksChart'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { LinkOrganizationSummary } from '#components/links/LinkOrganizationSummary'
import { LinkStateBadge } from '#components/links/LinkStateBadge'
import { TopClicksList, type TopClicksEntry } from '#components/links/TopClicksList'
import { Button } from '#components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useLink, useLinkStats, type LoadState } from '#hooks/useLinkDetail'
import { LINK_STATS_DAY_OPTIONS, parseStatsDays } from '#utils/link-stats'

const DAYS_PARAM = 'days'

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()

  return (
    <LinksPlaceholder
      title={t('linkStats.loadFailedTitle')}
      body={t('links.loadFailedBody')}
      action={
        <Button variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  )
}

function NotFoundPlaceholder() {
  const { t } = useTranslation()

  return (
    <LinksPlaceholder
      icon={SearchX}
      title={t('linkStats.notFoundTitle')}
      body={t('links.errors.notFound')}
      action={
        <Button variant="outline" asChild>
          <RouterLink to="/redirects">{t('linkStats.backToList')}</RouterLink>
        </Button>
      }
    />
  )
}

function LinkHeader({ link }: { link: Link }) {
  const { t } = useTranslation()
  const copyLink = useCopyLink()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-2xl font-bold text-primary">{redirectPath(link.id)}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('links.copy', { slug: link.id })}
          onClick={() => void copyLink(link.id)}
        >
          <Copy />
        </Button>
        <LinkStateBadge link={link} />
      </div>
      <LinkOrganizationSummary tags={link.tags} folder={link.folder} />
      <p className="text-sm text-muted-foreground">
        {t('linkStats.destination')}{' '}
        <a
          href={link.destination ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-foreground underline-offset-4 hover:underline"
        >
          {link.destination}
        </a>
      </p>
    </div>
  )
}

function DaysSelect({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  const { t } = useTranslation()

  return (
    <Select value={String(days)} onValueChange={(value) => onChange(Number(value))}>
      <SelectTrigger className="w-44" aria-label={t('linkStats.period')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LINK_STATS_DAY_OPTIONS.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {t('linkStats.lastDays', { count: option })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function useTopEntries(stats: LinkStats): { referers: TopClicksEntry[]; countries: TopClicksEntry[] } {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const regions = new Intl.DisplayNames([i18n.language], { type: 'region' })
    return {
      referers: stats.referers.map(({ host, clicks }) => ({
        key: host ?? '',
        label: host ?? t('linkStats.direct'),
        clicks,
      })),
      countries: stats.countries.map(({ country, clicks }) => ({
        key: country ?? '',
        label: country ? (regions.of(country) ?? country) : t('linkStats.unknownCountry'),
        clicks,
      })),
    }
  }, [stats, t, i18n.language])
}

function StatsContent({ stats }: { stats: LinkStats }) {
  const { t } = useTranslation()
  const { referers, countries } = useTopEntries(stats)

  if (stats.total === 0) {
    return <LinksPlaceholder icon={ChartColumn} title={t('linkStats.emptyTitle')} body={t('linkStats.emptyBody')} />
  }
  return (
    <>
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          <span className="block font-heading text-3xl font-bold text-foreground tabular-nums">{stats.total}</span>
          {t('linkStats.totalLabel', { count: stats.total, days: stats.days })}
        </p>
        <ClicksChart daily={stats.daily} />
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <TopClicksList title={t('linkStats.topSources')} entries={referers} total={stats.total} />
        <TopClicksList title={t('linkStats.topCountries')} entries={countries} total={stats.total} />
      </div>
    </>
  )
}

function StatsSection({ id, days, onDaysChange }: { id: string; days: number; onDaysChange: (days: number) => void }) {
  const { t } = useTranslation()
  const { state, reload } = useLinkStats(id, days)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="link-stats-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="link-stats-title" className="font-heading text-xl font-semibold">
            {t('linkStats.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('linkStats.timeZoneNote')}</p>
        </div>
        <DaysSelect days={days} onChange={onDaysChange} />
      </div>
      <StatsBody state={state} onRetry={reload} />
    </section>
  )
}

function StatsBody({ state, onRetry }: { state: LoadState<LinkStats>; onRetry: () => void }) {
  if (state.status === 'loading') {
    return <Skeleton className="h-72 w-full" aria-busy="true" />
  }
  if (state.status === 'ready') {
    return <StatsContent stats={state.value} />
  }
  return <LoadFailed onRetry={onRetry} />
}

export function RedirectDetail() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const days = parseStatsDays(searchParams.get(DAYS_PARAM))
  const { state, reload } = useLink(id)
  useDocumentTitle(redirectPath(id))

  function changeDays(value: number) {
    setSearchParams({ [DAYS_PARAM]: String(value) }, { replace: true })
  }

  return (
    <>
      <RouterLink
        to="/redirects"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('linkStats.backToList')}
      </RouterLink>
      {state.status === 'loading' && <Skeleton className="h-16 w-full max-w-lg" aria-busy="true" />}
      {state.status === 'notFound' && <NotFoundPlaceholder />}
      {state.status === 'error' && <LoadFailed onRetry={reload} />}
      {state.status === 'ready' && (
        <>
          <LinkHeader link={state.value} />
          <StatsSection id={state.value.id} days={days} onDaysChange={changeDays} />
        </>
      )}
    </>
  )
}
