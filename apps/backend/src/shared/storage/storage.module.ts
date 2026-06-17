import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';

/** Provides object-storage access (S3 presigned uploads) app-wide. */
@Global()
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class StorageModule {}
