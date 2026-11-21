import type { Folder } from '../entities/folder.entity.js';

export type NewFolder = Pick<Folder, 'publicId' | 'name' | 'nameKey'>;

export interface FolderWithLinkCount {
  folder: Folder;
  linkCount: number;
}

export interface FolderRepository {
  listWithLinkCounts(): Promise<FolderWithLinkCount[]>;
  countLinks(folderId: string): Promise<number>;
  findByPublicId(publicId: string): Promise<Folder | null>;
  findByNameKey(nameKey: string): Promise<Folder | null>;
  insert(folder: NewFolder): Promise<Folder>;
  save(folder: Folder): Promise<Folder>;
  remove(folder: Folder): Promise<void>;
}
