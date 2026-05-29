# syntax=docker/dockerfile:1.7

# ---- deps: install full dependencies for the build ----
FROM node:20.11.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000
RUN npm ci

# ---- builder: compile TypeScript to dist/ ----
FROM node:20.11.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build

# ---- prod-deps: install only production dependencies ----
FROM node:20.11.0-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 600000
RUN npm ci --omit=dev && npm cache clean --force

# ---- runner: minimal runtime image ----
FROM node:20.11.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nestjs

COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
# Overlay the generated Prisma client (created in the builder stage by
# `prisma generate`) on top of the prod node_modules.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs
EXPOSE 4000
CMD ["node", "dist/main"]
