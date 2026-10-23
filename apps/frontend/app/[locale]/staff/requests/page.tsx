import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The staff "Requests & Alerts" screen was renamed to "Updates". Preserve any
// existing links/bookmarks by redirecting to the new route.
export default async function StaffRequestsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/staff/updates", locale });
  // `redirect` throws, but satisfy the return type for the type checker.
  return null;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
