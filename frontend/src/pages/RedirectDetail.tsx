import { useMemo, useState } from 'react'
import { ChartColumn, Pencil, RefreshCw, Power, PowerOff, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { redirectPath } from '#api/redirects'
import { checkLink, getLink, linkUrl, updateLink, type Link, type LinkStats } from '#api/links'
import { DeleteLinkButton } from '#components/DeleteLinkButton'
import { DetailBreadcrumb } from '#components/DetailBreadcrumb'
import { DetailUrl } from '#components/DetailUrl'
import { LinkTypeBadge } from '#components/dashboard/LinkTypeBadge'
import { DeleteLinkDialog } from '#components/links/DeleteLinkDialog'
import { LinkFormDialog } from '#components/links/LinkFormDialog'
import { ClicksChart } from '#components/links/ClicksChart'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { LinkOrganizationSummary } from '#components/links/LinkOrganizationSummary'
import { TagPill } from '#components/links/TagPill'
import { LinkHealthBadge } from '#components/links/LinkHealthBadge'
import { LinkStateBadge } from '#components/links/LinkStateBadge'
import { TopClicksList, type TopClicksEntry } from '#components/links/TopClicksList'
import { Button } from '#components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useLastCheckDetails } from '#hooks/useLastCheckDetails'
import { useLink, useLinkStats, type LoadState } from '#hooks/useLinkDetail'
import { extractErrorMessage } from '#lib/api-errors'
import { linkErrorMessages } from '#lib/link-errors'
import { refreshLinkHealth } from '#lib/link-health-refresh'
import { LINK_STATS_DAY_OPTIONS, linkDetailPath, parseStatsDays } from '#utils/link-stats'

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

function LinkHeader({
  link,
  onEdit,
  onToggle,
  onDelete,
}: {
  link: Link
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const copyLink = useCopyLink()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1>{redirectPath(link.id)}</h1>
          <LinkTypeBadge type="redirect" />
          <LinkStateBadge link={link} />
          <LinkHealthBadge lastCheck={link.lastCheck} />
        </div>
        <DetailUrl url={linkUrl(link.id)} slug={link.id} onCopy={() => void copyLink(link.id)} />
        <LinkOrganizationSummary tags={link.tags} folder={link.folder} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEdit}>
          <Pencil />
          {t('links.edit')}
        </Button>
        <Button variant="outline" onClick={onToggle}>
          {link.disabled ? <Power /> : <PowerOff />}
          {link.disabled ? t('links.enable') : t('links.disable')}
        </Button>
        <DeleteLinkButton onClick={onDelete} />
      </div>
    </div>
  )
}

function SettingsSection({ link }: { link: Link }) {
  const { t, i18n } = useTranslation()
  const expiresAt = link.expiresAt
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(link.expiresAt),
      )
    : t('links.noExpiry')

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-5" aria-labelledby="link-settings-title">
      <h2 id="link-settings-title">
        {t('links.detail.settings')}
      </h2>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{t('links.columns.destination')}</dt>
        <dd>
          <a
            href={link.destination ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-foreground underline-offset-4 hover:underline"
          >
            {link.destination}
          </a>
        </dd>
        <dt className="text-muted-foreground">{t('links.form.slug')}</dt>
        <dd className="font-mono">{link.id}</dd>
        <dt className="text-muted-foreground">{t('links.columns.expiresAt')}</dt>
        <dd>{expiresAt}</dd>
        <dt className="text-muted-foreground">{t('linkOrganization.tags')}</dt>
        <dd>
          {link.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {link.tags.map((tag) => (
                <li key={tag.id}>
                  <TagPill tag={tag} />
                </li>
              ))}
            </ul>
          ) : (
            t('linkOrganization.tagsPlaceholder')
          )}
        </dd>
        <dt className="text-muted-foreground">{t('linkOrganization.folder')}</dt>
        <dd>{link.folder?.name ?? t('linkOrganization.noFolder')}</dd>
      </dl>
    </section>
  )
}

function CheckSection({ link, onChanged }: { link: Link; onChanged: (link: Link) => void }) {
  const { t } = useTranslation()
  const details = useLastCheckDetails(link.lastCheck)
  const [checking, setChecking] = useState(false)

  async function runCheck() {
    setChecking(true)
    try {
      await checkLink(link.id)
      onChanged(await getLink(link.id))
      refreshLinkHealth()
      toast.success(t('links.health.checked'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('links.health.checkFailed'), linkErrorMessages(t)))
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-5" aria-labelledby="link-check-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="link-check-title">
          {t('links.health.title')}
        </h2>
        <Button variant="outline" disabled={checking} onClick={() => void runCheck()}>
          <RefreshCw />
          {checking ? t('links.health.checking') : t('links.health.check')}
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{t('links.health.result')}</dt>
        <dd>{details.result}</dd>
        {link.lastCheck && (
          <>
            <dt className="text-muted-foreground">{t('links.health.code')}</dt>
            <dd>{details.code}</dd>
            <dt className="text-muted-foreground">{t('links.health.checkedAt')}</dt>
            <dd title={details.fullDate ?? undefined}>{details.relativeDate}</dd>
          </>
        )}
      </dl>
    </section>
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
      <section className="flex flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
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
          <h2 id="link-stats-title">
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

function LinkDetailContent({
  link,
  days,
  onDaysChange,
  onChanged,
}: {
  link: Link
  days: number
  onDaysChange: (days: number) => void
  onChanged: (link: Link) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)

  function handleSaved(saved: Link) {
    setDialog(null)
    toast.success(t('links.updated'))
    if (saved.id !== link.id) {
      void navigate({ pathname: linkDetailPath(saved.id), search: location.search }, { replace: true })
      return
    }
    onChanged(saved)
    refreshLinkHealth()
  }

  function handleDeleted() {
    refreshLinkHealth()
    toast.success(t('links.deleted'))
    void navigate('/redirects', { replace: true })
  }

  async function toggleLink() {
    try {
      const saved = await updateLink(link.id, { disabled: !link.disabled })
      onChanged(saved)
      refreshLinkHealth()
      toast.success(saved.disabled ? t('links.disabledToast') : t('links.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, linkErrorMessages(t)))
    }
  }

  return (
    <>
      <LinkHeader
        link={link}
        onEdit={() => setDialog('edit')}
        onToggle={() => void toggleLink()}
        onDelete={() => setDialog('delete')}
      />
      <SettingsSection link={link} />
      <CheckSection link={link} onChanged={onChanged} />
      <StatsSection id={link.id} days={days} onDaysChange={onDaysChange} />
      <LinkFormDialog
        open={dialog === 'edit'}
        link={link}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={handleSaved}
      />
      <DeleteLinkDialog
        open={dialog === 'delete'}
        link={link}
        onOpenChange={(open) => !open && setDialog(null)}
        onDeleted={handleDeleted}
      />
    </>
  )
}

export function RedirectDetail() {
  const { id = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const days = parseStatsDays(searchParams.get(DAYS_PARAM))
  const { state, reload, replace } = useLink(id)
  useDocumentTitle(redirectPath(id))

  function changeDays(value: number) {
    setSearchParams({ [DAYS_PARAM]: String(value) }, { replace: true })
  }

  return (
    <div data-density="detail" className="contents">
      <DetailBreadcrumb type="redirect" current={id} />
      {state.status === 'loading' && <Skeleton className="h-16 w-full max-w-lg" aria-busy="true" />}
      {state.status === 'notFound' && <NotFoundPlaceholder />}
      {state.status === 'error' && <LoadFailed onRetry={reload} />}
      {state.status === 'ready' && (
        <LinkDetailContent link={state.value} days={days} onDaysChange={changeDays} onChanged={replace} />
      )}
    </div>
  )
}
