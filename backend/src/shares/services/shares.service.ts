import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { ShareNotFoundException } from '../../common/exceptions/shares/share-not-found.exception.js';
import type { ListPage } from '../../common/list-query.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  generatePublicId,
  isWellFormedLinkId,
} from '../../common/public-id.js';
import { PUBLIC_ID_GENERATION_ATTEMPTS } from '../../common/variables.global.js';
import { EventsService } from '../../events/services/events.service.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
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
import { LinkOrganizationService } from '../../links/services/link-organization.service.js';
import { createShareSchema } from '../dto/in/create-share.dto.js';
import { listSharesQuerySchema } from '../dto/in/list-shares-query.dto.js';
import { updateShareSchema } from '../dto/in/update-share.dto.js';
import type {
  NewShare,
  ShareRepository,
} from '../persistence/share.repository.js';

export interface ShareSummary extends LinkFilesSummary {
  share: Link;
  organization: LinkOrganization;
}

export interface ShareWithFiles extends ShareSummary {
  files: StoredFile[];
}

export interface ShareDetail extends ShareWithFiles {
  viewCount: number;
}

export function withFiles(
  share: Link,
  files: StoredFile[],
  organization: LinkOrganization = EMPTY_LINK_ORGANIZATION,
): ShareWithFiles {
  return {
    share,
    organization,
    files,
    fileCount: files.length,
    totalSize: files.reduce((total, file) => total + file.size, 0),
  };
}

@Injectable()
export class SharesService {
  constructor(
    @Inject('SharesRepository')
    private readonly repository: ShareRepository,
    private readonly files: FilesService,
    private readonly events: EventsService,
    private readonly auditLog: AuditLogService,
    private readonly organization: LinkOrganizationService,
  ) {}

  async list(query: unknown): Promise<ListPage<ShareSummary>> {
    const parsed = parseDto(listSharesQuerySchema, query);
    const { items: shares, total } = await this.repository.findPage(
      parsed,
      new Date(),
    );
    const summaries = await this.files.summarizeLinks(
      shares.map((share) => share.id),
    );
    const organizations = await this.organization.loadFor(shares);
    return {
      items: shares.map((share) => ({
        share,
        organization: organizations.get(share.id) ?? EMPTY_LINK_ORGANIZATION,
        fileCount: summaries.get(share.id)?.fileCount ?? 0,
        totalSize: summaries.get(share.id)?.totalSize ?? 0,
      })),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  async get(publicId: string): Promise<ShareDetail> {
    return this.detail(await this.find(publicId));
  }

  async create(input: unknown, userId: string): Promise<ShareDetail> {
    const dto = parseDto(createShareSchema, input);
    const organization = await this.organization.resolve(dto);
    const fields = {
      expiresAt: dto.expiresAt ?? null,
      maxDownloads: dto.maxDownloads ?? null,
    };
    const share = dto.slug
      ? await this.repository.insert(
          { ...fields, publicId: dto.slug },
          organization,
        )
      : await this.insertWithGeneratedId(fields, organization);
    await this.auditLog.record({
      action: 'shares.created',
      userId,
      targetId: share.publicId,
      metadata: {
        ...fields,
        tagIds: dto.tagIds ?? [],
        folderId: dto.folderId ?? null,
      },
    });
    const created = await this.organization.loadOne(share);
    return { ...withFiles(share, [], created), viewCount: 0 };
  }

  async update(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<ShareDetail> {
    const dto = parseDto(updateShareSchema, input);
    const share = await this.find(publicId);
    const organization = await this.organization.resolve(dto);
    if (dto.slug !== undefined) share.publicId = dto.slug;
    if (dto.expiresAt !== undefined) share.expiresAt = dto.expiresAt;
    if (dto.maxDownloads !== undefined) share.maxDownloads = dto.maxDownloads;
    if (dto.disabled !== undefined) share.disabled = dto.disabled;
    const saved = await this.repository.save(share, organization);
    await this.auditLog.record({
      action: 'shares.updated',
      userId,
      targetId: saved.publicId,
      metadata: { previousId: publicId, changes: dto },
    });
    return this.detail(saved);
  }

  async remove(publicId: string, userId: string): Promise<void> {
    const share = await this.find(publicId);
    await this.repository.softDelete(share.id);
    await this.auditLog.record({
      action: 'shares.deleted',
      userId,
      targetId: share.publicId,
    });
  }

  private async detail(share: Link): Promise<ShareDetail> {
    const [files, viewCount, organization] = await Promise.all([
      this.files.listForLink(share.id),
      this.events.countViews(share.id),
      this.organization.loadOne(share),
    ]);
    return { ...withFiles(share, files, organization), viewCount };
  }

  async find(publicId: string): Promise<Link> {
    if (!isWellFormedLinkId(publicId)) {
      throw new ShareNotFoundException();
    }
    const share = await this.repository.findByPublicId(publicId);
    if (!share) {
      throw new ShareNotFoundException();
    }
    return share;
  }

  private async insertWithGeneratedId(
    fields: Omit<NewShare, 'publicId'>,
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
