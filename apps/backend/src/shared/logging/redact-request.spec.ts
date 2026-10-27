import { redactRequest } from './redact-request';

describe('redactRequest', () => {
  it('masks the desk QR token in the URL and route params', () => {
    expect(
      redactRequest({
        url: '/public/desk-qr/abcDEF123_-xyz/hosts?q=ada',
        params: { token: 'abcDEF123_-xyz' },
      }),
    ).toEqual({
      url: '/public/desk-qr/[redacted]/hosts?q=ada',
      params: { token: '[redacted]' },
    });
  });

  it('masks the token inside catch-all params on unmatched routes', () => {
    expect(
      redactRequest({
        url: '/public/desk-qr/abcDEF123_-xyz',
        params: { path: ['public', 'desk-qr', 'abcDEF123_-xyz'] },
      }).params,
    ).toEqual({ path: ['public', 'desk-qr', '[redacted]'] });
  });

  it('leaves other requests untouched', () => {
    const req = { url: '/visits/123', params: { id: '123' } };
    expect(redactRequest(req)).toEqual(req);
  });
});
