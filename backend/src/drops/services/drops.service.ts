import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { dropState } from '../../common/drop-state.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  generatePublicId,
  isWellFormedLinkId,
} from '../../common/public-id.js';
import {
  type DropState,
  PUBLIC_ID_GENERATION_ATTEMPTS,
} from '../../common/variables.global.js';
import {
  FilesService,
  type LinkFilesSummary,
} from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import { createDropSchema } from '../dto/in/create-drop.dto.js';
import { updateDropSchema } from '../dto/in/update-drop.dto.js';
import type {
  DropRepository,
  NewDrop,
} from '../persistence/drop.repository.js';

export interface DropSummary extends LinkFilesSummary {
  drop: Link;
  state: DropState;
}

const NO_FILES: LinkFilesSummary = { fileCount: 0, totalSize: 0 };

function summarize(drop: Link, usage: LinkFilesSummary): DropSummary {
  return { drop, ...usage, state: dropState(drop, usage, new Date()) };
}

@Injectable()
export class DropsService {
  constructor(
    @Inject('DropsRepository')
    private readonly repository: DropRepository,
    private readonly files: FilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(): Promise<DropSummary[]> {
    const drops = await this.repository.findAll();
    const usages = await this.files.summarizeCountedLinks(
      drops.map((drop) => drop.id),
    );
    return drops.map((drop) =>
      summarize(drop, usages.get(drop.id) ?? NO_FILES),
    );
  }

  async get(publicId: string): Promise<DropSummary> {
    return this.withUsage(await this.find(publicId));
  }

  async create(input: unknown, userId: string): Promise<DropSummary> {
    const dto = parseDto(createDropSchema, input);
    const fields = {
      title: dto.title ?? null,
      expiresAt: dto.expiresAt ?? null,
      maxFiles: dto.maxFiles,
      maxTotalBytes: dto.maxTotalBytes,
    };
    const drop = dto.slug
      ? await this.repository.insert({ ...fields, publicId: dto.slug })
      : await this.insertWithGeneratedId(fields);
    await this.auditLog.record({
      action: 'drops.created',
      userId,
      targetId: drop.publicId,
      metadata: fields,
    });
    return summarize(drop, NO_FILES);
  }

  async update(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<DropSummary> {
    const dto = parseDto(updateDropSchema, input);
    const drop = await this.find(publicId);
    if (dto.slug !== undefined) drop.publicId = dto.slug;
    if (dto.title !== undefined) drop.title = dto.title;
    if (dto.expiresAt !== undefined) drop.expiresAt = dto.expiresAt;
    if (dto.maxFiles !== undefined) drop.maxFiles = dto.maxFiles;
    if (dto.maxTotalBytes !== undefined) drop.maxTotalBytes = dto.maxTotalBytes;
    if (dto.disabled !== undefined) drop.disabled = dto.disabled;
    const saved = await this.repository.save(drop);
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
    const usages = await this.files.summarizeCountedLinks([drop.id]);
    return summarize(drop, usages.get(drop.id) ?? NO_FILES);
  }

  private async insertWithGeneratedId(
    fields: Omit<NewDrop, 'publicId'>,
  ): Promise<Link> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.repository.insert({
          ...fields,
          publicId: generatePublicId(),
        });
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
