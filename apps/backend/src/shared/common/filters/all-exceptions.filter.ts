import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { CLS_LOCALE } from '../../logging/cls-keys';
import { I18nService, type Locale } from '../../i18n/i18n.service';
import type { ValidationIssue } from '../pipes/zod-validation.pipe';

/** RFC 7807-style responses that never leak internals; catalog-key messages are localized. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ url?: string }>();
    const locale = this.i18n.resolveLocale(
      this.cls.get<string | undefined>(CLS_LOCALE),
    );

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let title = this.i18n.translate('errors.internal', locale);
    let detail: string | undefined;
    let errors: ValidationIssue[] | undefined;

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        title = this.localize(response, locale);
      } else if (response && typeof response === 'object') {
        const message = (response as { message?: unknown }).message;
        title =
          typeof message === 'string'
            ? this.localize(message, locale)
            : this.localize(exception.message, locale);
        const rawErrors = (response as { errors?: unknown }).errors;
        if (Array.isArray(rawErrors)) {
          errors = rawErrors.map((e) =>
            this.localizeIssue(e as ValidationIssue, locale),
          );
          detail = errors.map((e) => e.message).join(', ');
        } else if (Array.isArray(message)) {
          detail = message.join(', ');
        }
      }
    }

    if (status >= 500) {
      this.logger.error(exception);
    }

    httpAdapter.reply(
      ctx.getResponse(),
      {
        type: 'about:blank',
        title,
        status,
        ...(detail ? { detail } : {}),
        ...(errors ? { errors } : {}),
        instance: request.url ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }

  private localize(message: string, locale: Locale): string {
    return this.i18n.has(message)
      ? this.i18n.translate(message, locale)
      : message;
  }

  private localizeIssue(
    issue: ValidationIssue,
    locale: Locale,
  ): ValidationIssue {
    const key = `validation.${issue.code}`;
    return {
      ...issue,
      message: this.i18n.has(key)
        ? this.i18n.translate(key, locale, issue.params)
        : issue.message,
    };
  }
}
