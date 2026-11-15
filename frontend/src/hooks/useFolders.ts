import { useCallback, useEffect, useState } from 'react'
import { insertByName } from '#utils/insert-by-name'
import { listFolders, type Folder } from '#api/folders'

export type FoldersState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; folders: Folder[] }

export interface UseFolders {
  state: FoldersState
  reload: () => void
  add: (folder: Folder) => void
  replace: (previousId: string, folder: Folder) => void
  remove: (id: string) => void
}

export function useFolders(): UseFolders {
  const [state, setState] = useState<FoldersState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    listFolders()
      .then((folders) => {
        if (!cancelled) setState({ status: 'ready', folders })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const update = useCallback((change: (folders: Folder[]) => Folder[]) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', folders: change(current.folders) } : current))
  }, [])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const add = useCallback((folder: Folder) => update((folders) => insertByName(folders, folder)), [update])

  const replace = useCallback(
    (previousId: string, folder: Folder) => update((folders) => folders.map((item) => (item.id === previousId ? folder : item))),
    [update],
  )

  const remove = useCallback((id: string) => update((folders) => folders.filter((item) => item.id !== id)), [update])

  return { state, reload, add, replace, remove }
}
