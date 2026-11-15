import { useState, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { Folder as FolderIcon, Plus, Tags as TagsIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { deleteFolder, type Folder } from '#api/folders'
import { deleteTag, type Tag } from '#api/tags'
import { FolderFormDialog } from '#components/organization/FolderFormDialog'
import { FoldersTable } from '#components/organization/FoldersTable'
import { TagFormDialog } from '#components/organization/TagFormDialog'
import { TagsTable } from '#components/organization/TagsTable'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useFolders } from '#hooks/useFolders'
import { useTags } from '#hooks/useTags'
import { extractErrorMessage } from '#lib/api-errors'
import { folderErrorMessages } from '#lib/folder-errors'
import { tagErrorMessages } from '#lib/tag-errors'

const SKELETON_ROWS = 2
const NOT_FOUND = 404

interface DialogState<T> {
  kind: 'form' | 'delete'
  item?: T
  open: boolean
}

interface SectionProps {
  title: string
  newLabel: string
  icon: LucideIcon
  status: 'loading' | 'error' | 'ready'
  isEmpty: boolean
  emptyTitle: string
  emptyBody: string
  failedTitle: string
  onNew: () => void
  onRetry: () => void
  children: ReactNode
}

function OrganizationSection({
  title,
  newLabel,
  icon,
  status,
  isEmpty,
  emptyTitle,
  emptyBody,
  failedTitle,
  onNew,
  onRetry,
  children,
}: SectionProps) {
  const { t } = useTranslation()

  function content() {
    if (status === 'loading') {
      return (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      )
    }
    if (status === 'error') {
      return (
        <LinksPlaceholder
          icon={icon}
          title={failedTitle}
          body={t('links.loadFailedBody')}
          action={
            <Button variant="outline" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          }
        />
      )
    }
    if (isEmpty) {
      return <LinksPlaceholder icon={icon} title={emptyTitle} body={emptyBody} />
    }
    return children
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <Button onClick={onNew}>
          <Plus />
          {newLabel}
        </Button>
      </div>
      {content()}
    </section>
  )
}

function TagsSection() {
  const { t } = useTranslation()
  const { state, reload, add, replace, remove } = useTags()
  const [dialog, setDialog] = useState<DialogState<Tag>>({ kind: 'form', open: false })

  function closeDialog() {
    setDialog((current) => ({ ...current, open: false }))
  }

  function handleSaved(saved: Tag) {
    if (dialog.item) {
      replace(dialog.item.id, saved)
      toast.success(t('organization.tags.updated'))
    } else {
      add(saved)
      toast.success(t('organization.tags.created'))
    }
    closeDialog()
  }

  async function confirmDelete(tag: Tag) {
    await deleteTag(tag.id)
    remove(tag.id)
    toast.success(t('organization.tags.deleted'))
    closeDialog()
  }

  function deleteErrorMessage(error: unknown) {
    if (isAxiosError(error) && error.response?.status === NOT_FOUND) reload()
    return extractErrorMessage(error, undefined, tagErrorMessages(t))
  }

  return (
    <OrganizationSection
      title={t('organization.tags.title')}
      newLabel={t('organization.tags.new')}
      icon={TagsIcon}
      status={state.status}
      isEmpty={state.status === 'ready' && state.tags.length === 0}
      emptyTitle={t('organization.tags.emptyTitle')}
      emptyBody={t('organization.tags.emptyBody')}
      failedTitle={t('organization.tags.loadFailedTitle')}
      onNew={() => setDialog({ kind: 'form', open: true })}
      onRetry={reload}
    >
      {state.status === 'ready' && (
        <TagsTable
          tags={state.tags}
          actions={{
            onEdit: (tag) => setDialog({ kind: 'form', item: tag, open: true }),
            onDelete: (tag) => setDialog({ kind: 'delete', item: tag, open: true }),
          }}
        />
      )}
      <TagFormDialog
        open={dialog.open && dialog.kind === 'form'}
        tag={dialog.item}
        onOpenChange={(open) => !open && closeDialog()}
        onSaved={handleSaved}
      />
      {dialog.item && (
        <ConfirmDeleteDialog
          open={dialog.open && dialog.kind === 'delete'}
          title={t('organization.tags.delete.title')}
          description={t('organization.tags.delete.description', {
            name: dialog.item.name,
            count: dialog.item.linkCount,
          })}
          onOpenChange={(open) => !open && closeDialog()}
          onConfirm={() => confirmDelete(dialog.item!)}
          errorMessage={deleteErrorMessage}
        />
      )}
    </OrganizationSection>
  )
}

function FoldersSection() {
  const { t } = useTranslation()
  const { state, reload, add, replace, remove } = useFolders()
  const [dialog, setDialog] = useState<DialogState<Folder>>({ kind: 'form', open: false })

  function closeDialog() {
    setDialog((current) => ({ ...current, open: false }))
  }

  function handleSaved(saved: Folder) {
    if (dialog.item) {
      replace(dialog.item.id, saved)
      toast.success(t('organization.folders.updated'))
    } else {
      add(saved)
      toast.success(t('organization.folders.created'))
    }
    closeDialog()
  }

  async function confirmDelete(folder: Folder) {
    await deleteFolder(folder.id)
    remove(folder.id)
    toast.success(t('organization.folders.deleted'))
    closeDialog()
  }

  function deleteErrorMessage(error: unknown) {
    if (isAxiosError(error) && error.response?.status === NOT_FOUND) reload()
    return extractErrorMessage(error, undefined, folderErrorMessages(t))
  }

  return (
    <OrganizationSection
      title={t('organization.folders.title')}
      newLabel={t('organization.folders.new')}
      icon={FolderIcon}
      status={state.status}
      isEmpty={state.status === 'ready' && state.folders.length === 0}
      emptyTitle={t('organization.folders.emptyTitle')}
      emptyBody={t('organization.folders.emptyBody')}
      failedTitle={t('organization.folders.loadFailedTitle')}
      onNew={() => setDialog({ kind: 'form', open: true })}
      onRetry={reload}
    >
      {state.status === 'ready' && (
        <FoldersTable
          folders={state.folders}
          actions={{
            onEdit: (folder) => setDialog({ kind: 'form', item: folder, open: true }),
            onDelete: (folder) => setDialog({ kind: 'delete', item: folder, open: true }),
          }}
        />
      )}
      <FolderFormDialog
        open={dialog.open && dialog.kind === 'form'}
        folder={dialog.item}
        onOpenChange={(open) => !open && closeDialog()}
        onSaved={handleSaved}
      />
      {dialog.item && (
        <ConfirmDeleteDialog
          open={dialog.open && dialog.kind === 'delete'}
          title={t('organization.folders.delete.title')}
          description={t('organization.folders.delete.description', {
            name: dialog.item.name,
            count: dialog.item.linkCount,
          })}
          onOpenChange={(open) => !open && closeDialog()}
          onConfirm={() => confirmDelete(dialog.item!)}
          errorMessage={deleteErrorMessage}
        />
      )}
    </OrganizationSection>
  )
}

export function Organization() {
  const { t } = useTranslation()
  useDocumentTitle(t('organization.title'))

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl font-bold">{t('organization.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('organization.subtitle')}</p>
      </div>
      <TagsSection />
      <FoldersSection />
    </>
  )
}
