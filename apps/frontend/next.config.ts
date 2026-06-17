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
};

export default withNextIntl(nextConfig);
