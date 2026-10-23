import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The VMC admin screens moved to the Help/Support page. Keep existing links
// and bookmarks working by redirecting to the matching tab.
export default async function DeskQrRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: { pathname: "/help", query: { tab: "deskQr" } }, locale });
  // `redirect` throws, but satisfy the return type for the type checker.
  return null;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
