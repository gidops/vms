import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

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
  async redirects() {
    return [
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
