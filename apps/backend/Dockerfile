# syntax=docker/dockerfile:1.7
# Build context is the MONOREPO ROOT (see docker-compose.yml / build context).

FROM node:20.11.0-alpine AS base
# Tolerate flaky network pulls during npm ci.
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000

# ---- pruner: produce a focused workspace subset for @vms/backend ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx --yes turbo@2 prune @vms/backend --docker

# ---- deps: install dependencies from the pruned lockfile ----
# --ignore-scripts skips the backend postinstall (prisma generate); the schema
# is not present yet at this layer. We generate the client explicitly below.
FROM base AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
RUN npm ci --ignore-scripts

# ---- builder: generate the Prisma client and compile to dist/ ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ ./
RUN npm --workspace @vms/backend run db:generate
RUN npx turbo run build --filter=@vms/backend

# ---- runner: minimal runtime image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nestjs

# Carry the built workspace node_modules (includes generated @prisma/client and
# the Prisma CLI used by the entrypoint to run migrate deploy at startup),
# the compiled output, and the Prisma schema + migration history.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/package.json ./apps/backend/package.json

# Entrypoint: wait for the DB, run migrations, then exec the app.
COPY --chown=nestjs:nodejs apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nestjs
WORKDIR /app/apps/backend
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
