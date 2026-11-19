import type { SelectQueryBuilder } from 'typeorm';
import { toLikePattern, type ListPage } from '../../common/list-query.js';
import {
  LIST_FOLDER_NONE,
  LIST_LIKE_ESCAPE,
  type LinkHealthFilter,
  type LinkListSort,
} from '../../common/variables.global.js';
import type { Link, LinkType } from '../entities/link.entity.js';

export interface LinkListQuery {
  q?: string;
  tag?: string;
  folder?: string;
  sort: LinkListSort;
  page: number;
  pageSize: number;
}

export interface StateClause {
  sql: string;
  params: Record<string, unknown>;
}

const SORTS: Record<
  LinkListSort,
  {
    column: 'link.createdAt' | 'link.updatedAt' | 'link.publicId';
    order: 'ASC' | 'DESC';
  }
> = {
  created_desc: { column: 'link.createdAt', order: 'DESC' },
  created_asc: { column: 'link.createdAt', order: 'ASC' },
  updated_desc: { column: 'link.updatedAt', order: 'DESC' },
  slug_asc: { column: 'link.publicId', order: 'ASC' },
  slug_desc: { column: 'link.publicId', order: 'DESC' },
};

const ESCAPE = `ESCAPE '${LIST_LIKE_ESCAPE}'`;
const REJECTED = 'rejected';
const EXPIRED = 'link.expiresAt IS NOT NULL AND link.expiresAt <= :now';
const NOT_EXPIRED = '(link.expiresAt IS NULL OR link.expiresAt > :now)';
const USED_UP =
  '(link.maxDownloads IS NOT NULL AND link.downloadCount >= link.maxDownloads)';
const COUNTED_FILES = `f.link_id = link.id AND f.status <> :rejected AND f.deleted_at IS NULL`;
const COUNTED_COUNT = `(SELECT COUNT(*) FROM files f WHERE ${COUNTED_FILES})`;
const COUNTED_BYTES = `(SELECT COALESCE(SUM(f.size), 0) FROM files f WHERE ${COUNTED_FILES})`;

export function linkStateClause(
  state: 'active' | 'disabled' | 'expired',
  now: Date,
): StateClause {
  const params = { now };
  switch (state) {
    case 'disabled':
      return { sql: 'link.disabled = true', params };
    case 'expired':
      return {
        sql: `link.disabled = false AND ${EXPIRED}`,
        params,
      };
    case 'active':
      return {
        sql: `link.disabled = false AND ${NOT_EXPIRED}`,
        params,
      };
  }
}

export function shareStateClause(
  state: 'active' | 'disabled' | 'expired',
  now: Date,
): StateClause {
  const params = { now };
  switch (state) {
    case 'disabled':
      return { sql: 'link.disabled = true', params };
    case 'expired':
      return {
        sql: `link.disabled = false AND ((${EXPIRED}) OR ${USED_UP})`,
        params,
      };
    case 'active':
      return {
        sql: `link.disabled = false AND ${NOT_EXPIRED} AND NOT ${USED_UP}`,
        params,
      };
  }
}

export function dropStateClause(
  state: 'open' | 'full' | 'expired' | 'disabled',
  now: Date,
): StateClause {
  const params = { now, rejected: REJECTED };
  const full = `(link.maxFiles IS NULL OR link.maxTotalBytes IS NULL OR ${COUNTED_COUNT} >= link.maxFiles OR ${COUNTED_BYTES} >= link.maxTotalBytes)`;
  switch (state) {
    case 'disabled':
      return { sql: 'link.disabled = true', params };
    case 'expired':
      return {
        sql: `link.disabled = false AND ${EXPIRED}`,
        params,
      };
    case 'full':
      return {
        sql: `link.disabled = false AND ${NOT_EXPIRED} AND ${full}`,
        params,
      };
    case 'open':
      return {
        sql: `link.disabled = false AND ${NOT_EXPIRED} AND NOT ${full}`,
        params,
      };
  }
}

const LINK_CHECK_ROW =
  'SELECT 1 FROM link_checks lc WHERE lc.link_id = link.id';

export function linkHealthClause(
  health: LinkHealthFilter,
  brokenAfter: number,
): StateClause {
  const params = { brokenAfter, skipped: 'skipped' };
  switch (health) {
    case 'broken':
      return {
        sql: `EXISTS (${LINK_CHECK_ROW} AND lc.consecutive_failures >= :brokenAfter)`,
        params,
      };
    case 'ok':
      return {
        sql: `EXISTS (${LINK_CHECK_ROW} AND lc.consecutive_failures < :brokenAfter AND lc.outcome <> :skipped)`,
        params,
      };
    case 'unchecked':
      return {
        sql: `NOT EXISTS (${LINK_CHECK_ROW} AND (lc.consecutive_failures >= :brokenAfter OR lc.outcome <> :skipped))`,
        params,
      };
  }
}

export async function findLinkPage(
  qb: SelectQueryBuilder<Link>,
  type: LinkType,
  query: LinkListQuery,
  state: StateClause | null,
  health: StateClause | null = null,
): Promise<Pick<ListPage<Link>, 'items' | 'total'>> {
  qb.where('link.type = :type', { type });
  if (query.q !== undefined) {
    qb.andWhere(
      `(link.publicId COLLATE utf8mb4_unicode_ci LIKE :pattern ${ESCAPE} OR link.destination LIKE :pattern ${ESCAPE} OR link.title LIKE :pattern ${ESCAPE})`,
      { pattern: toLikePattern(query.q) },
    );
  }
  if (query.tag !== undefined) {
    qb.andWhere(
      'EXISTS (SELECT 1 FROM link_tags lt INNER JOIN tags t ON t.id = lt.tag_id WHERE lt.link_id = link.id AND t.public_id = :tag)',
      { tag: query.tag },
    );
  }
  if (query.folder === LIST_FOLDER_NONE) {
    qb.andWhere('link.folderId IS NULL');
  } else if (query.folder !== undefined) {
    qb.andWhere(
      'link.folderId IN (SELECT f.id FROM folders f WHERE f.public_id = :folder)',
      { folder: query.folder },
    );
  }
  if (state) {
    qb.andWhere(`(${state.sql})`, state.params);
  }
  if (health) {
    qb.andWhere(`(${health.sql})`, health.params);
  }
  const { column, order } = SORTS[query.sort];
  qb.orderBy(column, order);
  if (column !== 'link.publicId') qb.addOrderBy('link.publicId', 'ASC');
  const [items, total] = await qb
    .skip((query.page - 1) * query.pageSize)
    .take(query.pageSize)
    .getManyAndCount();
  return { items, total };
}
