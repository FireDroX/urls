import { describe, expect, it } from 'vitest';
import { shareDropFilesSchema } from '../../../drops/dto/in/share-drop-files.dto.js';
import { createDropSchema } from '../../../drops/dto/in/create-drop.dto.js';
import { createShareSchema } from '../../../shares/dto/in/create-share.dto.js';
import { updateShareSchema } from '../../../shares/dto/in/update-share.dto.js';
import { LINK_TAGS_MAX } from '../../../common/variables.global.js';
import { createLinkSchema } from './create-link.dto.js';
import { updateLinkSchema } from './update-link.dto.js';

const LINK = { destination: 'https://example.com' };

describe('tags and folder fields', () => {
  it('accepts tag ids and a folder on every create schema', () => {
    const organization = { tagIds: ['a', 'b'], folderId: 'folder1' };

    expect(
      createLinkSchema.safeParse({ ...LINK, ...organization }).success,
    ).toBe(true);
    expect(createShareSchema.safeParse(organization).success).toBe(true);
    expect(
      createDropSchema.safeParse({
        maxFiles: 1,
        maxTotalBytes: 10,
        ...organization,
      }).success,
    ).toBe(true);
  });

  it('accepts a null folder and an empty tag list', () => {
    expect(
      updateLinkSchema.safeParse({ folderId: null, tagIds: [] }).success,
    ).toBe(true);
  });

  it('counts a lone folderId or tagIds as a change', () => {
    expect(updateShareSchema.safeParse({ folderId: null }).success).toBe(true);
    expect(updateShareSchema.safeParse({ tagIds: [] }).success).toBe(true);
    expect(updateShareSchema.safeParse({}).success).toBe(false);
  });

  it('refuses more than LINK_TAGS_MAX tags', () => {
    const tagIds = Array.from({ length: LINK_TAGS_MAX + 1 }, (_, i) => `t${i}`);

    expect(createLinkSchema.safeParse({ ...LINK, tagIds }).success).toBe(false);
    expect(
      createLinkSchema.safeParse({
        ...LINK,
        tagIds: tagIds.slice(0, LINK_TAGS_MAX),
      }).success,
    ).toBe(true);
  });

  it('refuses duplicate tags, empty ids and a non-string folder', () => {
    expect(
      createLinkSchema.safeParse({ ...LINK, tagIds: ['a', 'a'] }).success,
    ).toBe(false);
    expect(createLinkSchema.safeParse({ ...LINK, tagIds: [''] }).success).toBe(
      false,
    );
    expect(createLinkSchema.safeParse({ ...LINK, folderId: 3 }).success).toBe(
      false,
    );
  });

  it('keeps tagIds and folderId out of the share-from-drop body', () => {
    const base = { fileIds: ['f1'], closeDrop: true };

    expect(shareDropFilesSchema.safeParse(base).success).toBe(true);
    expect(
      shareDropFilesSchema.safeParse({ ...base, tagIds: ['a'] }).success,
    ).toBe(false);
    expect(
      shareDropFilesSchema.safeParse({ ...base, folderId: 'x' }).success,
    ).toBe(false);
  });
});
