import { randomUUID } from "node:crypto";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PutObjectCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  ObjectStorage,
  type PresignUploadInput,
  type PresignedUpload,
} from "../../application/ports/object-storage.port.js";
import type { Environment } from "../config/env.shema.js";

/**
 * RustFS-backed object storage (S3-compatible API). Hands the browser presigned
 * PUT URLs so the bytes go straight to the store; on boot it publishes a CORS
 * policy on the bucket so those cross-origin PUTs from the web app are allowed.
 */
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
      // RustFS (like S3 and MinIO) rejects the CRC32 checksum the v3 SDK now
      // bakes into presigned URLs by default, since the browser's body won't
      // match the placeholder. Only checksum when a request explicitly asks for it.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async onModuleInit() {
    await this.ensureCors();
  }

  async presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
    const key = this.buildKey(input.filename);
    const command = new PutObjectCommand({
      Bucket: this.storage.bucket,
      Key: key,
      ContentType: input.contentType,
    });
    let url = await getSignedUrl(this.client, command, {
      expiresIn: this.storage.presignTtl,
    });

    // Rewrite the presigned URL to use a relative path instead of the raw S3
    // endpoint. This allows Vite's dev server proxy to intercept the request,
    // keeping everything on the same origin (localhost:5173) and avoiding CORS.
    // e.g., http://localhost:9000/documents/... → /documents/...
    const s3UrlMatch = url.match(/^https?:\/\/[^/]+(\/.+)$/);
    if (s3UrlMatch?.[1]) {
      url = s3UrlMatch[1];
    }

    return {
      key,
      url,
      contentType: input.contentType,
      expiresIn: this.storage.presignTtl,
    };
  }

  /** `<uuid>/<safe-filename>` — unique, yet traceable to its original name. */
  private buildKey(filename: string): string {
    const safe = filename
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120);
    return `${randomUUID()}/${safe || "file"}`;
  }

  /** Allow the web app's origin to PUT/GET directly against the bucket. */
  private async ensureCors() {
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.storage.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
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
        `✓ CORS configured on bucket "${this.storage.bucket}" for all origins`,
      );
    } catch (err) {
      // RustFS may not support PutBucketCorsCommand; CORS might be configured
      // via environment variables or through a proxy (e.g., Vite dev server).
      // Log at debug level to avoid noise if CORS is configured externally.
      this.logger.debug(
        `Could not configure CORS via S3 API on bucket "${this.storage.bucket}". ` +
          `Uploads may still work if CORS is configured externally (e.g., via Vite proxy). ${String(err)}`,
      );
    }
  }
}
