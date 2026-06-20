import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

/**
 * Issues presigned S3 PUT URLs for direct browser uploads. Credentials come
 * from the AWS default provider chain (env vars in dev, the EC2 instance role
 * in prod). Only the object key is persisted by callers — never the URL.
 */
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

  /** Presign an avatar upload for a user. Throws 400 if S3 isn't configured. */
  async presignAvatar(
    userId: string,
    contentType: AvatarContentType,
  ): Promise<PresignResult> {
    const bucket = this.config.get('S3_BUCKET', { infer: true });
    if (!bucket) {
      throw new BadRequestException(
        'Image uploads are not configured (missing S3_BUCKET).',
      );
    }
    const key = `avatars/${userId}/${randomUUID()}.${EXT_BY_TYPE[contentType]}`;
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
