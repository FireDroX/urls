import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '../../folders/entities/folder.entity.js';
import type { LinkTag } from '../../tags/entities/link-tag.entity.js';
import type { Tag } from '../../tags/entities/tag.entity.js';
import { TypeormLinkOrganizationRepository } from './typeorm.link-organization.repository.js';

describe('TypeormLinkOrganizationRepository', () => {
  let linkTags: { find: ReturnType<typeof vi.fn> };
  let folders: { findBy: ReturnType<typeof vi.fn> };
  let repository: TypeormLinkOrganizationRepository;

  beforeEach(() => {
    linkTags = { find: vi.fn().mockResolvedValue([]) };
    folders = { findBy: vi.fn().mockResolvedValue([]) };
    repository = new TypeormLinkOrganizationRepository(
      linkTags as unknown as Repository<LinkTag>,
      folders as unknown as Repository<Folder>,
    );
  });

  it('groups the tags of many links from a single query ordered by name', async () => {
    const work = { publicId: 'w' } as Tag;
    const home = { publicId: 'h' } as Tag;
    linkTags.find.mockResolvedValue([
      { linkId: 'a', tag: home },
      { linkId: 'a', tag: work },
      { linkId: 'b', tag: work },
    ]);

    const tags = await repository.findTagsByLinkIds(['a', 'b']);

    expect(linkTags.find).toHaveBeenCalledTimes(1);
    expect(linkTags.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: { tag: true },
        order: { tag: { name: 'ASC' } },
      }),
    );
    expect(tags.get('a')).toEqual([home, work]);
    expect(tags.get('b')).toEqual([work]);
  });

  it('does not query without ids', async () => {
    await expect(repository.findTagsByLinkIds([])).resolves.toEqual(new Map());
    await expect(repository.findFoldersByIds([])).resolves.toEqual(new Map());
    expect(linkTags.find).not.toHaveBeenCalled();
    expect(folders.findBy).not.toHaveBeenCalled();
  });

  it('indexes the folders by internal id from a single query', async () => {
    const folder = { id: 'f1' } as Folder;
    folders.findBy.mockResolvedValue([folder]);

    const found = await repository.findFoldersByIds(['f1']);

    expect(folders.findBy).toHaveBeenCalledTimes(1);
    expect(found.get('f1')).toBe(folder);
  });
});
