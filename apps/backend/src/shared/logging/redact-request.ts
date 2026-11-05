const DESK_QR_PATH = /\/public\/desk-qr\/([^/?#]+)/;

/** The desk QR token is a printed secret, so it never reaches the logs (URL or route params). */
export function redactRequest<T extends { url?: string; params?: unknown }>(
  req: T,
): T {
  const token = req.url?.match(DESK_QR_PATH)?.[1];
  if (!token) return req;
  const hide = (value: string) => value.split(token).join('[redacted]');
  return {
    ...req,
    url: hide(req.url!),
    params:
      req.params === undefined
        ? undefined
        : JSON.parse(hide(JSON.stringify(req.params))),
  };
}
