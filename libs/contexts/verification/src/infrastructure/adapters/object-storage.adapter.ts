import { randomUUID } from "node:crypto";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  ObjectStorage,
  type PresignUploadRequest,
  type PresignedUpload,
  type StoredObject,
} from "../../application/ports/index.js";
import { UnsupportedContentTypeException } from "../../domain/exceptions/index.js";
import {
  ContentType,
  type Filename,
  StorageKey,
} from "../../domain/value-objects/index.js";
import type { Environment } from "../config/index.js";
import { ObjectBodyMissingException } from "../exceptions/index.js";

@Injectable()
export class ObjectStorageAdapter
  extends ObjectStorage
  implements OnModuleInit
{
  private readonly logger = new Logger(ObjectStorageAdapter.name);
  private readonly client: S3Client;
  private readonly storage: Environment["storage"];
  private readonly webOrigin: string;

  constructor(config: ConfigService<Environment, true>) {
    super();
    this.storage = config.get("storage", { infer: true });
    this.webOrigin = config.get("web", { infer: true }).origin;
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
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
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

    return {
      key,
      url,
      contentType: request.contentType,
      expiresIn: this.storage.presignTtl,
    };
  }

  async getObject(key: StorageKey): Promise<StoredObject> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.storage.bucket, Key: key.value }),
    );
    if (!res.Body) {
      throw new ObjectBodyMissingException(key);
    }
    const body = await res.Body.transformToByteArray();
    return { body, contentType: this.reportedType(res.ContentType) };
  }

  private buildKey(filename: Filename): StorageKey {
    const safe = filename.value
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120);
    return StorageKey.create(`${randomUUID()}/${safe || "file"}`);
  }

  private reportedType(raw: string | undefined): ContentType | null {
    if (!raw) return null;

    try {
      return ContentType.of(raw);
    } catch (error) {
      if (!(error instanceof UnsupportedContentTypeException)) throw error;

      this.logger.debug(`Object store reported unsupported type "${raw}"`);
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
                AllowedOrigins: ["*"],
                AllowedMethods: ["PUT", "GET", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag", "x-amz-*"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      this.logger.log(
        `✓ CORS configured on bucket "${this.storage.bucket}" for all origins, ` +
          `including the web app at ${this.webOrigin}`,
      );
    } catch (err) {
      // RustFS may not implement PutBucketCors, and CORS may already be set
      // outside the API — a failure here is not necessarily a broken upload.
      this.logger.debug(
        `Could not configure CORS via S3 API on bucket "${this.storage.bucket}". ` +
          `Uploads may still work if CORS is configured externally (e.g., via Vite proxy). ${String(err)}`,
      );
    }
  }
}
