import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { FolderNameAlreadyTakenException } from '../../common/exceptions/folders/folder-name-already-taken.exception.js';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { FolderPublicIdTakenException } from '../../common/exceptions/folders/folder-public-id-taken.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  generatePublicId,
  isWellFormedLinkId,
} from '../../common/public-id.js';
import { PUBLIC_ID_GENERATION_ATTEMPTS } from '../../common/variables.global.js';
import { toNameKey } from '../../common/name-key.js';
import { createFolderSchema } from '../dto/in/create-folder.dto.js';
import { updateFolderSchema } from '../dto/in/update-folder.dto.js';
import type { Folder } from '../entities/folder.entity.js';
import type {
  NewFolder,
  FolderRepository,
  FolderWithLinkCount,
} from '../persistence/folder.repository.js';

@Injectable()
export class FoldersService {
  constructor(
    @Inject('FoldersRepository')
    private readonly repository: FolderRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  list(): Promise<FolderWithLinkCount[]> {
    return this.repository.listWithLinkCounts();
  }

  async create(input: unknown, userId: string): Promise<FolderWithLinkCount> {
    const { name } = parseDto(createFolderSchema, input);
    const nameKey = toNameKey(name);
    if (await this.repository.findByNameKey(nameKey)) {
      throw new FolderNameAlreadyTakenException();
    }
    const folder = await this.insertWithGeneratedId({ name, nameKey });
    await this.auditLog.record({
      action: 'folders.created',
      userId,
      targetId: folder.publicId,
      metadata: { name: folder.name },
    });
    return { folder, linkCount: 0 };
  }

  async update(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<FolderWithLinkCount> {
    const dto = parseDto(updateFolderSchema, input);
    const folder = await this.find(publicId);
    const changes: Record<string, string> = {};
    if (dto.name !== folder.name) {
      const nameKey = toNameKey(dto.name);
      const existing = await this.repository.findByNameKey(nameKey);
      if (existing && existing.id !== folder.id) {
        throw new FolderNameAlreadyTakenException();
      }
      folder.name = dto.name;
      folder.nameKey = nameKey;
      changes.name = dto.name;
    }
    const saved = await this.repository.save(folder);
    await this.auditLog.record({
      action: 'folders.updated',
      userId,
      targetId: saved.publicId,
      metadata: changes,
    });
    return {
      folder: saved,
      linkCount: await this.repository.countLinks(saved.id),
    };
  }

  async remove(publicId: string, userId: string): Promise<void> {
    const folder = await this.find(publicId);
    await this.repository.remove(folder);
    await this.auditLog.record({
      action: 'folders.deleted',
      userId,
      targetId: folder.publicId,
      metadata: { name: folder.name },
    });
  }

  private async find(publicId: string): Promise<Folder> {
    if (!isWellFormedLinkId(publicId)) {
      throw new FolderNotFoundException();
    }
    const folder = await this.repository.findByPublicId(publicId);
    if (!folder) {
      throw new FolderNotFoundException();
    }
    return folder;
  }

  private async insertWithGeneratedId(
    fields: Omit<NewFolder, 'publicId'>,
  ): Promise<Folder> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.repository.insert({
          ...fields,
          publicId: generatePublicId(),
        });
      } catch (error) {
        if (
          !(error instanceof FolderPublicIdTakenException) ||
          attempt >= PUBLIC_ID_GENERATION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
