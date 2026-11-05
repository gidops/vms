import { useTranslations } from "next-intl";

/** Shared hero + logo props for every sign-in page. */
export function useAuthBrand() {
  const t = useTranslations("auth");
  return {
    heroSrc: "/brand/aatc-building.jpg",
    heroTitle: t("heroTitle"),
    heroSubtitle: t("heroSubtitle"),
    heroCaption: t("heroCaption"),
    logo: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/afreximbank-aatc-lockup.png"
        alt={t("logoAlt")}
        className="h-auto w-36"
      />
    ),
  };
}
