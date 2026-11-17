import { useCallback, useEffect, useState } from 'react'
import { listFolders, type Folder } from '#api/folders'
import { listTags, type Tag } from '#api/tags'

export interface LinkOrganizationOptions {
  status: 'loading' | 'error' | 'ready'
  tags: Tag[]
  folders: Folder[]
}

export interface UseLinkOrganizationOptions {
  options: LinkOrganizationOptions
  reload: () => void
}

const LOADING: LinkOrganizationOptions = { status: 'loading', tags: [], folders: [] }

export function useLinkOrganizationOptions(): UseLinkOrganizationOptions {
  const [options, setOptions] = useState<LinkOrganizationOptions>(LOADING)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([listTags(), listFolders()])
      .then(([tags, folders]) => {
        if (!cancelled) setOptions({ status: 'ready', tags, folders })
      })
      .catch(() => {
        if (!cancelled) setOptions({ status: 'error', tags: [], folders: [] })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => {
    setOptions(LOADING)
    setAttempt((value) => value + 1)
  }, [])

  return { options, reload }
}
