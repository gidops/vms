import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The desk QR is managed by the System Admin from the admin console. Keep existing links and bookmarks working by redirecting there.
export default async function DeskQrRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/admin/v2/desk-qr", locale });
  // `redirect` throws, but satisfy the return type for the type checker.
  return null;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
