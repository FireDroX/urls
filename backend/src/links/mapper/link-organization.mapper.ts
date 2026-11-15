import type { LinkOrganizationDto } from '../dto/out/link-organization.dto.js';
import type { LinkOrganization } from '../link-organization.js';

export class LinkOrganizationMapper {
  static toDto({ tags, folder }: LinkOrganization): LinkOrganizationDto {
    return {
      tags: tags.map((tag) => ({
        id: tag.publicId,
        name: tag.name,
        color: tag.color,
      })),
      folder: folder ? { id: folder.publicId, name: folder.name } : null,
    };
  }
}
