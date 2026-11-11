import { Module } from '@nestjs/common';
import { LiveController } from './live.controller';
import { LiveHub } from './live.hub';

@Module({
  controllers: [LiveController],
  providers: [LiveHub],
})
export class LiveModule {}
