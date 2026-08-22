import { Inject, Logger } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  PackageId,
  StorageKey,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import {
  ObjectStorage,
  PackageQueries,
} from '../../../ports/outbound/index.js';
import type { PackageDetailView } from '../../../read-models/index.js';

import { GetPackageQuery } from './get-package.query.js';

@QueryHandler(GetPackageQuery)
export class GetPackageHandler implements IQueryHandler<
  GetPackageQuery,
  PackageDetailView
> {
  private readonly logger = new Logger(GetPackageHandler.name);

  constructor(
    @Inject(PackageQueries) private readonly packages: PackageQueries,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
  ) {}

  async execute(query: GetPackageQuery): Promise<PackageDetailView> {
    const packageId = PackageId.of(query.packageId);
    const detail = await this.packages.findDetail(packageId);

    if (!detail) throw new PackageNotFoundException(packageId);

    return { ...detail, files: await this.withSheetLinks(detail.files) };
  }

  // A finding cites a sheet, and an inspector who cannot open that sheet cannot
  // check the finding. The links are signed here — per request, and expiring —
  // rather than stored: a URL that opens a scan of somebody's identity card has
  // no business outliving the page that showed it.
  private async withSheetLinks(
    files: PackageDetailView['files'],
  ): Promise<PackageDetailView['files']> {
    return Promise.all(
      files.map(async file => ({
        ...file,
        pages: await Promise.all(
          file.pages.map(async page => ({
            ...page,
            imageUrl: await this.link(page.imageStorageKey),
          })),
        ),
      })),
    );
  }

  private async link(key: string): Promise<string | null> {
    try {
      return (await this.storage.presignDownload(StorageKey.create(key))).url;
    } catch (error) {
      // The rest of the package is worth serving without one sheet's link.
      this.logger.warn(`Could not sign for "${key}": ${String(error)}`);

      return null;
    }
  }
}
