import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { TagNameAlreadyTakenException } from '../../common/exceptions/tags/tag-name-already-taken.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { TagPublicIdTakenException } from '../../common/exceptions/tags/tag-public-id-taken.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  DEFAULT_TAG_COLOR,
  PUBLIC_ID_GENERATION_ATTEMPTS,
  TAG_NAME_MAX_LENGTH,
} from '../../common/variables.global.js';
import type { Tag } from '../entities/tag.entity.js';
import type { NewTag, TagRepository } from '../persistence/tag.repository.js';
import { TagsMapper } from '../mapper/tags.mapper.js';
import { TagsService } from './tags.service.js';

const USER_ID = 'user-1';

function buildTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'internal-uuid',
    publicId: 'abc123',
    name: 'Work',
    nameKey: 'work',
    color: '#112233',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TagsService', () => {
  let repository: {
    listWithLinkCounts: ReturnType<typeof vi.fn>;
    countLinks: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    findByNameKey: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: TagsService;

  beforeEach(() => {
    repository = {
      listWithLinkCounts: vi.fn().mockResolvedValue([]),
      countLinks: vi.fn().mockResolvedValue(3),
      findByPublicId: vi.fn().mockResolvedValue(null),
      findByNameKey: vi.fn().mockResolvedValue(null),
      insert: vi.fn((tag: NewTag) => Promise.resolve(buildTag(tag))),
      save: vi.fn((tag: Tag) => Promise.resolve(tag)),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new TagsService(
      repository as unknown as TagRepository,
      audit as unknown as AuditLogService,
    );
  });

  describe('list', () => {
    it('returns the repository entries', async () => {
      const entries = [{ tag: buildTag(), linkCount: 2 }];
      repository.listWithLinkCounts.mockResolvedValue(entries);

      await expect(service.list()).resolves.toBe(entries);
    });
  });

  describe('create', () => {
    it('uses the default colour, trims the name and audits', async () => {
      const { tag, linkCount } = await service.create(
        { name: '  Work  ' },
        USER_ID,
      );

      const [inserted] = repository.insert.mock.calls[0] as [NewTag];
      expect(inserted).toMatchObject({
        name: 'Work',
        color: DEFAULT_TAG_COLOR,
      });
      expect(linkCount).toBe(0);
      expect(audit.record).toHaveBeenCalledWith({
        action: 'tags.created',
        userId: USER_ID,
        targetId: tag.publicId,
        metadata: { name: 'Work', color: DEFAULT_TAG_COLOR },
      });
    });

    it('lowercases the colour', async () => {
      await service.create({ name: 'Work', color: '#AABBCC' }, USER_ID);

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ color: '#aabbcc' }),
      );
    });

    it('normalises the name to NFC', async () => {
      await service.create({ name: 'Café' }, USER_ID);

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Café' }),
      );
    });

    it.each([
      ['a control character', { name: 'a\u0007b' }],
      ['an empty name', { name: '   ' }],
      ['a missing name', {}],
      ['a too long name', { name: 'a'.repeat(TAG_NAME_MAX_LENGTH + 1) }],
      ['a bad colour', { name: 'Work', color: 'red' }],
      ['a short colour', { name: 'Work', color: '#abc' }],
      ['an unknown key', { name: 'Work', extra: true }],
    ])('rejects %s', async (_label, body) => {
      await expect(service.create(body, USER_ID)).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('accepts a name of the maximum length', async () => {
      await expect(
        service.create({ name: 'a'.repeat(TAG_NAME_MAX_LENGTH) }, USER_ID),
      ).resolves.toBeDefined();
    });

    it('answers 409 when the name is already taken', async () => {
      repository.findByNameKey.mockResolvedValue(buildTag());

      await expect(
        service.create({ name: 'work' }, USER_ID),
      ).rejects.toBeInstanceOf(TagNameAlreadyTakenException);
      expect(repository.insert).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
    describe('name uniqueness', () => {
      beforeEach(() => {
        const stored = new Map<string, Tag>();
        repository.findByNameKey.mockImplementation(
          (key: string) => stored.get(key) ?? null,
        );
        repository.insert.mockImplementation((newTag: NewTag) => {
          const tag = buildTag(newTag);
          stored.set(newTag.nameKey, tag);
          return tag;
        });
      });

      it('rejects a name that differs only by case', async () => {
        await service.create({ name: 'Café' }, USER_ID);

        await expect(
          service.create({ name: 'café' }, USER_ID),
        ).rejects.toBeInstanceOf(TagNameAlreadyTakenException);
      });

      it('allows a name that differs by an accent', async () => {
        await service.create({ name: 'café' }, USER_ID);

        await expect(
          service.create({ name: 'cafe' }, USER_ID),
        ).resolves.toBeDefined();
      });

      it('allows two different emoji names', async () => {
        await service.create({ name: '🔥' }, USER_ID);
        await service.create({ name: '🎉' }, USER_ID);
        await service.create({ name: 'Projets 🔥' }, USER_ID);

        await expect(
          service.create({ name: 'Projets 🎉' }, USER_ID),
        ).resolves.toBeDefined();
      });
    });

    it('answers 409 when the database reports the name duplicate', async () => {
      repository.insert.mockRejectedValue(new TagNameAlreadyTakenException());

      await expect(
        service.create({ name: 'Work' }, USER_ID),
      ).rejects.toBeInstanceOf(TagNameAlreadyTakenException);
    });

    it('retries a generated public id collision', async () => {
      repository.insert
        .mockRejectedValueOnce(new TagPublicIdTakenException())
        .mockResolvedValue(buildTag());

      await service.create({ name: 'Work' }, USER_ID);

      expect(repository.insert).toHaveBeenCalledTimes(2);
    });

    it('gives up after the allowed attempts', async () => {
      repository.insert.mockRejectedValue(new TagPublicIdTakenException());

      await expect(
        service.create({ name: 'Work' }, USER_ID),
      ).rejects.toBeInstanceOf(TagPublicIdTakenException);
      expect(repository.insert).toHaveBeenCalledTimes(
        PUBLIC_ID_GENERATION_ATTEMPTS,
      );
    });
  });

  describe('update', () => {
    it('answers 404 on a malformed id without touching the repository', async () => {
      await expect(
        service.update('bad id!', { name: 'X' }, USER_ID),
      ).rejects.toBeInstanceOf(TagNotFoundException);
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown tag', async () => {
      await expect(
        service.update('abc123', { name: 'X' }, USER_ID),
      ).rejects.toBeInstanceOf(TagNotFoundException);
    });

    it('rejects an empty body', async () => {
      await expect(
        service.update('abc123', {}, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('answers 409 when another tag has the name', async () => {
      repository.findByPublicId.mockResolvedValue(buildTag());
      repository.findByNameKey.mockResolvedValue(
        buildTag({
          id: 'other',
          publicId: 'zzz',
          name: 'Home',
          nameKey: 'home',
        }),
      );

      await expect(
        service.update('abc123', { name: 'home' }, USER_ID),
      ).rejects.toBeInstanceOf(TagNameAlreadyTakenException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows recasing the tag own name', async () => {
      const tag = buildTag();
      repository.findByPublicId.mockResolvedValue(tag);
      repository.findByNameKey.mockResolvedValue(tag);

      const result = await service.update('abc123', { name: 'WORK' }, USER_ID);

      expect(result.tag.name).toBe('WORK');
      expect(result.tag.nameKey).toBe('work');
      expect(result.linkCount).toBe(3);
    });

    it('stores the new name key when renaming', async () => {
      repository.findByPublicId.mockResolvedValue(buildTag());

      await service.update('abc123', { name: 'Home' }, USER_ID);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Home', nameKey: 'home' }),
      );
    });

    it('saves only the changed fields and audits them', async () => {
      repository.findByPublicId.mockResolvedValue(buildTag());

      await service.update(
        'abc123',
        { name: 'Work', color: '#FFFFFF' },
        USER_ID,
      );

      expect(repository.findByNameKey).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith({
        action: 'tags.updated',
        userId: USER_ID,
        targetId: 'abc123',
        metadata: { color: '#ffffff' },
      });
    });
  });

  describe('remove', () => {
    it('answers 404 on a malformed id without touching the repository', async () => {
      await expect(service.remove('bad id!', USER_ID)).rejects.toBeInstanceOf(
        TagNotFoundException,
      );
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown tag', async () => {
      await expect(service.remove('abc123', USER_ID)).rejects.toBeInstanceOf(
        TagNotFoundException,
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('deletes the tag and audits it', async () => {
      const tag = buildTag();
      repository.findByPublicId.mockResolvedValue(tag);

      await service.remove('abc123', USER_ID);

      expect(repository.remove).toHaveBeenCalledWith(tag);
      expect(audit.record).toHaveBeenCalledWith({
        action: 'tags.deleted',
        userId: USER_ID,
        targetId: 'abc123',
        metadata: { name: 'Work' },
      });
    });
  });

  describe('mapper', () => {
    it('never exposes the internal uuid', () => {
      const { data } = TagsMapper.toResponse({
        tag: buildTag(),
        linkCount: 2,
      });

      expect(data).toEqual({
        id: 'abc123',
        name: 'Work',
        color: '#112233',
        linkCount: 2,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      });
      expect(JSON.stringify(data)).not.toContain('internal-uuid');
    });
  });
});
