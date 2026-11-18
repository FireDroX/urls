import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LIST_SEARCH_DEBOUNCE_MS, LIST_SEARCH_MAX_LENGTH } from '#api/list-params'
import { Input } from '#components/ui/input'

interface ListSearchInputProps {
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export function ListSearchInput({ value, placeholder, onChange }: ListSearchInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef({ value, onChange })

  useEffect(() => {
    latest.current = { value, onChange }
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(value)
  }

  function handleChange(next: string) {
    setText(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const trimmed = next.trim()
      if (trimmed !== latest.current.value) latest.current.onChange(trimmed)
    }, LIST_SEARCH_DEBOUNCE_MS)
  }

  return (
    <div className="relative min-w-48 flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        className="pl-8"
        value={text}
        maxLength={LIST_SEARCH_MAX_LENGTH}
        placeholder={placeholder}
        aria-label={t('listFilters.search')}
        onChange={(event) => handleChange(event.target.value)}
      />
    </div>
  )
}
