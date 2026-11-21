import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { dropState } from '../../common/drop-state.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import type { ListPage } from '../../common/list-query.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  generatePublicId,
  isWellFormedLinkId,
} from '../../common/public-id.js';
import {
  type DropState,
  PUBLIC_ID_GENERATION_ATTEMPTS,
} from '../../common/variables.global.js';
import { EventsService } from '../../events/services/events.service.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import { FileDeletionService } from '../../files/services/file-deletion.service.js';
import {
  FilesService,
  type LinkFilesSummary,
} from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import {
  EMPTY_LINK_ORGANIZATION,
  type LinkOrganization,
  type ResolvedOrganization,
} from '../../links/link-organization.js';
import { listDropsQuerySchema } from '../dto/in/list-drops-query.dto.js';
import { LinkOrganizationService } from '../../links/services/link-organization.service.js';
import type {
  MovedToShare,
  NewSharedFiles,
} from '../../files/persistence/stored-file.repository.js';
import {
  type ShareDetail,
  withFiles,
} from '../../shares/services/shares.service.js';
import {
  shareDropFilesSchema,
  type ShareDropFilesDto,
} from '../dto/in/share-drop-files.dto.js';
import { createDropSchema } from '../dto/in/create-drop.dto.js';
import { updateDropSchema } from '../dto/in/update-drop.dto.js';
import type {
  DropRepository,
  NewDrop,
} from '../persistence/drop.repository.js';

export interface DropSummary extends LinkFilesSummary {
  drop: Link;
  organization: LinkOrganization;
  state: DropState;
}

export interface DropDetail extends DropSummary {
  files: StoredFile[];
  viewCount: number;
}

const NO_FILES: LinkFilesSummary = { fileCount: 0, totalSize: 0 };

function summarize(
  drop: Link,
  usage: LinkFilesSummary,
  organization: LinkOrganization,
  now: Date = new Date(),
): DropSummary {
  return {
    drop,
    organization,
    ...usage,
    state: dropState(drop, usage, now),
  };
}

@Injectable()
export class DropsService {
  constructor(
    @Inject('DropsRepository')
    private readonly repository: DropRepository,
    private readonly files: FilesService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventsService,
    private readonly fileDeletion: FileDeletionService,
    private readonly organization: LinkOrganizationService,
  ) {}

  async list(query: unknown): Promise<ListPage<DropSummary>> {
    const parsed = parseDto(listDropsQuerySchema, query);
    const now = new Date();
    const { items: drops, total } = await this.repository.findPage(parsed, now);
    const usages = await this.files.summarizeCountedLinks(
      drops.map((drop) => drop.id),
    );
    const organizations = await this.organization.loadFor(drops);
    return {
      items: drops.map((drop) =>
        summarize(
          drop,
          usages.get(drop.id) ?? NO_FILES,
          organizations.get(drop.id) ?? EMPTY_LINK_ORGANIZATION,
          now,
        ),
      ),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  async get(publicId: string): Promise<DropDetail> {
    const drop = await this.find(publicId);
    const [summary, files, viewCount] = await Promise.all([
      this.withUsage(drop),
      this.files.listForLink(drop.id),
      this.events.countViews(drop.id),
    ]);
    return { ...summary, files, viewCount };
  }

  async removeFile(
    publicId: string,
    filePublicId: string,
    userId: string,
  ): Promise<void> {
    const drop = await this.find(publicId);
    if (!isWellFormedLinkId(filePublicId)) {
      throw new FileNotFoundException();
    }
    const file = await this.files.findInLink(drop.id, filePublicId);
    if (!file) {
      throw new FileNotFoundException();
    }
    await this.fileDeletion.erase(file, drop, {
      action: 'files.deleted',
      userId,
    });
  }

  async create(input: unknown, userId: string): Promise<DropSummary> {
    const dto = parseDto(createDropSchema, input);
    const organization = await this.organization.resolve(dto);
    const fields = {
      title: dto.title ?? null,
      expiresAt: dto.expiresAt ?? null,
      maxFiles: dto.maxFiles,
      maxTotalBytes: dto.maxTotalBytes,
    };
    const drop = dto.slug
      ? await this.repository.insert(
          { ...fields, publicId: dto.slug },
          organization,
        )
      : await this.insertWithGeneratedId(fields, organization);
    await this.auditLog.record({
      action: 'drops.created',
      userId,
      targetId: drop.publicId,
      metadata: {
        ...fields,
        tagIds: dto.tagIds ?? [],
        folderId: dto.folderId ?? null,
      },
    });
    return summarize(drop, NO_FILES, await this.organization.loadOne(drop));
  }

  async shareFiles(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<ShareDetail> {
    if (!isWellFormedLinkId(publicId)) {
      throw new DropNotFoundException();
    }
    const dto = parseDto(shareDropFilesSchema, input);
    const drop = await this.find(publicId);
    const fields = {
      expiresAt: dto.expiresAt ?? null,
      maxDownloads: dto.maxDownloads ?? null,
    };
    const { share, files } = dto.slug
      ? await this.files.moveToNewShare(
          drop.id,
          dto.fileIds,
          { ...fields, publicId: dto.slug },
          dto.closeDrop,
        )
      : await this.moveWithGeneratedId(drop.id, dto, fields);
    await this.auditLog.record({
      action: 'shares.created',
      userId,
      targetId: share.publicId,
      metadata: { ...fields, fromDropId: drop.publicId },
    });
    await this.auditLog.record({
      action: 'drops.files.shared',
      userId,
      targetId: drop.publicId,
      metadata: {
        shareId: share.publicId,
        fileIds: dto.fileIds,
        closeDrop: dto.closeDrop,
      },
    });
    return { ...withFiles(share, files), viewCount: 0 };
  }

  private async moveWithGeneratedId(
    dropId: string,
    dto: ShareDropFilesDto,
    fields: Pick<NewSharedFiles, 'expiresAt' | 'maxDownloads'>,
  ): Promise<MovedToShare> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.files.moveToNewShare(
          dropId,
          dto.fileIds,
          { ...fields, publicId: generatePublicId() },
          dto.closeDrop,
        );
      } catch (error) {
        if (
          !(error instanceof SlugAlreadyTakenException) ||
          attempt >= PUBLIC_ID_GENERATION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  async update(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<DropSummary> {
    const dto = parseDto(updateDropSchema, input);
    const drop = await this.find(publicId);
    const organization = await this.organization.resolve(dto);
    if (dto.slug !== undefined) drop.publicId = dto.slug;
    if (dto.title !== undefined) drop.title = dto.title;
    if (dto.expiresAt !== undefined) drop.expiresAt = dto.expiresAt;
    if (dto.maxFiles !== undefined) drop.maxFiles = dto.maxFiles;
    if (dto.maxTotalBytes !== undefined) drop.maxTotalBytes = dto.maxTotalBytes;
    if (dto.disabled !== undefined) drop.disabled = dto.disabled;
    const saved = await this.repository.save(drop, organization);
    await this.auditLog.record({
      action: 'drops.updated',
      userId,
      targetId: saved.publicId,
      metadata: { previousId: publicId, changes: dto },
    });
    return this.withUsage(saved);
  }

  async remove(publicId: string, userId: string): Promise<void> {
    const drop = await this.find(publicId);
    await this.repository.softDelete(drop.id);
    await this.auditLog.record({
      action: 'drops.deleted',
      userId,
      targetId: drop.publicId,
    });
  }

  async find(publicId: string): Promise<Link> {
    if (!isWellFormedLinkId(publicId)) {
      throw new DropNotFoundException();
    }
    const drop = await this.repository.findByPublicId(publicId);
    if (!drop) {
      throw new DropNotFoundException();
    }
    return drop;
  }

  private async withUsage(drop: Link): Promise<DropSummary> {
    const [usages, organization] = await Promise.all([
      this.files.summarizeCountedLinks([drop.id]),
      this.organization.loadOne(drop),
    ]);
    return summarize(drop, usages.get(drop.id) ?? NO_FILES, organization);
  }

  private async insertWithGeneratedId(
    fields: Omit<NewDrop, 'publicId'>,
    organization: ResolvedOrganization,
  ): Promise<Link> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.repository.insert(
          { ...fields, publicId: generatePublicId() },
          organization,
        );
      } catch (error) {
        if (
          !(error instanceof SlugAlreadyTakenException) ||
          attempt >= PUBLIC_ID_GENERATION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
