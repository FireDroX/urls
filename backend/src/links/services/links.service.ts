import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { LinkExpiredException } from '../../common/exceptions/links/link-expired.exception.js';
import { LinkNotFoundException } from '../../common/exceptions/links/link-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import { generatePublicId } from '../../common/public-id.js';
import {
  LINK_SLUG_MAX_LENGTH,
  LINK_SLUG_REGEX,
  PUBLIC_ID_GENERATION_ATTEMPTS,
} from '../../common/variables.global.js';
import { createLinkSchema } from '../dto/in/create-link.dto.js';
import { updateLinkSchema } from '../dto/in/update-link.dto.js';
import type { Link } from '../entities/link.entity.js';
import type {
  LinkRepository,
  NewLink,
} from '../persistence/link.repository.js';

const REDIRECT = 'redirect';

function isWellFormedPublicId(publicId: string): boolean {
  return (
    publicId.length <= LINK_SLUG_MAX_LENGTH && LINK_SLUG_REGEX.test(publicId)
  );
}

@Injectable()
export class LinksService {
  constructor(
    @Inject('LinksRepository')
    private readonly repository: LinkRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  list(): Promise<Link[]> {
    return this.repository.findAllByType(REDIRECT);
  }

  async get(publicId: string): Promise<Link> {
    if (!isWellFormedPublicId(publicId)) {
      throw new LinkNotFoundException();
    }
    const link = await this.repository.findByPublicId(publicId);
    if (!link || link.type !== REDIRECT) {
      throw new LinkNotFoundException();
    }
    return link;
  }

  async resolveRedirect(publicId: string): Promise<string> {
    const link = await this.get(publicId);
    if (link.disabled || !link.destination) {
      throw new LinkNotFoundException();
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new LinkExpiredException();
    }
    return link.destination;
  }

  async create(input: unknown, userId: string): Promise<Link> {
    const dto = parseDto(createLinkSchema, input);
    const fields = {
      type: REDIRECT,
      destination: dto.destination,
      expiresAt: dto.expiresAt ?? null,
    } as const;
    const link = dto.slug
      ? await this.repository.insert({ ...fields, publicId: dto.slug })
      : await this.insertWithGeneratedId(fields);
    await this.auditLog.record({
      action: 'links.created',
      userId,
      targetId: link.publicId,
      metadata: { destination: link.destination, expiresAt: link.expiresAt },
    });
    return link;
  }

  async update(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<Link> {
    const dto = parseDto(updateLinkSchema, input);
    const link = await this.get(publicId);
    if (dto.slug !== undefined) link.publicId = dto.slug;
    if (dto.destination !== undefined) link.destination = dto.destination;
    if (dto.expiresAt !== undefined) link.expiresAt = dto.expiresAt;
    if (dto.disabled !== undefined) link.disabled = dto.disabled;
    const saved = await this.repository.save(link);
    await this.auditLog.record({
      action: 'links.updated',
      userId,
      targetId: saved.publicId,
      metadata: { previousId: publicId, changes: dto },
    });
    return saved;
  }

  async remove(publicId: string, userId: string): Promise<void> {
    const link = await this.get(publicId);
    await this.repository.softDelete(link.id);
    await this.auditLog.record({
      action: 'links.deleted',
      userId,
      targetId: link.publicId,
    });
  }

  private async insertWithGeneratedId(
    fields: Omit<NewLink, 'publicId'>,
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
