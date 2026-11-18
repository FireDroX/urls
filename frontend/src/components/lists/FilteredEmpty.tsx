import { SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { Button } from '#components/ui/button'

export function FilteredEmpty({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation()

  return (
    <LinksPlaceholder
      icon={SearchX}
      title={t('listFilters.emptyTitle')}
      body={t('listFilters.emptyBody')}
      action={
        <Button variant="outline" onClick={onClear}>
          {t('listFilters.clear')}
        </Button>
      }
    />
  )
}
