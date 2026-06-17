import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(req: unknown, res: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let reply: jest.Mock;
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    reply = jest.fn();
    filter = new AllExceptionsFilter({
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost);
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps an HttpException to an RFC-7807 problem response', () => {
    filter.catch(
      new BadRequestException('Bad input'),
      makeHost({ url: '/x' }, {}),
    );

    expect(reply).toHaveBeenCalledTimes(1);
    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body).toEqual(
      expect.objectContaining({
        type: 'about:blank',
        status: 400,
        instance: '/x',
      }),
    );
    expect(body.timestamp).toBeDefined();
  });

  it('treats unknown errors as 500, logs them, and does not leak internals', () => {
    const errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('secret-db-dsn'), makeHost({ url: '/y' }, {}));

    const [, body, status] = reply.mock.calls[0];
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.title).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret-db-dsn');
    expect(errorLog).toHaveBeenCalled();
  });
});
