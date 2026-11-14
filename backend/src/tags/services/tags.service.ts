import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { TagNameAlreadyTakenException } from '../../common/exceptions/tags/tag-name-already-taken.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { TagPublicIdTakenException } from '../../common/exceptions/tags/tag-public-id-taken.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  generatePublicId,
  isWellFormedLinkId,
} from '../../common/public-id.js';
import { PUBLIC_ID_GENERATION_ATTEMPTS } from '../../common/variables.global.js';
import { toNameKey } from '../../common/name-key.js';
import { createTagSchema } from '../dto/in/create-tag.dto.js';
import { updateTagSchema } from '../dto/in/update-tag.dto.js';
import type { Tag } from '../entities/tag.entity.js';
import type {
  NewTag,
  TagRepository,
  TagWithLinkCount,
} from '../persistence/tag.repository.js';

@Injectable()
export class TagsService {
  constructor(
    @Inject('TagsRepository')
    private readonly repository: TagRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  list(): Promise<TagWithLinkCount[]> {
    return this.repository.listWithLinkCounts();
  }

  async create(input: unknown, userId: string): Promise<TagWithLinkCount> {
    const { name, color } = parseDto(createTagSchema, input);
    const nameKey = toNameKey(name);
    if (await this.repository.findByNameKey(nameKey)) {
      throw new TagNameAlreadyTakenException();
    }
    const tag = await this.insertWithGeneratedId({ name, nameKey, color });
    await this.auditLog.record({
      action: 'tags.created',
      userId,
      targetId: tag.publicId,
      metadata: { name: tag.name, color: tag.color },
    });
    return { tag, linkCount: 0 };
  }

  async update(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<TagWithLinkCount> {
    const dto = parseDto(updateTagSchema, input);
    const tag = await this.find(publicId);
    const changes: Record<string, string> = {};
    if (dto.name !== undefined && dto.name !== tag.name) {
      const nameKey = toNameKey(dto.name);
      const existing = await this.repository.findByNameKey(nameKey);
      if (existing && existing.id !== tag.id) {
        throw new TagNameAlreadyTakenException();
      }
      tag.name = dto.name;
      tag.nameKey = nameKey;
      changes.name = dto.name;
    }
    if (dto.color !== undefined && dto.color !== tag.color) {
      tag.color = dto.color;
      changes.color = dto.color;
    }
    const saved = await this.repository.save(tag);
    await this.auditLog.record({
      action: 'tags.updated',
      userId,
      targetId: saved.publicId,
      metadata: changes,
    });
    return {
      tag: saved,
      linkCount: await this.repository.countLinks(saved.id),
    };
  }

  async remove(publicId: string, userId: string): Promise<void> {
    const tag = await this.find(publicId);
    await this.repository.remove(tag);
    await this.auditLog.record({
      action: 'tags.deleted',
      userId,
      targetId: tag.publicId,
      metadata: { name: tag.name },
    });
  }

  private async find(publicId: string): Promise<Tag> {
    if (!isWellFormedLinkId(publicId)) {
      throw new TagNotFoundException();
    }
    const tag = await this.repository.findByPublicId(publicId);
    if (!tag) {
      throw new TagNotFoundException();
    }
    return tag;
  }

  private async insertWithGeneratedId(
    fields: Omit<NewTag, 'publicId'>,
  ): Promise<Tag> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.repository.insert({
          ...fields,
          publicId: generatePublicId(),
        });
      } catch (error) {
        if (
          !(error instanceof TagPublicIdTakenException) ||
          attempt >= PUBLIC_ID_GENERATION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
