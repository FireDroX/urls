import type { LinkCheck } from './entities/link-check.entity.js';
import type { LinkWithOrganization } from './link-organization.js';

export type RedirectView = LinkWithOrganization & { check: LinkCheck | null };
