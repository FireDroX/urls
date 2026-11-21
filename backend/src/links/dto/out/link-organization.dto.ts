export interface LinkTagDto {
  id: string;
  name: string;
  color: string;
}

export interface LinkFolderDto {
  id: string;
  name: string;
}

export interface LinkOrganizationDto {
  tags: LinkTagDto[];
  folder: LinkFolderDto | null;
}
