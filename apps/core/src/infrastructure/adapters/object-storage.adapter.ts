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
 * Garage/S3-backed object storage. Hands the browser presigned PUT URLs so the
 * bytes go straight to the store; on boot it publishes a CORS policy on the
 * bucket so those cross-origin PUTs from the web app are allowed.
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
      // Garage (like MinIO) rejects the CRC32 checksum the v3 SDK now bakes into
      // presigned URLs by default, since the browser's body won't match the
      // placeholder. Only checksum when a request explicitly asks for it.
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
    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.storage.presignTtl,
    });
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
                AllowedOrigins: [this.webOrigin],
                AllowedMethods: ["PUT", "GET", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      this.logger.log(
        `CORS published on bucket "${this.storage.bucket}" for ${this.webOrigin}`,
      );
    } catch (err) {
      this.logger.warn(
        `Could not set CORS on bucket "${this.storage.bucket}" — ` +
          `browser uploads may be blocked. Does the bucket exist? ${String(err)}`,
      );
    }
  }
}
