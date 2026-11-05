import { Injectable } from '@nestjs/common';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import {
  FileUploadsService,
  type IncomingPart,
  type ReceivedPart,
  type UploadParts,
  type UploadStart,
} from '../../files/services/file-uploads.service.js';
import { SharesService } from './shares.service.js';

@Injectable()
export class ShareFilesService {
  constructor(
    private readonly shares: SharesService,
    private readonly uploads: FileUploadsService,
  ) {}

  async start(
    sharePublicId: string,
    input: unknown,
    userId: string,
  ): Promise<UploadStart> {
    const share = await this.shares.find(sharePublicId);
    return this.uploads.start(share, input, userId);
  }

  async uploadPart(
    sharePublicId: string,
    filePublicId: string,
    partNumber: string,
    part: IncomingPart,
  ): Promise<ReceivedPart> {
    const share = await this.shares.find(sharePublicId);
    return this.uploads.uploadPart(share, filePublicId, partNumber, part);
  }

  async listParts(
    sharePublicId: string,
    filePublicId: string,
  ): Promise<UploadParts> {
    const share = await this.shares.find(sharePublicId);
    return this.uploads.listParts(share, filePublicId);
  }

  async complete(
    sharePublicId: string,
    filePublicId: string,
  ): Promise<StoredFile> {
    const share = await this.shares.find(sharePublicId);
    return this.uploads.complete(share, filePublicId);
  }

  async remove(
    sharePublicId: string,
    filePublicId: string,
    userId: string,
  ): Promise<void> {
    const share = await this.shares.find(sharePublicId);
    await this.uploads.remove(share, filePublicId, userId);
  }
}
