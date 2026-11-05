import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Screens that moved; old links and bookmarks still land on the new page.
const MOVED_PAGES: Record<string, string> = {
  "/admin/analytics": "/insights?tab=analytics",
  "/admin/v2/analytics": "/insights?tab=analytics",
  "/admin/evacuation": "/insights?tab=evacuation",
  "/admin/v2/evacuation": "/insights?tab=evacuation",
  "/dashboard/evacuation": "/insights?tab=evacuation",
  "/admin/opt-ins": "/insights?tab=visitors",
  "/admin/v2/opt-ins": "/insights?tab=visitors",
  "/dashboard/opt-ins": "/insights?tab=visitors",
  "/admin/desk-qr": "/operations?tab=deskQr",
  "/admin/v2/desk-qr": "/operations?tab=deskQr",
  "/dashboard/desk-qr": "/operations?tab=deskQr",
  "/admin/v2": "/admin",
  "/admin/v2/approvals": "/admin/approvals",
  "/admin/v2/requests": "/admin/requests",
  "/admin/v2/users": "/admin/users",
  "/admin/activity": "/admin/requests",
  "/help": "/insights",
  "/staff/requests": "/staff/updates",
};

// English is served without a locale prefix; /en, /fr and /ar are prefixed.
const movedPageRedirects = Object.entries(MOVED_PAGES).flatMap(([from, to]) => [
  { source: from, destination: to, permanent: false },
  {
    source: `/:locale(en|fr|ar)${from}`,
    destination: `/:locale${to}`,
    permanent: false,
  },
]);

const nextConfig: NextConfig = {
  output: "standalone",
  // In a monorepo, trace files from the workspace root so the standalone
  // bundle includes the hoisted node_modules. Without this, Next infers the
  // tracing root from the app folder and ships an incomplete server bundle.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Internal workspace packages are shipped as TS source and transpiled here.
  transpilePackages: ["@vms/ui", "@vms/tokens", "@vms/contracts"],
  // Cutover: the V1 QR already printed at the VMC desk points at
  // /qr.php?i=<32 hex>. Once the domain serves v2, send it to the desk QR form
  // (its token is imported as the desk QR; see apps/backend desk-qr:import-v1).
  // The walk-in QR page carries its secret token in the URL: keep it out of
  // Referer headers sent to other sites and out of search engines.
  async headers() {
    const privatePage = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      { source: "/r/:token", headers: privatePage },
      { source: "/:locale(en|fr|ar)/r/:token", headers: privatePage },
    ];
  },
  async redirects() {
    return [
      ...movedPageRedirects,
      {
        source: "/qr.php",
        has: [{ type: "query", key: "i", value: "(?<token>[0-9a-fA-F]{32})" }],
        destination: "/r/:token",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
