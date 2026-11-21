import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/database-errors.js';
import { FolderNameAlreadyTakenException } from '../../common/exceptions/folders/folder-name-already-taken.exception.js';
import { FolderPublicIdTakenException } from '../../common/exceptions/folders/folder-public-id-taken.exception.js';
import { Folder } from '../entities/folder.entity.js';
import type {
  NewFolder,
  FolderRepository,
  FolderWithLinkCount,
} from './folder.repository.js';

const NAME_INDEX = 'UQ_folders_name_key';

@Injectable()
export class TypeormFolderRepository implements FolderRepository {
  constructor(
    @InjectRepository(Folder)
    private readonly repository: Repository<Folder>,
  ) {}

  async listWithLinkCounts(): Promise<FolderWithLinkCount[]> {
    const { entities, raw } = await this.repository
      .createQueryBuilder('folder')
      .leftJoin(
        'links',
        'link',
        'link.folder_id = folder.id AND link.deleted_at IS NULL',
      )
      .addSelect('COUNT(link.id)', 'linkCount')
      .groupBy('folder.id')
      .orderBy('folder.name', 'ASC')
      .getRawAndEntities<{ linkCount: string }>();
    return entities.map((folder, index) => ({
      folder,
      linkCount: Number(raw[index].linkCount),
    }));
  }

  async countLinks(folderId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('folder')
      .leftJoin(
        'links',
        'link',
        'link.folder_id = folder.id AND link.deleted_at IS NULL',
      )
      .select('COUNT(link.id)', 'linkCount')
      .where('folder.id = :folderId', { folderId })
      .getRawOne<{ linkCount: string }>();
    return Number(row?.linkCount ?? 0);
  }

  findByPublicId(publicId: string): Promise<Folder | null> {
    return this.repository.findOneBy({ publicId });
  }

  findByNameKey(nameKey: string): Promise<Folder | null> {
    return this.repository.findOneBy({ nameKey });
  }

  insert(folder: NewFolder): Promise<Folder> {
    return this.persist(this.repository.create(folder));
  }

  save(folder: Folder): Promise<Folder> {
    return this.persist(folder);
  }

  async remove(folder: Folder): Promise<void> {
    await this.repository.delete({ id: folder.id });
  }

  private async persist(folder: Folder): Promise<Folder> {
    try {
      return await this.repository.save(folder);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        const message = String(
          (error as { driverError?: { sqlMessage?: string } }).driverError
            ?.sqlMessage ?? '',
        );
        throw message.includes(NAME_INDEX)
          ? new FolderNameAlreadyTakenException()
          : new FolderPublicIdTakenException();
      }
      throw error;
    }
  }
}
