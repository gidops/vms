import { SelfRegistrationScreen } from "./SelfRegistrationScreen";

/**
 * Public page opened from the VMC desk QR (no login, no RouteGuard). The token
 * is checked by the API on every request.
 */
export default async function SelfRegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SelfRegistrationScreen token={token} />;
}
