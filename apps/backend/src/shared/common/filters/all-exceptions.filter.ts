import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

/**
 * Single choke point for unhandled errors. Logs 5xx with the request's
 * correlation id (via the pino logger) and returns an RFC 7807-style problem
 * response, never leaking internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ url?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let title = 'Internal server error';
    let detail: string | undefined;
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        title = response;
      } else if (response && typeof response === 'object') {
        const message = (response as { message?: unknown }).message;
        title = exception.message;
        detail = Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : undefined;
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
        instance: request.url ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}
