import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { isRtl, routing } from "@/i18n/routing";
import { AppProviders } from "@/shared/providers/AppProviders";
import "../globals.css";

// Geist via the npm package (fonts ship in node_modules) instead of
// next/font/google, which downloads from fonts.gstatic.com AT BUILD TIME and
// makes every Docker/CI build hostage to that CDN being reachable. Same
// fonts, same CSS variables (--font-geist-sans / --font-geist-mono).
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "AATC VMS",
  description: "AATC Visitor Management System",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const messages = await getMessages();
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
