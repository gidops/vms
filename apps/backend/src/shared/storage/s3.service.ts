import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AvatarContentType, PresignResult } from '@vms/contracts';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.schema';

const EXT_BY_TYPE: Record<AvatarContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const VISITOR_PHOTO_PREFIX = 'visitor-photos/';

/** Callers persist only the object key, never the URL. */
@Injectable()
export class S3Service {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = new S3Client({
      region: this.config.get('AWS_REGION', { infer: true }),
    });
  }

  get isConfigured(): boolean {
    return Boolean(this.config.get('S3_BUCKET', { infer: true }));
  }

  presignAvatar(
    userId: string,
    contentType: AvatarContentType,
  ): Promise<PresignResult> {
    return this.presignPut(`avatars/${userId}/`, contentType);
  }

  /** Personal data: read back only through {@link presignGet}, never a public URL. */
  presignVisitorPhoto(contentType: AvatarContentType): Promise<PresignResult> {
    return this.presignPut(VISITOR_PHOTO_PREFIX, contentType);
  }

  async presignGet(key: string): Promise<string | null> {
    const bucket = this.config.get('S3_BUCKET', { infer: true });
    if (!bucket) return null;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: this.config.get('S3_PRESIGN_EXPIRY', { infer: true }) },
    );
  }

  private async presignPut(
    prefix: string,
    contentType: AvatarContentType,
  ): Promise<PresignResult> {
    const bucket = this.config.get('S3_BUCKET', { infer: true });
    if (!bucket) {
      throw new BadRequestException(
        'Image uploads are not configured (missing S3_BUCKET).',
      );
    }
    const key = `${prefix}${randomUUID()}.${EXT_BY_TYPE[contentType]}`;
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: this.config.get('S3_PRESIGN_EXPIRY', { infer: true }) },
    );
    return { uploadUrl, key };
  }
}
