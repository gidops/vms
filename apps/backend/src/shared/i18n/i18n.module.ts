import { Global, Module } from '@nestjs/common';
import { I18nService } from './i18n.service';

/** Provides backend localization (message catalogs) app-wide. */
@Global()
@Module({
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
