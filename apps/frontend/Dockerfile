# syntax=docker/dockerfile:1.7
# Build context is the MONOREPO ROOT (see docker-compose.yml / build context).

FROM node:20.11.0-alpine AS base

# ---- pruner: produce a focused workspace subset for @vms/frontend ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx --yes turbo@2 prune @vms/frontend --docker

# ---- deps: install dependencies from the pruned lockfile ----
FROM base AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
RUN npm ci --ignore-scripts

# ---- builder: produce the Next.js standalone output ----
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ ./
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time. This ARG
# lets `docker build --build-arg NEXT_PUBLIC_API_BASE_URL=...` pass the backend
# URL in; the ENV promotes it into the build environment so Next/turbo bake it
# into the bundle. Without this, the bundle falls back to the hardcoded
# http://localhost:4000 in data/http/client.ts and breaks against a remote backend.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npx turbo run build --filter=@vms/frontend

# ---- runner: minimal runtime image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Next.js standalone output in a monorepo nests under apps/frontend and ships
# its own hoisted node_modules at the standalone root.
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
