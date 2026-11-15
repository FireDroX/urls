import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import type { Folder } from '../../folders/entities/folder.entity.js';
import type { FoldersService } from '../../folders/services/folders.service.js';
import type { Tag } from '../../tags/entities/tag.entity.js';
import type { TagsService } from '../../tags/services/tags.service.js';
import type { Link } from '../entities/link.entity.js';
import { EMPTY_LINK_ORGANIZATION } from '../link-organization.js';
import type { LinkOrganizationRepository } from '../persistence/link-organization.repository.js';
import { LinkOrganizationService } from './link-organization.service.js';

function link(id: string, folderId: string | null = null): Link {
  return { id, folderId } as Link;
}

describe('LinkOrganizationService', () => {
  let repository: {
    findTagsByLinkIds: ReturnType<typeof vi.fn>;
    findFoldersByIds: ReturnType<typeof vi.fn>;
  };
  let tags: { findAllByPublicIds: ReturnType<typeof vi.fn> };
  let folders: { findByPublicId: ReturnType<typeof vi.fn> };
  let service: LinkOrganizationService;

  beforeEach(() => {
    repository = {
      findTagsByLinkIds: vi.fn().mockResolvedValue(new Map()),
      findFoldersByIds: vi.fn().mockResolvedValue(new Map()),
    };
    tags = { findAllByPublicIds: vi.fn().mockResolvedValue([]) };
    folders = { findByPublicId: vi.fn() };
    service = new LinkOrganizationService(
      repository as unknown as LinkOrganizationRepository,
      tags as unknown as TagsService,
      folders as unknown as FoldersService,
    );
  });

  describe('resolve', () => {
    it('leaves absent fields undefined without any lookup', async () => {
      await expect(service.resolve({})).resolves.toEqual({});
      expect(tags.findAllByPublicIds).not.toHaveBeenCalled();
      expect(folders.findByPublicId).not.toHaveBeenCalled();
    });

    it('turns public ids into internal ids', async () => {
      tags.findAllByPublicIds.mockResolvedValue([
        { id: 't1' } as Tag,
        { id: 't2' } as Tag,
      ]);
      folders.findByPublicId.mockResolvedValue({ id: 'f1' });

      await expect(
        service.resolve({ tagIds: ['a', 'b'], folderId: 'fp' }),
      ).resolves.toEqual({ tagIds: ['t1', 't2'], folderId: 'f1' });
    });

    it('resolves an empty list and a null folder without lookups', async () => {
      await expect(
        service.resolve({ tagIds: [], folderId: null }),
      ).resolves.toEqual({ tagIds: [], folderId: null });
      expect(folders.findByPublicId).not.toHaveBeenCalled();
    });

    it('lets unknown tags and folders through as 404s', async () => {
      tags.findAllByPublicIds.mockRejectedValue(new TagNotFoundException());
      await expect(service.resolve({ tagIds: ['x'] })).rejects.toBeInstanceOf(
        TagNotFoundException,
      );

      folders.findByPublicId.mockRejectedValue(new FolderNotFoundException());
      await expect(service.resolve({ folderId: 'x' })).rejects.toBeInstanceOf(
        FolderNotFoundException,
      );
    });
  });

  describe('loadFor', () => {
    it('loads tags and folders of many links in one query each', async () => {
      const tag = { publicId: 't' } as Tag;
      const folder = { id: 'f1', publicId: 'fp' } as Folder;
      repository.findTagsByLinkIds.mockResolvedValue(new Map([['a', [tag]]]));
      repository.findFoldersByIds.mockResolvedValue(new Map([['f1', folder]]));

      const loaded = await service.loadFor([
        link('a', 'f1'),
        link('b', 'f1'),
        link('c'),
      ]);

      expect(repository.findTagsByLinkIds).toHaveBeenCalledTimes(1);
      expect(repository.findTagsByLinkIds).toHaveBeenCalledWith([
        'a',
        'b',
        'c',
      ]);
      expect(repository.findFoldersByIds).toHaveBeenCalledTimes(1);
      expect(repository.findFoldersByIds).toHaveBeenCalledWith(['f1']);
      expect(loaded.get('a')).toEqual({ tags: [tag], folder });
      expect(loaded.get('b')).toEqual({ tags: [], folder });
      expect(loaded.get('c')).toEqual(EMPTY_LINK_ORGANIZATION);
    });

    it('loads one link through the same path', async () => {
      await expect(service.loadOne(link('a'))).resolves.toEqual(
        EMPTY_LINK_ORGANIZATION,
      );
      expect(repository.findTagsByLinkIds).toHaveBeenCalledWith(['a']);
    });
  });
});
