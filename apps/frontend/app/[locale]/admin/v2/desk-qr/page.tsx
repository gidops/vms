import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The desk QR is managed by the System Admin on the Operations page. Keep
// existing links and bookmarks working by redirecting there.
export default async function AdminV2DeskQrRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({
    href: { pathname: "/operations", query: { tab: "deskQr" } },
    locale,
  });
  // `redirect` throws, but satisfy the return type for the type checker.
  return null;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
