import { GateLinkLanding } from "./GateLinkLanding";

/** The System Admin's kiosk link, opened once on the device (no login). */
export default async function GateLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GateLinkLanding token={token} />;
}
