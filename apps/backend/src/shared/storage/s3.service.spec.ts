import { BadRequestException } from '@nestjs/common';
import { S3Service, VISITOR_PHOTO_PREFIX } from './s3.service';

// Signing needs AWS credentials; echo the command instead so CI needs none.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(
    (
      _client: unknown,
      cmd: {
        constructor: { name: string };
        input: { Bucket: string; Key: string };
      },
    ) =>
      Promise.resolve(
        `https://${cmd.input.Bucket}/${cmd.input.Key}?op=${cmd.constructor.name}&X-Amz-Signature=x`,
      ),
  ),
}));

const config = (bucket: string | undefined) =>
  ({
    get: (key: string) =>
      ({
        AWS_REGION: 'eu-west-1',
        S3_BUCKET: bucket,
        S3_PRESIGN_EXPIRY: 300,
      })[key],
  }) as never;

describe('S3Service', () => {
  it('keys avatars per user and visitor photos under their own prefix', async () => {
    const s3 = new S3Service(config('vms-test'));
    const avatar = await s3.presignAvatar('u1', 'image/png');
    expect(avatar.key).toMatch(/^avatars\/u1\/[\w-]+\.png$/);
    const photo = await s3.presignVisitorPhoto('image/jpeg');
    expect(photo.key.startsWith(VISITOR_PHOTO_PREFIX)).toBe(true);
    expect(photo.key).toMatch(/\.jpg$/);
    expect(photo.uploadUrl).toContain('vms-test');
    expect(photo.uploadUrl).toContain('op=PutObjectCommand');
  });

  it('signs private reads, or returns null without a bucket', async () => {
    const url = await new S3Service(config('vms-test')).presignGet(
      'visitor-photos/a.jpg',
    );
    expect(url).toContain('visitor-photos/a.jpg');
    expect(url).toContain('op=GetObjectCommand');
    await expect(
      new S3Service(config(undefined)).presignGet('visitor-photos/a.jpg'),
    ).resolves.toBeNull();
  });

  it('refuses uploads when S3 is not configured', async () => {
    await expect(
      new S3Service(config(undefined)).presignVisitorPhoto('image/jpeg'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
