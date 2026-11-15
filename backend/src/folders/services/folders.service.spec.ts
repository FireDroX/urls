import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { FolderNameAlreadyTakenException } from '../../common/exceptions/folders/folder-name-already-taken.exception.js';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { FolderPublicIdTakenException } from '../../common/exceptions/folders/folder-public-id-taken.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  PUBLIC_ID_GENERATION_ATTEMPTS,
  FOLDER_NAME_MAX_LENGTH,
} from '../../common/variables.global.js';
import type { Folder } from '../entities/folder.entity.js';
import type {
  NewFolder,
  FolderRepository,
} from '../persistence/folder.repository.js';
import { FoldersMapper } from '../mapper/folders.mapper.js';
import { FoldersService } from './folders.service.js';

const USER_ID = 'user-1';

function buildFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'internal-uuid',
    publicId: 'abc123',
    name: 'Work',
    nameKey: 'work',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  };
}

describe('FoldersService', () => {
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
  let service: FoldersService;

  beforeEach(() => {
    repository = {
      listWithLinkCounts: vi.fn().mockResolvedValue([]),
      countLinks: vi.fn().mockResolvedValue(3),
      findByPublicId: vi.fn().mockResolvedValue(null),
      findByNameKey: vi.fn().mockResolvedValue(null),
      insert: vi.fn((folder: NewFolder) =>
        Promise.resolve(buildFolder(folder)),
      ),
      save: vi.fn((folder: Folder) => Promise.resolve(folder)),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new FoldersService(
      repository as unknown as FolderRepository,
      audit as unknown as AuditLogService,
    );
  });

  describe('list', () => {
    it('returns the repository entries', async () => {
      const entries = [{ folder: buildFolder(), linkCount: 2 }];
      repository.listWithLinkCounts.mockResolvedValue(entries);

      await expect(service.list()).resolves.toBe(entries);
    });
  });

  describe('create', () => {
    it('trims the name and audits', async () => {
      const { folder, linkCount } = await service.create(
        { name: '  Work  ' },
        USER_ID,
      );

      const [inserted] = repository.insert.mock.calls[0] as [NewFolder];
      expect(inserted).toMatchObject({ name: 'Work' });
      expect(linkCount).toBe(0);
      expect(audit.record).toHaveBeenCalledWith({
        action: 'folders.created',
        userId: USER_ID,
        targetId: folder.publicId,
        metadata: { name: 'Work' },
      });
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
      ['a too long name', { name: 'a'.repeat(FOLDER_NAME_MAX_LENGTH + 1) }],
      ['an unknown key', { name: 'Work', extra: true }],
    ])('rejects %s', async (_label, body) => {
      await expect(service.create(body, USER_ID)).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('accepts a name of the maximum length', async () => {
      await expect(
        service.create({ name: 'a'.repeat(FOLDER_NAME_MAX_LENGTH) }, USER_ID),
      ).resolves.toBeDefined();
    });

    it('answers 409 when the name is already taken', async () => {
      repository.findByNameKey.mockResolvedValue(buildFolder());

      await expect(
        service.create({ name: 'work' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderNameAlreadyTakenException);
      expect(repository.insert).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
    describe('name uniqueness', () => {
      beforeEach(() => {
        const stored = new Map<string, Folder>();
        repository.findByNameKey.mockImplementation(
          (key: string) => stored.get(key) ?? null,
        );
        repository.insert.mockImplementation((newFolder: NewFolder) => {
          const folder = buildFolder(newFolder);
          stored.set(newFolder.nameKey, folder);
          return folder;
        });
      });

      it('rejects a name that differs only by case', async () => {
        await service.create({ name: 'Café' }, USER_ID);

        await expect(
          service.create({ name: 'café' }, USER_ID),
        ).rejects.toBeInstanceOf(FolderNameAlreadyTakenException);
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
      repository.insert.mockRejectedValue(
        new FolderNameAlreadyTakenException(),
      );

      await expect(
        service.create({ name: 'Work' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderNameAlreadyTakenException);
    });

    it('retries a generated public id collision', async () => {
      repository.insert
        .mockRejectedValueOnce(new FolderPublicIdTakenException())
        .mockResolvedValue(buildFolder());

      await service.create({ name: 'Work' }, USER_ID);

      expect(repository.insert).toHaveBeenCalledTimes(2);
    });

    it('gives up after the allowed attempts', async () => {
      repository.insert.mockRejectedValue(new FolderPublicIdTakenException());

      await expect(
        service.create({ name: 'Work' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderPublicIdTakenException);
      expect(repository.insert).toHaveBeenCalledTimes(
        PUBLIC_ID_GENERATION_ATTEMPTS,
      );
    });
  });

  describe('update', () => {
    it('answers 404 on a malformed id without touching the repository', async () => {
      await expect(
        service.update('bad id!', { name: 'X' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderNotFoundException);
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown folder', async () => {
      await expect(
        service.update('abc123', { name: 'X' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderNotFoundException);
    });

    it('rejects an empty body', async () => {
      await expect(
        service.update('abc123', {}, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('answers 409 when another folder has the name', async () => {
      repository.findByPublicId.mockResolvedValue(buildFolder());
      repository.findByNameKey.mockResolvedValue(
        buildFolder({
          id: 'other',
          publicId: 'zzz',
          name: 'Home',
          nameKey: 'home',
        }),
      );

      await expect(
        service.update('abc123', { name: 'home' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderNameAlreadyTakenException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows recasing the folder own name', async () => {
      const folder = buildFolder();
      repository.findByPublicId.mockResolvedValue(folder);
      repository.findByNameKey.mockResolvedValue(folder);

      const result = await service.update('abc123', { name: 'WORK' }, USER_ID);

      expect(result.folder.name).toBe('WORK');
      expect(result.folder.nameKey).toBe('work');
      expect(result.linkCount).toBe(3);
    });

    it('stores the new name key when renaming', async () => {
      repository.findByPublicId.mockResolvedValue(buildFolder());

      await service.update('abc123', { name: 'Home' }, USER_ID);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Home', nameKey: 'home' }),
      );
    });

    it('does not look the name up when it is unchanged', async () => {
      repository.findByPublicId.mockResolvedValue(buildFolder());

      await service.update('abc123', { name: 'Work' }, USER_ID);

      expect(repository.findByNameKey).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith({
        action: 'folders.updated',
        userId: USER_ID,
        targetId: 'abc123',
        metadata: {},
      });
    });

    it('audits the new name', async () => {
      repository.findByPublicId.mockResolvedValue(buildFolder());

      await service.update('abc123', { name: 'Home' }, USER_ID);

      expect(audit.record).toHaveBeenCalledWith({
        action: 'folders.updated',
        userId: USER_ID,
        targetId: 'abc123',
        metadata: { name: 'Home' },
      });
    });

    it('answers 409 when the database reports the name duplicate', async () => {
      repository.findByPublicId.mockResolvedValue(buildFolder());
      repository.save.mockRejectedValue(new FolderNameAlreadyTakenException());

      await expect(
        service.update('abc123', { name: 'Home' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderNameAlreadyTakenException);
    });
  });

  describe('remove', () => {
    it('answers 404 on a malformed id without touching the repository', async () => {
      await expect(service.remove('bad id!', USER_ID)).rejects.toBeInstanceOf(
        FolderNotFoundException,
      );
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown folder', async () => {
      await expect(service.remove('abc123', USER_ID)).rejects.toBeInstanceOf(
        FolderNotFoundException,
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('deletes the folder and audits it', async () => {
      const folder = buildFolder();
      repository.findByPublicId.mockResolvedValue(folder);

      await service.remove('abc123', USER_ID);

      expect(repository.remove).toHaveBeenCalledWith(folder);
      expect(audit.record).toHaveBeenCalledWith({
        action: 'folders.deleted',
        userId: USER_ID,
        targetId: 'abc123',
        metadata: { name: 'Work' },
      });
    });
  });

  describe('mapper', () => {
    it('never exposes the internal uuid', () => {
      const { data } = FoldersMapper.toResponse({
        folder: buildFolder(),
        linkCount: 2,
      });

      expect(data).toEqual({
        id: 'abc123',
        name: 'Work',
        linkCount: 2,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      });
      expect(JSON.stringify(data)).not.toContain('internal-uuid');
    });
  });
});
