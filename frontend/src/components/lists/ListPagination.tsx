import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'

interface ListPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function ListPagination({ page, pageSize, total, onPageChange }: ListPaginationProps) {
  const { t } = useTranslation()
  if (total === 0) return null
  const pageCount = Math.ceil(total / pageSize)

  return (
    <nav
      aria-label={t('listFilters.pagination.label')}
      className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
    >
      <p>{t('listFilters.pagination.total', { count: total })}</p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('listFilters.pagination.previous')}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span>{t('listFilters.pagination.pageOf', { page, pageCount })}</span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('listFilters.pagination.next')}
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  )
}
