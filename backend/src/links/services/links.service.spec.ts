import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { LinkExpiredException } from '../../common/exceptions/links/link-expired.exception.js';
import { LinkNotFoundException } from '../../common/exceptions/links/link-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  LINK_CHECK_BROKEN_AFTER,
  LINK_DESTINATION_MAX_LENGTH,
  LINK_SLUG_MAX_LENGTH,
  PUBLIC_ID_GENERATION_ATTEMPTS,
  LINK_STATS_DEFAULT_DAYS,
  LINK_STATS_MAX_DAYS,
  LINK_STATS_MIN_DAYS,
  PUBLIC_ID_LENGTH,
} from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import type {
  EventsService,
  LinkClickStats,
} from '../../events/services/events.service.js';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import type { LinkCheck } from '../entities/link-check.entity.js';
import type { Link } from '../entities/link.entity.js';
import { EMPTY_LINK_ORGANIZATION } from '../link-organization.js';
import type {
  LinkRepository,
  NewLink,
} from '../persistence/link.repository.js';
import type { LinkCheckRepository } from '../persistence/link-check.repository.js';
import type { LinkOrganizationService } from './link-organization.service.js';
import { LinksService } from './links.service.js';

const USER_ID = 'user-1';
const FUTURE = '2999-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';
const VISITOR: Visitor = {
  ip: '203.0.113.9',
  referer: 'https://news.example/post',
  userAgent: 'Mozilla/5.0',
  country: 'FR',
};

const CLICK_STATS: LinkClickStats = {
  since: '2026-10-27',
  total: 0,
  daily: [],
  refererHosts: [],
  countries: [],
};

function buildLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'internal-uuid',
    publicId: 'abc123',
    type: 'redirect',
    destination: 'https://example.com/',
    expiresAt: null,
    maxDownloads: null,
    downloadCount: 0,
    title: null,
    maxTotalBytes: null,
    maxFiles: null,
    folderId: null,
    disabled: false,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('LinksService', () => {
  let repository: {
    findPage: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    saveWithCheckReset: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let organization: {
    resolve: ReturnType<typeof vi.fn>;
    loadFor: ReturnType<typeof vi.fn>;
    loadOne: ReturnType<typeof vi.fn>;
  };
  let checks: {
    findByLinkIds: ReturnType<typeof vi.fn>;
    countBrokenRedirects: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let events: {
    recordClick: ReturnType<typeof vi.fn>;
    clickStats: ReturnType<typeof vi.fn>;
  };
  let service: LinksService;

  beforeEach(() => {
    repository = {
      findPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      findByPublicId: vi.fn().mockResolvedValue(null),
      insert: vi.fn((link: NewLink) => Promise.resolve(buildLink(link))),
      save: vi.fn((link: Link) => Promise.resolve(link)),
      saveWithCheckReset: vi.fn((link: Link) => Promise.resolve(link)),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    organization = {
      resolve: vi.fn().mockResolvedValue({}),
      loadFor: vi.fn().mockResolvedValue(new Map()),
      loadOne: vi.fn().mockResolvedValue(EMPTY_LINK_ORGANIZATION),
    };
    checks = {
      findByLinkIds: vi.fn().mockResolvedValue([]),
      countBrokenRedirects: vi.fn().mockResolvedValue(0),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    events = {
      recordClick: vi.fn().mockResolvedValue(undefined),
      clickStats: vi.fn().mockResolvedValue(CLICK_STATS),
    };
    service = new LinksService(
      repository as unknown as LinkRepository,
      checks as unknown as LinkCheckRepository,
      audit as unknown as AuditLogService,
      events as unknown as EventsService,
      organization as unknown as LinkOrganizationService,
    );
  });

  describe('create', () => {
    it('creates a redirect with a generated public id and audits it', async () => {
      const { link } = await service.create(
        { destination: 'https://example.com/page' },
        USER_ID,
      );

      const [inserted] = repository.insert.mock.calls[0] as [NewLink];
      expect(inserted).toMatchObject({
        type: 'redirect',
        destination: 'https://example.com/page',
        expiresAt: null,
      });
      expect(inserted.publicId).toMatch(
        new RegExp(`^[0-9A-Za-z]{${PUBLIC_ID_LENGTH}}$`),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'links.created',
          userId: USER_ID,
          targetId: link.publicId,
        }),
      );
    });

    it('uses the chosen slug and expiration', async () => {
      await service.create(
        {
          destination: 'http://example.com',
          slug: 'my-Link_1',
          expiresAt: FUTURE,
        },
        USER_ID,
      );

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          publicId: 'my-Link_1',
          destination: 'http://example.com/',
          expiresAt: new Date(FUTURE),
        }),
        {},
      );
    });

    it('retries when a generated id collides', async () => {
      repository.insert
        .mockRejectedValueOnce(new SlugAlreadyTakenException())
        .mockResolvedValueOnce(buildLink());

      await service.create({ destination: 'https://example.com' }, USER_ID);

      expect(repository.insert).toHaveBeenCalledTimes(2);
    });

    it('gives up after the maximum number of generated id collisions', async () => {
      repository.insert.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(
        service.create({ destination: 'https://example.com' }, USER_ID),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(repository.insert).toHaveBeenCalledTimes(
        PUBLIC_ID_GENERATION_ATTEMPTS,
      );
    });

    it('rejects a chosen slug that is already taken without retrying', async () => {
      repository.insert.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(
        service.create(
          { destination: 'https://example.com', slug: 'taken' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(repository.insert).toHaveBeenCalledTimes(1);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it.each([
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/file',
      'example.com',
      '',
      `https://example.com/${'a'.repeat(LINK_DESTINATION_MAX_LENGTH)}`,
    ])('rejects the destination %s', async (destination) => {
      await expect(
        service.create({ destination }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it.each([
      'ab',
      'a'.repeat(65),
      'with space',
      'slash/slug',
      'émoji',
      'api',
      'Login',
      'R',
    ])('rejects the slug %s', async (slug) => {
      await expect(
        service.create({ destination: 'https://example.com', slug }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it.each(['2000-01-01T00:00:00Z', 'tomorrow', '2999-01-01'])(
      'rejects the expiration %s',
      async (expiresAt) => {
        await expect(
          service.create(
            { destination: 'https://example.com', expiresAt },
            USER_ID,
          ),
        ).rejects.toBeInstanceOf(ValidationException);
      },
    );

    it('rejects unknown fields', async () => {
      await expect(
        service.create(
          { destination: 'https://example.com', type: 'share' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('get', () => {
    it('returns an existing redirect', async () => {
      const link = buildLink();
      repository.findByPublicId.mockResolvedValue(link);

      await expect(service.get('abc123')).resolves.toBe(link);
    });

    it('throws when the link does not exist', async () => {
      await expect(service.get('missing')).rejects.toBeInstanceOf(
        LinkNotFoundException,
      );
    });

    it('throws for a link of another type', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildLink({ type: 'share', destination: null }),
      );

      await expect(service.get('abc123')).rejects.toBeInstanceOf(
        LinkNotFoundException,
      );
    });

    it.each(['a'.repeat(65), 'bad/id', '../etc'])(
      'throws for the malformed id %s without querying',
      async (id) => {
        await expect(service.get(id)).rejects.toBeInstanceOf(
          LinkNotFoundException,
        );
        expect(repository.findByPublicId).not.toHaveBeenCalled();
      },
    );
  });

  describe('tags and folder', () => {
    it('creates with tags and a folder resolved before the insert and audits public ids', async () => {
      organization.resolve.mockResolvedValue({
        tagIds: ['tag-uuid'],
        folderId: 'folder-uuid',
      });

      await service.create(
        {
          destination: 'https://example.com',
          tagIds: ['tagpub'],
          folderId: 'folderpub',
        },
        USER_ID,
      );

      expect(organization.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ tagIds: ['tagpub'], folderId: 'folderpub' }),
      );
      expect(repository.insert).toHaveBeenCalledWith(expect.anything(), {
        tagIds: ['tag-uuid'],
        folderId: 'folder-uuid',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tagIds: ['tagpub'],
            folderId: 'folderpub',
          }) as unknown,
        }),
      );
    });

    it('audits empty tags and no folder when none is given', async () => {
      await service.create({ destination: 'https://example.com' }, USER_ID);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tagIds: [],
            folderId: null,
          }) as unknown,
        }),
      );
    });

    it('does not insert when a tag is unknown', async () => {
      organization.resolve.mockRejectedValue(new TagNotFoundException());

      await expect(
        service.create(
          { destination: 'https://example.com', tagIds: ['nope'] },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(TagNotFoundException);
      expect(repository.insert).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('does not insert when the folder is unknown', async () => {
      organization.resolve.mockRejectedValue(new FolderNotFoundException());

      await expect(
        service.create(
          { destination: 'https://example.com', folderId: 'nope' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(FolderNotFoundException);
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('replaces the tags and leaves the folder on update', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());
      organization.resolve.mockResolvedValue({
        tagIds: ['t1', 't2'],
        folderId: null,
      });

      await service.update(
        'abc123',
        { tagIds: ['a', 'b'], folderId: null },
        USER_ID,
      );

      expect(repository.save).toHaveBeenCalledWith(expect.anything(), {
        tagIds: ['t1', 't2'],
        folderId: null,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            changes: { tagIds: ['a', 'b'], folderId: null },
          }) as unknown,
        }),
      );
    });

    it('leaves tags and folder unchanged when absent from the update', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());

      await service.update('abc123', { disabled: true }, USER_ID);

      const [input] = organization.resolve.mock.calls[0] as [object];
      expect(input).not.toHaveProperty('tagIds');
      expect(repository.save).toHaveBeenCalledWith(expect.anything(), {});
    });

    it('does not save when the update names an unknown tag', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());
      organization.resolve.mockRejectedValue(new TagNotFoundException());

      await expect(
        service.update('abc123', { tagIds: ['nope'] }, USER_ID),
      ).rejects.toBeInstanceOf(TagNotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('loads the organization of a whole list in one call', async () => {
      const links = [buildLink(), buildLink({ id: 'other', publicId: 'zzz' })];
      repository.findPage.mockResolvedValue({ items: links, total: 2 });

      const { items: result } = await service.list({});

      expect(organization.loadFor).toHaveBeenCalledTimes(1);
      expect(organization.loadFor).toHaveBeenCalledWith(links);
      expect(organization.loadOne).not.toHaveBeenCalled();
      expect(result.map((item) => item.organization)).toEqual([
        EMPTY_LINK_ORGANIZATION,
        EMPTY_LINK_ORGANIZATION,
      ]);
    });

    it('loads the organization of one link for the detail', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());

      await service.detail('abc123');

      expect(organization.loadOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('health', () => {
    const check = { linkId: 'internal-uuid', outcome: 'broken' } as LinkCheck;

    it('loads the checks of a whole page in one query', async () => {
      const links = [buildLink(), buildLink({ id: 'other', publicId: 'zzz' })];
      repository.findPage.mockResolvedValue({ items: links, total: 2 });
      checks.findByLinkIds.mockResolvedValue([check]);

      const { items } = await service.list({});

      expect(checks.findByLinkIds).toHaveBeenCalledTimes(1);
      expect(checks.findByLinkIds).toHaveBeenCalledWith([
        'internal-uuid',
        'other',
      ]);
      expect(items.map((item) => item.check)).toEqual([check, null]);
    });

    it('passes the health filter to the repository', async () => {
      await service.list({ health: 'broken' });

      expect(repository.findPage).toHaveBeenCalledWith(
        expect.objectContaining({ health: 'broken' }),
        expect.any(Date),
      );
    });

    it('rejects an unknown health filter without reading', async () => {
      await expect(service.list({ health: 'sick' })).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repository.findPage).not.toHaveBeenCalled();
    });

    it('returns the check of the detail', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());
      checks.findByLinkIds.mockResolvedValue([check]);

      expect((await service.detail('abc123')).check).toBe(check);
    });

    it('returns no check for a redirect never checked', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());

      expect((await service.detail('abc123')).check).toBeNull();
    });

    it('returns no check right after the creation', async () => {
      const created = await service.create(
        { destination: 'https://example.com' },
        USER_ID,
      );

      expect(created.check).toBeNull();
      expect(checks.findByLinkIds).not.toHaveBeenCalled();
    });

    it('reads the check back after an update', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());
      checks.findByLinkIds.mockResolvedValue([check]);

      const updated = await service.update(
        'abc123',
        { disabled: true },
        USER_ID,
      );

      expect(updated.check).toBe(check);
    });

    it('counts the broken redirects with the threshold', async () => {
      checks.countBrokenRedirects.mockResolvedValue(3);

      expect(await service.health()).toBe(3);
      expect(checks.countBrokenRedirects).toHaveBeenCalledWith(
        LINK_CHECK_BROKEN_AFTER,
      );
    });
  });

  describe('list', () => {
    it('returns the page with its total and the defaults', async () => {
      repository.findPage.mockResolvedValue({
        items: [buildLink()],
        total: 12,
      });

      const result = await service.list({});

      expect(result).toMatchObject({ total: 12, page: 1, pageSize: 50 });
      expect(result.items).toHaveLength(1);
    });

    it('passes the parsed query and the current date to the repository', async () => {
      await service.list({ q: 'x', state: 'disabled', page: '3' });

      expect(repository.findPage).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'x',
          state: 'disabled',
          page: 3,
          sort: 'created_desc',
        }),
        expect.any(Date),
      );
    });

    it('rejects an invalid query without reading', async () => {
      await expect(service.list({ page: '0' })).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repository.findPage).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repository.findByPublicId.mockResolvedValue(buildLink());
    });

    it('updates every editable field and audits the change', async () => {
      const { link } = await service.update(
        'abc123',
        {
          destination: 'https://other.example/',
          slug: 'renamed',
          expiresAt: FUTURE,
          disabled: true,
        },
        USER_ID,
      );

      expect(link).toMatchObject({
        publicId: 'renamed',
        destination: 'https://other.example/',
        expiresAt: new Date(FUTURE),
        disabled: true,
      });
      expect(audit.record.mock.calls[0]).toMatchObject([
        {
          action: 'links.updated',
          targetId: 'renamed',
          metadata: { previousId: 'abc123' },
        },
      ]);
    });

    it('drops the previous check when the destination changes', async () => {
      await service.update(
        'abc123',
        { destination: 'https://other.example/' },
        USER_ID,
      );

      expect(repository.saveWithCheckReset).toHaveBeenCalledTimes(1);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('keeps the check when the destination is unchanged or untouched', async () => {
      const { destination } = buildLink();

      await service.update('abc123', { destination }, USER_ID);
      await service.update('abc123', { disabled: true }, USER_ID);

      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(repository.saveWithCheckReset).not.toHaveBeenCalled();
    });

    it('removes the expiration with null', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildLink({ expiresAt: new Date(FUTURE) }),
      );

      const { link } = await service.update(
        'abc123',
        { expiresAt: null },
        USER_ID,
      );

      expect(link.expiresAt).toBeNull();
    });

    it('rejects an empty update', async () => {
      await expect(
        service.update('abc123', {}, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('rejects a slug already taken', async () => {
      repository.save.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(
        service.update('abc123', { slug: 'taken' }, USER_ID),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rejects an invalid destination', async () => {
      await expect(
        service.update(
          'abc123',
          { destination: 'javascript:alert(1)' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws when the link does not exist', async () => {
      repository.findByPublicId.mockResolvedValue(null);

      await expect(
        service.update('missing', { disabled: true }, USER_ID),
      ).rejects.toBeInstanceOf(LinkNotFoundException);
    });
  });

  describe('resolveRedirect', () => {
    it('returns the destination of an active link and records a click', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildLink({ expiresAt: new Date(FUTURE) }),
      );

      await expect(service.resolveRedirect('abc123', VISITOR)).resolves.toBe(
        'https://example.com/',
      );
      expect(events.recordClick).toHaveBeenCalledWith('internal-uuid', VISITOR);
    });

    it('does not wait for the click to be recorded', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());
      events.recordClick.mockReturnValue(new Promise(() => undefined));

      await expect(service.resolveRedirect('abc123', VISITOR)).resolves.toBe(
        'https://example.com/',
      );
    });

    it.each([
      ['missing or deleted', null],
      ['disabled', buildLink({ disabled: true })],
      ['not a redirect', buildLink({ type: 'share', destination: null })],
      ['a drop', buildLink({ type: 'drop' })],
      [
        'disabled and expired',
        buildLink({ disabled: true, expiresAt: new Date(PAST) }),
      ],
    ])('throws the same not found error when %s', async (_case, link) => {
      repository.findByPublicId.mockResolvedValue(link);

      const error = await service
        .resolveRedirect('abc123', VISITOR)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(LinkNotFoundException);
      expect(error).toEqual(new LinkNotFoundException());
      expect(events.recordClick).not.toHaveBeenCalled();
    });

    it('throws a link expired error once expires_at has passed', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildLink({ expiresAt: new Date(PAST) }),
      );

      await expect(
        service.resolveRedirect('abc123', VISITOR),
      ).rejects.toBeInstanceOf(LinkExpiredException);
      expect(events.recordClick).not.toHaveBeenCalled();
    });

    it.each([
      'a'.repeat(LINK_SLUG_MAX_LENGTH + 1),
      'abc.def',
      'abc def',
      '../admin',
      '',
    ])(
      'rejects the malformed id "%s" without querying the database',
      async (id) => {
        await expect(
          service.resolveRedirect(id, VISITOR),
        ).rejects.toBeInstanceOf(LinkNotFoundException);
        expect(repository.findByPublicId).not.toHaveBeenCalled();
        expect(events.recordClick).not.toHaveBeenCalled();
      },
    );
  });

  describe('remove', () => {
    it('soft deletes the link by its internal id and audits it', async () => {
      repository.findByPublicId.mockResolvedValue(buildLink());

      await service.remove('abc123', USER_ID);

      expect(repository.softDelete).toHaveBeenCalledWith('internal-uuid');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'links.deleted',
          targetId: 'abc123',
        }),
      );
    });

    it('throws when the link does not exist', async () => {
      await expect(service.remove('missing', USER_ID)).rejects.toBeInstanceOf(
        LinkNotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    it('returns the click stats of the link over the default window', async () => {
      const link = buildLink();
      repository.findByPublicId.mockResolvedValue(link);

      await expect(service.stats('abc123', {})).resolves.toEqual({
        link,
        days: LINK_STATS_DEFAULT_DAYS,
        clicks: CLICK_STATS,
      });
      expect(events.clickStats).toHaveBeenCalledWith(
        'internal-uuid',
        LINK_STATS_DEFAULT_DAYS,
      );
    });

    it.each([String(LINK_STATS_MIN_DAYS), '7', String(LINK_STATS_MAX_DAYS)])(
      'accepts %s days',
      async (days) => {
        repository.findByPublicId.mockResolvedValue(buildLink());

        const stats = await service.stats('abc123', { days });

        expect(stats.days).toBe(Number(days));
      },
    );

    it.each([
      String(LINK_STATS_MIN_DAYS - 1),
      String(LINK_STATS_MAX_DAYS + 1),
      '-1',
      '1.5',
      'abc',
      '',
      '1e2',
      ['7', '30'],
    ])('rejects %j days with a validation error', async (days) => {
      repository.findByPublicId.mockResolvedValue(buildLink());

      await expect(service.stats('abc123', { days })).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(events.clickStats).not.toHaveBeenCalled();
    });

    it('rejects unknown query parameters', async () => {
      await expect(
        service.stats('abc123', { days: '7', from: '2026-01-01' }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it.each([
      ['missing or deleted', null],
      ['not a redirect', buildLink({ type: 'share', destination: null })],
      ['a drop', buildLink({ type: 'drop' })],
    ])('throws not found for a %s link', async (_label, link) => {
      repository.findByPublicId.mockResolvedValue(link);

      await expect(service.stats('abc123', {})).rejects.toBeInstanceOf(
        LinkNotFoundException,
      );
      expect(events.clickStats).not.toHaveBeenCalled();
    });

    it('still returns the stats of a disabled link', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildLink({ disabled: true }),
      );

      await expect(service.stats('abc123', {})).resolves.toMatchObject({
        clicks: CLICK_STATS,
      });
    });
  });
});
