import { useCallback, useEffect, useState } from 'react'
import { listTags, type Tag } from '#api/tags'

export type TagsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; tags: Tag[] }

export interface UseTags {
  state: TagsState
  reload: () => void
  add: (tag: Tag) => void
  replace: (previousId: string, tag: Tag) => void
  remove: (id: string) => void
}

export function useTags(): UseTags {
  const [state, setState] = useState<TagsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    listTags()
      .then((tags) => {
        if (!cancelled) setState({ status: 'ready', tags })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const update = useCallback((change: (tags: Tag[]) => Tag[]) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', tags: change(current.tags) } : current))
  }, [])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const add = useCallback((tag: Tag) => update((tags) => [tag, ...tags]), [update])

  const replace = useCallback(
    (previousId: string, tag: Tag) => update((tags) => tags.map((item) => (item.id === previousId ? tag : item))),
    [update],
  )

  const remove = useCallback((id: string) => update((tags) => tags.filter((item) => item.id !== id)), [update])

  return { state, reload, add, replace, remove }
}
