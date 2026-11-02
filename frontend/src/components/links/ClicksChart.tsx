import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { DailyClicks } from '#api/links'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '#components/ui/chart'
import { utcDayToDate } from '#utils/link-stats'

const BAR_RADIUS = 4
const Y_AXIS_WIDTH = 32
const TICK_MIN_GAP = 16

export function ClicksChart({ daily }: { daily: DailyClicks[] }) {
  const { t, i18n } = useTranslation()
  const config = useMemo(
    () => ({ clicks: { label: t('linkStats.clicks'), color: 'var(--primary)' } }) satisfies ChartConfig,
    [t],
  )
  const formatDay = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    return (day: unknown) => (typeof day === 'string' ? formatter.format(utcDayToDate(day)) : '')
  }, [i18n.language])

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={daily} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={formatDay} minTickGap={TICK_MIN_GAP} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={Y_AXIS_WIDTH} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={formatDay} />} />
        <Bar dataKey="clicks" fill="var(--color-clicks)" radius={BAR_RADIUS} />
      </BarChart>
    </ChartContainer>
  )
}
