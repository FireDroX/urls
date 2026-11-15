export interface LinkTag {
  id: string
  name: string
  color: string
}

export interface LinkFolder {
  id: string
  name: string
}

export interface LinkOrganization {
  tags: LinkTag[]
  folder: LinkFolder | null
}

export interface LinkOrganizationPayload {
  tagIds?: string[]
  folderId?: string | null
}
