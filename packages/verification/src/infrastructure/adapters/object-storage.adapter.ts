import { randomUUID } from 'node:crypto';

import {
  GetObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { Logger } from '@cadastre/logger';

import {
  ObjectStorage,
  type PresignedDownload,
  type PresignedUpload,
  type PresignUploadRequest,
  type PutObjectRequest,
  type StoredObject,
} from '../../application/ports/outbound/index.js';
import { UnsupportedContentTypeException } from '../../domain/exceptions/index.js';
import {
  ContentType,
  StorageKey,
  type Filename,
} from '../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../verification.module-defs.js';
import { ObjectBodyMissingException } from '../exceptions/index.js';

@Injectable()
export class ObjectStorageAdapter
  extends ObjectStorage
  implements OnModuleInit
{
  private readonly logger: Logger;
  private readonly client: S3Client;
  private readonly storage: VerificationModuleOptions['storage'];
  private readonly webOrigin: string;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    this.logger = logger.child({ scope: ObjectStorageAdapter.name });
    this.storage = options.storage;
    this.webOrigin = options.web.origin;
    this.client = new S3Client({
      endpoint: this.storage.endpoint,
      region: this.storage.region,
      forcePathStyle: this.storage.forcePathStyle,
      credentials: {
        accessKeyId: this.storage.accessKey,
        secretAccessKey: this.storage.secretKey,
      },
      // RustFS rejects the CRC32 checksum the v3 SDK bakes into a presigned URL:
      // the browser's body cannot match the placeholder it signs.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async onModuleInit() {
    await this.ensureCors();
  }

  async presignUpload(request: PresignUploadRequest): Promise<PresignedUpload> {
    const key = this.buildKey(request.filename);
    const command = new PutObjectCommand({
      Bucket: this.storage.bucket,
      Key: key.value,
      ContentType: request.contentType.value,
    });
    let url = await getSignedUrl(this.client, command, {
      expiresIn: this.storage.presignTtl,
    });

    // Relative rather than absolute, so the dev proxy can serve the PUT from the
    // web app's own origin instead of the browser having to cross into storage.
    const s3UrlMatch = url.match(/^https?:\/\/[^/]+(\/.+)$/);
    if (s3UrlMatch?.[1]) {
      url = s3UrlMatch[1];
    }

    this.logger.debug('Signed an upload', {
      key: key.value,
      filename: request.filename.value,
      contentType: request.contentType.value,
      expiresIn: this.storage.presignTtl,
    });

    return {
      key,
      url,
      contentType: request.contentType,
      expiresIn: this.storage.presignTtl,
    };
  }

  async putObject(request: PutObjectRequest): Promise<void> {
    const startedAt = Date.now();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.storage.bucket,
        Key: request.key.value,
        Body: request.body,
        ContentType: request.contentType.value,
      }),
    );

    this.logger.debug('Object stored', {
      key: request.key.value,
      contentType: request.contentType.value,
      bytes: request.body.byteLength,
      durationMs: Date.now() - startedAt,
    });
  }

  async presignDownload(key: StorageKey): Promise<PresignedDownload> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.storage.bucket, Key: key.value }),
      { expiresIn: this.storage.presignTtl },
    );

    return {
      // Relative for the same reason the upload URL is: the browser fetches it
      // from the web app's own origin, which the dev proxy and the nginx in
      // front of the built app both forward to storage.
      url: url.match(/^https?:\/\/[^/]+(\/.+)$/)?.[1] ?? url,
      expiresIn: this.storage.presignTtl,
    };
  }

  async getObject(key: StorageKey): Promise<StoredObject> {
    const startedAt = Date.now();
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.storage.bucket, Key: key.value }),
    );
    if (!res.Body) {
      this.logger.error('Object exists but carried no body', {
        key: key.value,
        bucket: this.storage.bucket,
      });
      throw new ObjectBodyMissingException(key);
    }
    const body = await res.Body.transformToByteArray();

    this.logger.debug('Object read', {
      key: key.value,
      contentType: res.ContentType,
      bytes: body.byteLength,
      durationMs: Date.now() - startedAt,
    });

    return { body, contentType: this.reportedType(res.ContentType) };
  }

  private buildKey(filename: Filename): StorageKey {
    const safe = filename.value
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120);
    return StorageKey.create(`${randomUUID()}/${safe || 'file'}`);
  }

  private reportedType(raw: string | undefined): ContentType | null {
    if (!raw) return null;

    try {
      return ContentType.of(raw);
    } catch (error) {
      if (!(error instanceof UnsupportedContentTypeException)) throw error;

      this.logger.debug('Object store reported an unsupported content type', {
        contentType: raw,
      });
      return null;
    }
  }

  private async ensureCors() {
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.storage.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                // Wider than `webOrigin` on purpose: the dev proxy and the
                // deployed app reach the bucket under different names.
                AllowedOrigins: ['*'],
                AllowedMethods: ['PUT', 'GET', 'HEAD'],
                AllowedHeaders: ['*'],
                ExposeHeaders: ['ETag', 'x-amz-*'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      this.logger.log('CORS configured on the bucket', {
        bucket: this.storage.bucket,
        endpoint: this.storage.endpoint,
        allowedOrigins: '*',
        webOrigin: this.webOrigin,
      });
    } catch (err) {
      // RustFS may not implement PutBucketCors, and CORS may already be set
      // outside the API — a failure here is not necessarily a broken upload.
      this.logger.debug(
        'Could not configure CORS through the S3 API; uploads may still work ' +
          'if it is configured outside it, e.g. by the dev proxy',
        {
          bucket: this.storage.bucket,
          endpoint: this.storage.endpoint,
          error: err,
        },
      );
    }
  }
}
