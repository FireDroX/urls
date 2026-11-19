import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import type { LinkType } from '#api/list-params'

const SECTIONS = {
  redirect: { to: '/redirects', labelKey: 'layout.redirects' },
  share: { to: '/shares', labelKey: 'layout.shares' },
  drop: { to: '/drops', labelKey: 'layout.drops' },
} as const satisfies Record<LinkType, { to: string; labelKey: string }>

export function DetailBreadcrumb({ type, current }: { type: LinkType; current?: string }) {
  const { t } = useTranslation()
  const section = SECTIONS[type]
  const linkClass = 'hover:text-foreground hover:underline'

  return (
    <nav aria-label={t('detail.breadcrumb')} className="text-[13px] text-muted-foreground">
      <RouterLink to="/" className={linkClass}>
        {t('layout.allLinks')}
      </RouterLink>
      {' / '}
      <RouterLink to={section.to} className={linkClass}>
        {t(section.labelKey)}
      </RouterLink>
      {current && (
        <>
          {' / '}
          <span className="text-foreground">{current}</span>
        </>
      )}
    </nav>
  )
}
