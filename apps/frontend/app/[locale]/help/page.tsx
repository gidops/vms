import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Help/Support became the Insights page. Keep existing links and bookmarks working by redirecting there.
export default async function HelpRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/insights", locale });
  // `redirect` throws, but satisfy the return type for the type checker.
  return null;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
