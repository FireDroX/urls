import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { LinkExpiredException } from '../../common/exceptions/links/link-expired.exception.js';
import { LinkNotFoundException } from '../../common/exceptions/links/link-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import type { ListPage } from '../../common/list-query.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  generatePublicId,
  isWellFormedLinkId,
} from '../../common/public-id.js';
import { dropState } from '../../common/drop-state.js';
import { isLinkExpired, isLinkUsedUp } from '../../common/link-expiry.js';
import {
  LINK_CHECK_BROKEN_AFTER,
  PUBLIC_ID_GENERATION_ATTEMPTS,
  type AllLinksListState,
} from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import {
  EventsService,
  type LinkClickStats,
} from '../../events/services/events.service.js';
import {
  FilesService,
  type LinkFilesSummary,
} from '../../files/services/files.service.js';
import { createLinkSchema } from '../dto/in/create-link.dto.js';
import { listAllLinksQuerySchema } from '../dto/in/list-all-links-query.dto.js';
import { listLinksQuerySchema } from '../dto/in/list-links-query.dto.js';
import { linkStatsQuerySchema } from '../dto/in/link-stats-query.dto.js';
import { updateLinkSchema } from '../dto/in/update-link.dto.js';
import type { Link } from '../entities/link.entity.js';
import {
  EMPTY_LINK_ORGANIZATION,
  type AllLinkSummary,
  type ResolvedOrganization,
} from '../link-organization.js';
import type { LinkCheckRepository } from '../persistence/link-check.repository.js';
import type { RedirectView } from '../redirect-view.js';
import type {
  LinkRepository,
  NewLink,
} from '../persistence/link.repository.js';
import { LinkOrganizationService } from './link-organization.service.js';

const REDIRECT = 'redirect';
const NO_FILES: LinkFilesSummary = { fileCount: 0, totalSize: 0 };

function unifiedState(
  link: Link,
  usage: LinkFilesSummary,
  now: Date,
): AllLinksListState {
  if (link.disabled) return 'disabled';
  switch (link.type) {
    case 'drop': {
      const state = dropState(link, usage, now);
      return state === 'open' ? 'active' : state;
    }
    case 'share':
      return isLinkUsedUp(link, now) ? 'expired' : 'active';
    default:
      return isLinkExpired(link, now) ? 'expired' : 'active';
  }
}

export interface LinkStats {
  link: Link;
  days: number;
  clicks: LinkClickStats;
}

@Injectable()
export class LinksService {
  constructor(
    @Inject('LinksRepository')
    private readonly repository: LinkRepository,
    @Inject('LinkChecksRepository')
    private readonly checks: LinkCheckRepository,
    private readonly auditLog: AuditLogService,
    private readonly events: EventsService,
    private readonly organization: LinkOrganizationService,
    private readonly files: FilesService,
  ) {}

  async list(query: unknown): Promise<ListPage<RedirectView>> {
    const parsed = parseDto(listLinksQuerySchema, query);
    const { items: links, total } = await this.repository.findPage(
      parsed,
      new Date(),
    );
    const organizations = await this.organization.loadFor(links);
    const checks = new Map(
      (await this.checks.findByLinkIds(links.map(({ id }) => id))).map(
        (check) => [check.linkId, check],
      ),
    );
    return {
      items: links.map((link) => ({
        link,
        organization: organizations.get(link.id) ?? EMPTY_LINK_ORGANIZATION,
        check: checks.get(link.id) ?? null,
      })),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  async listAll(query: unknown): Promise<ListPage<AllLinkSummary>> {
    const parsed = parseDto(listAllLinksQuerySchema, query);
    const now = new Date();
    const { items: links, total } = await this.repository.findAllPage(
      parsed,
      now,
    );
    const dropIds = links
      .filter((link) => link.type === 'drop')
      .map((link) => link.id);
    const [organizations, usages] = await Promise.all([
      this.organization.loadFor(links),
      dropIds.length
        ? this.files.summarizeCountedLinks(dropIds)
        : Promise.resolve(new Map<string, LinkFilesSummary>()),
    ]);
    return {
      items: links.map((link) => ({
        link,
        organization: organizations.get(link.id) ?? EMPTY_LINK_ORGANIZATION,
        state: unifiedState(link, usages.get(link.id) ?? NO_FILES, now),
      })),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  async detail(publicId: string): Promise<RedirectView> {
    const link = await this.get(publicId);
    return this.view(link);
  }

  health(): Promise<number> {
    return this.checks.countBrokenRedirects(LINK_CHECK_BROKEN_AFTER);
  }

  listDueForCheck(limit: number): Promise<Link[]> {
    return this.repository.findRedirectsDueForCheck(limit);
  }

  async get(publicId: string): Promise<Link> {
    if (!isWellFormedLinkId(publicId)) {
      throw new LinkNotFoundException();
    }
    const link = await this.repository.findByPublicId(publicId);
    if (!link || link.type !== REDIRECT) {
      throw new LinkNotFoundException();
    }
    return link;
  }

  async stats(publicId: string, query: unknown): Promise<LinkStats> {
    const { days } = parseDto(linkStatsQuerySchema, query);
    const link = await this.get(publicId);
    return { link, days, clicks: await this.events.clickStats(link.id, days) };
  }

  async resolveRedirect(publicId: string, visitor: Visitor): Promise<string> {
    const link = await this.get(publicId);
    if (link.disabled || !link.destination) {
      throw new LinkNotFoundException();
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new LinkExpiredException();
    }
    void this.events.recordClick(link.id, visitor);
    return link.destination;
  }

  async create(input: unknown, userId: string): Promise<RedirectView> {
    const dto = parseDto(createLinkSchema, input);
    const organization = await this.organization.resolve(dto);
    const fields = {
      type: REDIRECT,
      destination: dto.destination,
      expiresAt: dto.expiresAt ?? null,
    } as const;
    const link = dto.slug
      ? await this.repository.insert(
          { ...fields, publicId: dto.slug },
          organization,
        )
      : await this.insertWithGeneratedId(fields, organization);
    await this.auditLog.record({
      action: 'links.created',
      userId,
      targetId: link.publicId,
      metadata: {
        destination: link.destination,
        expiresAt: link.expiresAt,
        tagIds: dto.tagIds ?? [],
        folderId: dto.folderId ?? null,
      },
    });
    return {
      link,
      organization: await this.organization.loadOne(link),
      check: null,
    };
  }

  async update(
    publicId: string,
    input: unknown,
    userId: string,
  ): Promise<RedirectView> {
    const dto = parseDto(updateLinkSchema, input);
    const link = await this.get(publicId);
    const organization = await this.organization.resolve(dto);
    if (dto.slug !== undefined) link.publicId = dto.slug;
    const destinationChanged =
      dto.destination !== undefined && dto.destination !== link.destination;
    if (dto.destination !== undefined) link.destination = dto.destination;
    if (dto.expiresAt !== undefined) link.expiresAt = dto.expiresAt;
    if (dto.disabled !== undefined) link.disabled = dto.disabled;
    const saved = destinationChanged
      ? await this.repository.saveWithCheckReset(link, organization)
      : await this.repository.save(link, organization);
    await this.auditLog.record({
      action: 'links.updated',
      userId,
      targetId: saved.publicId,
      metadata: { previousId: publicId, changes: dto },
    });
    return this.view(saved);
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

  private async view(link: Link): Promise<RedirectView> {
    const [organization, [check = null]] = await Promise.all([
      this.organization.loadOne(link),
      this.checks.findByLinkIds([link.id]),
    ]);
    return { link, organization, check };
  }

  private async insertWithGeneratedId(
    fields: Omit<NewLink, 'publicId'>,
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
