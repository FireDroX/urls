import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listFiles, type FilesList } from '#api/files'
import { extractErrorMessage } from '#lib/api-errors'
import { fileListErrorMessages } from '#lib/file-errors'

export type FilesState = { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & FilesList)

export interface UseFiles {
  state: FilesState
  reload: () => void
  refresh: () => void
}

export function useFiles(orphansOnly: boolean): UseFiles {
  const { t } = useTranslation()
  const [state, setState] = useState<FilesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    listFiles(orphansOnly)
      .then((list) => {
        if (!cancelled) setState({ status: 'ready', ...list })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: extractErrorMessage(error, t('files.loadFailedBody'), fileListErrorMessages(t)),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [orphansOnly, attempt, t])

  useEffect(() => {
    setState({ status: 'loading' })
  }, [orphansOnly])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const refresh = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, reload, refresh }
}
