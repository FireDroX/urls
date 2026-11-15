import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createTag, updateTag, type Tag } from '#api/tags'
import { FormError } from '#components/FormError'
import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { extractErrorMessage } from '#lib/api-errors'
import { tagErrorMessages } from '#lib/tag-errors'
import {
  createTagFormSchema,
  tagFormDefaults,
  toCreateTagPayload,
  toUpdateTagPayload,
  type TagFormValues,
} from '#schemas/tag.schema'

interface TagFormDialogProps {
  open: boolean
  tag?: Tag
  onOpenChange: (open: boolean) => void
  onSaved: (tag: Tag) => void
}

async function saveTag(tag: Tag | undefined, values: TagFormValues): Promise<Tag> {
  if (!tag) {
    return createTag(toCreateTagPayload(values))
  }
  const payload = toUpdateTagPayload(tag, values)
  return Object.keys(payload).length === 0 ? tag : updateTag(tag.id, payload)
}

function TagForm({ tag, onSaved }: { tag?: Tag; onSaved: (tag: Tag) => void }) {
  const { t } = useTranslation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createTagFormSchema(t), [t])
  const defaultValues = useMemo(() => tagFormDefaults(tag), [tag])
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<TagFormValues>({ resolver: zodResolver(schema), defaultValues })

  async function onSubmit(values: TagFormValues) {
    setSubmitError(null)
    try {
      onSaved(await saveTag(tag, values))
    } catch (error) {
      setSubmitError(extractErrorMessage(error, undefined, tagErrorMessages(t)))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="tag-name">{t('organization.tags.form.name')}</FieldLabel>
              <Input {...field} id="tag-name" autoComplete="off" aria-invalid={!!fieldState.error} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="color"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="tag-color">{t('organization.tags.form.color')}</FieldLabel>
              <div className="flex items-center gap-2">
                <Input {...field} id="tag-color" type="color" className="h-9 w-16 cursor-pointer p-1" />
                <span className="font-mono text-sm text-muted-foreground">{field.value.toLowerCase()}</span>
              </div>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <FormError message={submitError} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {tag ? t('links.form.save') : t('links.form.create')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

export function TagFormDialog({ open, tag, onOpenChange, onSaved }: TagFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? t('organization.tags.form.editTitle') : t('organization.tags.form.createTitle')}</DialogTitle>
          <DialogDescription>
            {tag ? t('organization.tags.form.editDescription') : t('organization.tags.form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <TagForm tag={tag} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}
